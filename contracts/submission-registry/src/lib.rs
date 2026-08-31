#![no_std]

//! submission-registry — trustless submission timestamping for hackathons.
//!
//! TRUSTLESS LAYER (cannot be overridden off-chain):
//! - Only an address the event-registry confirms as an organizer for the
//!   target event may record a submission.
//! - A canonical submission hash may be recorded AT MOST ONCE per event.
//!   The second identical submission in the same event is rejected by the
//!   contract itself — this is the exact-duplicate check.
//! - The same hash MAY be recorded under different events at the contract
//!   level; the app layer (AI similarity, organizer review) decides what to
//!   do about cross-event resubmissions. Similarity flags are ADVISORY and
//!   never enforced here.
//!
//! The chain stores only the hash + an IPFS metadata pointer. Full
//! submission content lives off-chain.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    BytesN, Env, String, Symbol, Vec,
};

/// Minimal interface of the event-registry contract, used for the
/// cross-contract authorization check.
#[contractclient(name = "EventRegistryAuthClient")]
pub trait EventRegistryInterface {
    fn is_authorized_organizer(env: Env, event_id: Symbol, organizer: Address) -> bool;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorizedOrganizer = 3,
    DuplicateSubmission = 4,
    SubmissionNotFound = 5,
}

/// On-chain record. Deliberately minimal: hash + pointer + provenance.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubmissionRecord {
    pub hash: BytesN<32>,
    pub event_id: Symbol,
    pub team: Address,
    pub metadata_cid: String,
    pub recorded_by: Address,
    /// Ledger close time (seconds since epoch) — the trusted timestamp.
    pub timestamp: u64,
    pub ledger: u32,
}

/// Published whenever a submission is timestamped on-chain.
#[contractevent]
#[derive(Clone, Debug)]
pub struct SubmissionRecorded {
    #[topic]
    pub event_id: Symbol,
    #[topic]
    pub hash: BytesN<32>,
    pub team: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    EventRegistry,
    /// Unique per (event, hash) — presence of this key IS the duplicate check.
    Record(Symbol, BytesN<32>),
    /// Every record for a hash, across all events, in insertion order.
    History(BytesN<32>),
    /// Every record by a team address.
    TeamIndex(Address),
    /// Every record in an event — the on-chain event page index.
    EventSubmissions(Symbol),
}

#[contract]
pub struct SubmissionRegistry;

#[contractimpl]
impl SubmissionRegistry {
    /// One-time init pointing at the deployed event-registry.
    pub fn init(env: Env, event_registry: Address) {
        if env.storage().instance().has(&DataKey::EventRegistry) {
            env.panic_with_error(Error::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::EventRegistry, &event_registry);
    }

    /// Timestamp a submission on-chain.
    ///
    /// `caller` must authenticate and must be an authorized organizer of
    /// `event_id` per the event-registry. Panics with `DuplicateSubmission`
    /// if `hash` was already recorded for this event — TRUSTLESS rejection,
    /// no off-chain code can bypass it.
    pub fn record(
        env: Env,
        caller: Address,
        event_id: Symbol,
        team: Address,
        hash: BytesN<32>,
        metadata_cid: String,
    ) -> SubmissionRecord {
        caller.require_auth();

        let registry = event_registry_address(&env);
        let authorized: bool = EventRegistryAuthClient::new(&env, &registry)
            .is_authorized_organizer(&event_id, &caller);
        if !authorized {
            env.panic_with_error(Error::NotAuthorizedOrganizer);
        }

        let record_key = DataKey::Record(event_id.clone(), hash.clone());
        if env.storage().persistent().has(&record_key) {
            // Exact-duplicate rejection (trustless, on-chain).
            env.panic_with_error(Error::DuplicateSubmission);
        }

        let record = SubmissionRecord {
            hash: hash.clone(),
            event_id: event_id.clone(),
            team: team.clone(),
            metadata_cid,
            recorded_by: caller,
            timestamp: env.ledger().timestamp(),
            ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(&record_key, &record);

        let history_key = DataKey::History(hash.clone());
        let mut history: Vec<SubmissionRecord> = env
            .storage()
            .persistent()
            .get(&history_key)
            .unwrap_or(Vec::new(&env));
        history.push_back(record.clone());
        env.storage().persistent().set(&history_key, &history);

        let team_key = DataKey::TeamIndex(team.clone());
        let mut team_records: Vec<SubmissionRecord> = env
            .storage()
            .persistent()
            .get(&team_key)
            .unwrap_or(Vec::new(&env));
        team_records.push_back(record.clone());
        env.storage().persistent().set(&team_key, &team_records);

        let event_key = DataKey::EventSubmissions(event_id.clone());
        let mut event_records: Vec<SubmissionRecord> = env
            .storage()
            .persistent()
            .get(&event_key)
            .unwrap_or(Vec::new(&env));
        event_records.push_back(record.clone());
        env.storage().persistent().set(&event_key, &event_records);

        SubmissionRecorded {
            event_id,
            hash,
            team,
            timestamp: record.timestamp,
        }
        .publish(&env);

        record
    }

    /// Earliest record for a hash — the provenance origin.
    pub fn get_submission(env: Env, hash: BytesN<32>) -> SubmissionRecord {
        let history: Vec<SubmissionRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::History(hash))
            .unwrap_or(Vec::new(&env));
        history
            .first()
            .unwrap_or_else(|| env.panic_with_error(Error::SubmissionNotFound))
    }

    /// Every event this hash was recorded under, in insertion order.
    pub fn get_submission_history(env: Env, hash: BytesN<32>) -> Vec<SubmissionRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::History(hash))
            .unwrap_or(Vec::new(&env))
    }

    /// Every submission recorded by a team address.
    pub fn get_submissions_by_team(env: Env, team: Address) -> Vec<SubmissionRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::TeamIndex(team))
            .unwrap_or(Vec::new(&env))
    }

    /// Every submission recorded under an event, in insertion order —
    /// powers chain-native event pages without any off-chain index.
    pub fn get_event_submissions(env: Env, event_id: Symbol) -> Vec<SubmissionRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::EventSubmissions(event_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_event_registry(env: Env) -> Address {
        event_registry_address(&env)
    }
}

fn event_registry_address(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::EventRegistry)
        .unwrap_or_else(|| env.panic_with_error(Error::NotInitialized))
}

#[cfg(test)]
mod test;
