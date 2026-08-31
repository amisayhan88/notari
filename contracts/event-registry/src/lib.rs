#![no_std]

//! event-registry — organizer RBAC + event registration for hackathons.
//!
//! Maps Stellar addresses to the events they are authorized to organize
//! (e.g. "hack4bengal_2026", "fiem_acm_hackathon"). submission-registry
//! calls `is_authorized_organizer` before recording anything.
//!
//! TRUSTLESS LAYER: this contract is the on-chain source of truth for
//! (a) which events exist, (b) who organizes them.
//!
//! Registration model:
//! - Anyone may create a NEW event via `create_event`. A non-admin creator
//!   can only register THEMSELVES as the first organizer (no gatekeeping,
//!   no impersonation); the admin may register any organizer on anyone's
//!   behalf (used for sponsored/app-mediated flows).
//! - Existing organizers of an event may add/remove co-organizers; the
//!   admin may do so for any event.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
    Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAdmin = 3,
    OrganizerNotFound = 4,
    EventAlreadyExists = 5,
    NotAuthorized = 6,
    CannotRemoveLastOrganizer = 7,
}

/// On-chain event metadata.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInfo {
    pub event_id: Symbol,
    pub name: String,
    pub created_by: Address,
    pub created_at: u64,
}

/// Published whenever a new event is registered.
#[contractevent]
#[derive(Clone, Debug)]
pub struct EventCreated {
    #[topic]
    pub event_id: Symbol,
    pub first_organizer: Address,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Organizers(Symbol),
    EventMeta(Symbol),
    /// Every registered event id, in creation order.
    Events,
}

#[contract]
pub struct EventRegistry;

#[contractimpl]
impl EventRegistry {
    /// One-time init. `admin` manages organizers across all events and may
    /// register events on behalf of others.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            env.panic_with_error(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Register a NEW event.
    ///
    /// - `caller` must authenticate.
    /// - Non-admin callers may only install THEMSELVES as the first
    ///   organizer (self-registration — no impersonation).
    /// - The admin caller may install any `first_organizer` (sponsored flow).
    /// - Fails with `EventAlreadyExists` if the event id is taken.
    pub fn create_event(
        env: Env,
        caller: Address,
        event_id: Symbol,
        name: String,
        first_organizer: Address,
    ) -> EventInfo {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| env.panic_with_error(Error::NotInitialized));

        if env.storage().persistent().has(&DataKey::EventMeta(event_id.clone())) {
            env.panic_with_error(Error::EventAlreadyExists);
        }
        if caller != admin && caller != first_organizer {
            // Self-registration only: you can't create an event for someone
            // else unless you are the admin.
            env.panic_with_error(Error::NotAuthorized);
        }

        let info = EventInfo {
            event_id: event_id.clone(),
            name,
            created_by: caller,
            created_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::EventMeta(event_id.clone()), &info);

        let mut organizers: Vec<Address> = Vec::new(&env);
        organizers.push_back(first_organizer.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Organizers(event_id.clone()), &organizers);

        let mut events: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&DataKey::Events)
            .unwrap_or(Vec::new(&env));
        events.push_back(event_id.clone());
        env.storage().persistent().set(&DataKey::Events, &events);

        EventCreated {
            event_id,
            first_organizer,
        }
        .publish(&env);

        info
    }

    /// Add `organizer` to `event_id`. Allowed for the admin or any existing
    /// organizer of the event (co-organizer invites).
    pub fn add_organizer(env: Env, caller: Address, event_id: Symbol, organizer: Address) {
        caller.require_auth();
        require_manage_rights(&env, &caller, &event_id);
        let mut organizers = read_organizers(&env, &event_id);
        if !organizers.contains(&organizer) {
            organizers.push_back(organizer);
            env.storage()
                .persistent()
                .set(&DataKey::Organizers(event_id), &organizers);
        }
    }

    /// Remove `organizer` from `event_id`. Admin or existing organizer.
    /// The last organizer cannot be removed — an event always keeps at
    /// least one accountable organizer.
    pub fn remove_organizer(env: Env, caller: Address, event_id: Symbol, organizer: Address) {
        caller.require_auth();
        require_manage_rights(&env, &caller, &event_id);
        let organizers = read_organizers(&env, &event_id);
        if organizers.len() <= 1 {
            env.panic_with_error(Error::CannotRemoveLastOrganizer);
        }
        let mut next: Vec<Address> = Vec::new(&env);
        for o in organizers.iter() {
            if o != organizer {
                next.push_back(o);
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::Organizers(event_id), &next);
    }

    /// Read-only check used by submission-registry and the app RBAC gates.
    pub fn is_authorized_organizer(env: Env, event_id: Symbol, organizer: Address) -> bool {
        read_organizers(&env, &event_id).contains(&organizer)
    }

    /// Read-only: every organizer for an event.
    pub fn get_organizers(env: Env, event_id: Symbol) -> Vec<Address> {
        read_organizers(&env, &event_id)
    }

    /// Read-only: event metadata (None-equivalent: panics if unknown).
    pub fn get_event(env: Env, event_id: Symbol) -> EventInfo {
        env.storage()
            .persistent()
            .get(&DataKey::EventMeta(event_id))
            .unwrap_or_else(|| env.panic_with_error(Error::OrganizerNotFound))
    }

    /// Read-only: all registered event ids, in creation order.
    pub fn get_events(env: Env) -> Vec<Symbol> {
        env.storage()
            .persistent()
            .get(&DataKey::Events)
            .unwrap_or(Vec::new(&env))
    }

    /// Read-only: current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| env.panic_with_error(Error::NotInitialized))
    }
}

fn read_organizers(env: &Env, event_id: &Symbol) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::Organizers(event_id.clone()))
        .unwrap_or(Vec::new(env))
}

/// Admin or an existing organizer of this event may manage its roster.
fn require_manage_rights(env: &Env, caller: &Address, event_id: &Symbol) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| env.panic_with_error(Error::NotInitialized));
    if caller == &admin {
        return;
    }
    if !read_organizers(env, event_id).contains(caller) {
        env.panic_with_error(Error::NotAuthorized);
    }
}

#[cfg(test)]
mod test;
