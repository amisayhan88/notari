#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, vec, Address, Env, String};
use soroban_sdk::testutils::Ledger as _;

fn setup<'a>(env: &Env) -> (Address, EventRegistryClient<'a>) {
    let admin = Address::generate(env);
    let contract_id = env.register(EventRegistry, ());
    let client = EventRegistryClient::new(env, &contract_id);
    env.mock_all_auths();
    client.init(&admin);
    env.ledger().with_mut(|li| li.timestamp = 1_772_000_000);
    (admin, client)
}

/// Unwraps a try_* result and asserts the contract error code.
fn assert_contract_error<T: core::fmt::Debug>(
    res: Result<
        Result<T, soroban_sdk::ConversionError>,
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
fn self_registration_creates_event() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let event = symbol_short!("evt_a");

    let info = client.create_event(
        &organizer,
        &event,
        &String::from_str(&env, "Hack4Bengal 2026"),
        &organizer,
    );

    assert_eq!(info.event_id, event);
    assert_eq!(info.created_by, organizer);
    assert_eq!(info.created_at, 1_772_000_000);
    assert!(client.is_authorized_organizer(&event, &organizer));
    assert_eq!(client.get_events(), vec![&env, event.clone()]);
    assert_eq!(client.get_event(&event).name, String::from_str(&env, "Hack4Bengal 2026"));
}

#[test]
fn admin_can_register_event_for_someone_else() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let event = symbol_short!("evt_b");

    client.create_event(&admin, &event, &String::from_str(&env, "FIEM ACM"), &organizer);
    assert!(client.is_authorized_organizer(&event, &organizer));
    // The admin is NOT automatically an organizer.
    assert!(!client.is_authorized_organizer(&event, &admin));
}

#[test]
fn non_admin_cannot_register_event_for_someone_else() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let caller = Address::generate(&env);
    let other = Address::generate(&env);

    // mock_all_auths is active — require_auth passes; the rejection must
    // come from the impersonation rule.
    let res = client.try_create_event(
        &caller,
        &symbol_short!("evt_c"),
        &String::from_str(&env, "Impersonated"),
        &other,
    );
    assert_contract_error(res, Error::NotAuthorized);
}

#[test]
fn duplicate_event_id_is_rejected() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let event = symbol_short!("evt_a");

    client.create_event(&organizer, &event, &String::from_str(&env, "One"), &organizer);
    let res = client.try_create_event(
        &organizer,
        &event,
        &String::from_str(&env, "Two"),
        &organizer,
    );
    assert_contract_error(res, Error::EventAlreadyExists);
}

#[test]
fn organizer_can_invite_co_organizer() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let co = Address::generate(&env);
    let event = symbol_short!("evt_a");

    client.create_event(&organizer, &event, &String::from_str(&env, "E"), &organizer);
    // Non-admin organizer adds a co-organizer.
    client.add_organizer(&organizer, &event, &co);
    assert!(client.is_authorized_organizer(&event, &co));
}

#[test]
fn stranger_cannot_manage_roster() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let stranger = Address::generate(&env);
    let event = symbol_short!("evt_a");

    client.create_event(&organizer, &event, &String::from_str(&env, "E"), &organizer);
    let res = client.try_add_organizer(&stranger, &event, &stranger);
    assert_contract_error(res, Error::NotAuthorized);
}

#[test]
fn remove_organizer_revokes_access_but_keeps_last_one() {
    let env = Env::default();
    let (admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let co = Address::generate(&env);
    let event = symbol_short!("evt_a");

    client.create_event(&organizer, &event, &String::from_str(&env, "E"), &organizer);
    client.add_organizer(&organizer, &event, &co);

    client.remove_organizer(&admin, &event, &co);
    assert!(!client.is_authorized_organizer(&event, &co));

    // The last organizer cannot be removed.
    let res = client.try_remove_organizer(&admin, &event, &organizer);
    assert_contract_error(res, Error::CannotRemoveLastOrganizer);
}

#[test]
fn organizer_is_scoped_to_their_event() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);
    let event_a = symbol_short!("evt_a");
    let event_b = symbol_short!("evt_b");

    client.create_event(&organizer, &event_a, &String::from_str(&env, "A"), &organizer);
    assert!(client.is_authorized_organizer(&event_a, &organizer));
    assert!(!client.is_authorized_organizer(&event_b, &organizer));
}

#[test]
fn get_events_tracks_creation_order() {
    let env = Env::default();
    let (_admin, client) = setup(&env);
    let organizer = Address::generate(&env);

    client.create_event(&organizer, &symbol_short!("evt_a"), &String::from_str(&env, "A"), &organizer);
    client.create_event(&organizer, &symbol_short!("evt_b"), &String::from_str(&env, "B"), &organizer);

    assert_eq!(
        client.get_events(),
        vec![&env, symbol_short!("evt_a"), symbol_short!("evt_b")]
    );
}
