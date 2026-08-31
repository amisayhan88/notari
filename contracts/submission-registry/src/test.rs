#![cfg(test)]
extern crate std;

use super::*;
use event_registry::{EventRegistry, EventRegistryClient};
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, BytesN, Env, String};

/// Registers both contracts, wires them together, and returns the
/// (event_registry_id, organizer, team) handles. Callers create clients
/// from their own `Env` to keep lifetimes simple.
fn setup(env: &Env) -> (Address, Address, Address) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let organizer = Address::generate(env);
    let team = Address::generate(env);

    let event_registry_id = env.register(EventRegistry, ());
    let event_client = EventRegistryClient::new(env, &event_registry_id);
    event_client.init(&admin);
    event_client.add_organizer(&admin, &symbol_short!("evt_a"), &organizer);
    event_client.add_organizer(&admin, &symbol_short!("evt_b"), &organizer);

    let registry_id = env.register(SubmissionRegistry, ());
    let client = SubmissionRegistryClient::new(env, &registry_id);
    client.init(&event_registry_id);

    env.ledger().with_mut(|li| {
        li.sequence_number = 100;
        li.timestamp = 1_772_000_000;
    });

    (registry_id, organizer, team)
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn cid(env: &Env) -> String {
    String::from_str(env, "ipfs://bafkreitestcid")
}

/// Unwraps a try_* result and asserts the contract error code.
fn assert_contract_error(
    res: Result<
        Result<SubmissionRecord, soroban_sdk::ConversionError>,
        Result<soroban_sdk::Error, soroban_sdk::InvokeError>,
    >,
    expected: Error,
) {
    let err = res
        .err()
        .expect("call should fail")
        .ok()
        .expect("failure should be a contract error, not a host/invoke error");
    assert_eq!(
        err,
        soroban_sdk::Error::from_contract_error(expected as u32)
    );
}

#[test]
fn record_then_read_back() {
    let env = Env::default();
    let (registry_id, organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);
    let h = hash(&env, 1);

    let record = client.record(&organizer, &symbol_short!("evt_a"), &team, &h, &cid(&env));

    assert_eq!(record.hash, h);
    assert_eq!(record.event_id, symbol_short!("evt_a"));
    assert_eq!(record.team, team);
    assert_eq!(record.timestamp, 1_772_000_000);
    assert_eq!(record.ledger, 100);

    let got = client.get_submission(&h);
    assert_eq!(got.hash, h);
    assert_eq!(client.get_submission_history(&h).len(), 1);
    assert_eq!(client.get_submissions_by_team(&team).len(), 1);
}

#[test]
fn duplicate_hash_in_same_event_is_rejected() {
    let env = Env::default();
    let (registry_id, organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);
    let h = hash(&env, 2);
    let event = symbol_short!("evt_a");

    client.record(&organizer, &event, &team, &h, &cid(&env));

    // The exact same hash in the same event must fail — trustless rejection.
    let res = client.try_record(&organizer, &event, &team, &h, &cid(&env));
    assert_contract_error(res, Error::DuplicateSubmission);
}

#[test]
fn same_hash_across_different_events_succeeds() {
    let env = Env::default();
    let (registry_id, organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);
    let h = hash(&env, 3);

    client.record(&organizer, &symbol_short!("evt_a"), &team, &h, &cid(&env));
    client.record(&organizer, &symbol_short!("evt_b"), &team, &h, &cid(&env));

    let history = client.get_submission_history(&h);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().event_id, symbol_short!("evt_a"));
    assert_eq!(history.get(1).unwrap().event_id, symbol_short!("evt_b"));
}

#[test]
fn unauthorized_address_cannot_record() {
    let env = Env::default();
    let (registry_id, _organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);
    let stranger = Address::generate(&env);
    let h = hash(&env, 4);

    // mock_all_auths is active, so require_auth() passes — the rejection
    // must come from the organizer-authorization check, not auth.
    let res = client.try_record(&stranger, &symbol_short!("evt_a"), &team, &h, &cid(&env));
    assert_contract_error(res, Error::NotAuthorizedOrganizer);
}

#[test]
fn organizer_of_one_event_cannot_record_into_another() {
    let env = Env::default();
    let (registry_id, _organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);
    let event_registry = client.get_event_registry();
    let event_client = EventRegistryClient::new(&env, &event_registry);

    let admin = event_client.get_admin();
    let other_organizer = Address::generate(&env);
    event_client.add_organizer(&admin, &symbol_short!("evt_b"), &other_organizer);

    let h = hash(&env, 5);
    // Authorized for evt_b only — must not be able to record into evt_a.
    let res = client.try_record(
        &other_organizer,
        &symbol_short!("evt_a"),
        &team,
        &h,
        &cid(&env),
    );
    assert_contract_error(res, Error::NotAuthorizedOrganizer);
}

#[test]
fn team_index_tracks_all_submissions() {
    let env = Env::default();
    let (registry_id, organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);

    for i in 0..3u8 {
        client.record(
            &organizer,
            &symbol_short!("evt_a"),
            &team,
            &hash(&env, 10 + i),
            &cid(&env),
        );
    }

    let records = client.get_submissions_by_team(&team);
    assert_eq!(records.len(), 3);
    assert_eq!(records.get(0).unwrap().hash, hash(&env, 10));
}

#[test]
fn event_index_tracks_submissions_per_event() {
    let env = Env::default();
    let (registry_id, organizer, team) = setup(&env);
    let client = SubmissionRegistryClient::new(&env, &registry_id);

    for i in 0..2u8 {
        client.record(
            &organizer,
            &symbol_short!("evt_a"),
            &team,
            &hash(&env, 20 + i),
            &cid(&env),
        );
    }
    client.record(
        &organizer,
        &symbol_short!("evt_b"),
        &team,
        &hash(&env, 22),
        &cid(&env),
    );

    let event_a = client.get_event_submissions(&symbol_short!("evt_a"));
    let event_b = client.get_event_submissions(&symbol_short!("evt_b"));
    assert_eq!(event_a.len(), 2);
    assert_eq!(event_b.len(), 1);
    assert_eq!(event_a.get(0).unwrap().hash, hash(&env, 20));
    assert_eq!(event_b.get(0).unwrap().event_id, symbol_short!("evt_b"));
}
