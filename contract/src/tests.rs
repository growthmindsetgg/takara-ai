//! Unit tests. The engine is mocked by feeding `on_engine` the exact byte shape OutLayer
//! delivers (a JSON string containing the engine's JSON), as observed on testnet in step 0.
#![allow(deprecated)]

use super::*;
use near_sdk::test_utils::{get_logs, testing_env_with_promise_results, VMContextBuilder};
use near_sdk::{testing_env, PromiseResult as SdkPromiseResult};

const H: &str = "1111111111111111111111111111111111111111111111111111111111111111";
const ENGINE_HASH: &str = "dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019";

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn treasury() -> AccountId {
    acc("treasury.testnet")
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn signer() -> AccountId {
    acc("signer.testnet")
}
fn signer2() -> AccountId {
    acc("signer2.testnet")
}
fn agent() -> AccountId {
    acc("agent.testnet")
}
fn token() -> AccountId {
    acc("tusdc.testnet")
}

fn ctx(predecessor: AccountId, deposit: u128) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(treasury())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(1_800_000_000_000_000_000);
    b
}

fn as_(who: AccountId) {
    testing_env!(ctx(who, 0).build());
}
fn as_with(who: AccountId, deposit: u128) {
    testing_env!(ctx(who, deposit).build());
}

fn setup() -> Treasury {
    as_(treasury()); // #[private] init: only the treasury account itself
    Treasury::new(
        vec![owner()],
        agent(),
        acc("outlayer.testnet"),
        PinnedEngine { wasm_url: "https://test.fastfs.io/x.wasm".into(), wasm_hash: ENGINE_HASH.into(), build_target: "wasm32-wasip1".into() },
        None,
        token(),
        PolicyHeader {
            version: 1,
            hash: H.into(),
            signers: vec![signer(), signer2()],
            threshold: 1,
            expires_at: U64(2_000_000_000_000_000_000),
            sealed: "c2VhbGVkcG9saWN5".into(),
        },
    )
}

/// Deliver an engine answer to the callback, exactly as OutLayer does (JSON-string encoded).
fn deliver(t: &mut Treasury, rq: u64, engine_json: Value) -> Decision {
    let bytes = serde_json::to_vec(&engine_json.to_string()).unwrap();
    testing_env_with_promise_results(ctx(treasury(), 0).build(), SdkPromiseResult::Successful(bytes));
    t.on_engine(U64(rq))
}

fn echo(t: &Treasury, rq: u64, c: Option<u64>) -> Value {
    json!({ "t": treasury(), "c": c, "ph": t.policy.hash, "ls": t.ledger_state_hash, "rq": rq })
}

fn claim_out(t: &Treasury, rq: u64, ev_byte: char, pr: &str, fl: u8) -> Value {
    json!({
        "v": 1, "op": "claim", "ok": true, "echo": echo(t, rq, None),
        "claim": { "ev": ev_byte.to_string().repeat(64), "ch": "2".repeat(64), "pr": pr, "vr": "vend-railway", "fl": fl, "sr": "c2VhbGVkcmVjb3Jk" }
    })
}

/// Register a claim through the full request/callback path; returns the commitment id.
fn register(t: &mut Treasury, ev_byte: char, pr: &str, fl: u8) -> Decision {
    as_with(agent(), 10);
    t.register_claim("c2VhbGVkY2xhaW0=".into());
    let rq = t.next_request - 1;
    let out = claim_out(t, rq, ev_byte, pr, fl);
    deliver(t, rq, out)
}

fn auth_out(t: &Treasury, rq: u64, cid: u64, amc: &str) -> Value {
    json!({
        "v": 1, "op": "authorize", "ok": true, "echo": echo(t, rq, Some(cid)),
        "auth": { "sch": "near", "dch": "near", "amc": amc, "dsc": "4".repeat(64), "mfc": "5".repeat(64), "sp": true,
                  "exp": 1_800_000_000_000_000_000u64 + 600_000_000_000, "op": "b3BlbmluZw==", "oa": "b3V0Zmxvdw==" }
    })
}

fn authorize(t: &mut Treasury, cid: u64) -> Decision {
    as_with(agent(), 10);
    t.request_authorization(U64(cid));
    let rq = t.next_request - 1;
    let out = auth_out(t, rq, cid, &"3".repeat(64));
    deliver(t, rq, out)
}

fn accept_by_signer(t: &mut Treasury, cid: u64) {
    as_(signer());
    t.accept_commitment(U64(cid));
}

// ---------------------------------------------------------------------------------------
// Authorities: the agent key is rejected by every policy, signer, vendor and pause path
// ---------------------------------------------------------------------------------------

#[test]
#[should_panic(expected = "E_NOT_POLICY_SIGNER")]
fn agent_cannot_rewrite_policy() {
    let mut t = setup();
    as_(agent());
    t.propose_policy(2, "9".repeat(64), U64(2_000_000_000_000_000_000), "c2VhbGVk".into(), "8".repeat(64));
}

#[test]
#[should_panic(expected = "E_NOT_POLICY_SIGNER")]
fn agent_cannot_approve_vendor_change() {
    let mut t = setup();
    register(&mut t, 'a', "normal", flags::DESTINATION_MISMATCH);
    as_(agent());
    t.approve_vendor_change(U64(0));
}

#[test]
#[should_panic(expected = "E_NOT_POLICY_SIGNER")]
fn agent_cannot_accept_commitment() {
    let mut t = setup();
    register(&mut t, 'a', "normal", 0);
    as_(agent());
    t.accept_commitment(U64(0));
}

#[test]
#[should_panic(expected = "E_NOT_POLICY_SIGNER")]
fn agent_cannot_downgrade() {
    let mut t = setup();
    register(&mut t, 'a', "discretionary", 0);
    accept_by_signer(&mut t, 0);
    as_(agent());
    t.downgrade_discretionary(U64(0));
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn agent_cannot_pause() {
    let mut t = setup();
    as_(agent());
    t.pause();
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn agent_cannot_withdraw() {
    let mut t = setup();
    as_with(agent(), 1);
    t.recover(U128(1), agent());
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn agent_cannot_add_signer() {
    let mut t = setup();
    as_with(agent(), 1);
    t.rotate_signers(vec![agent()], 1);
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn agent_cannot_repin_engine() {
    let mut t = setup();
    as_with(agent(), 1);
    t.set_engine(PinnedEngine { wasm_url: "https://evil/x.wasm".into(), wasm_hash: "f".repeat(64), build_target: "wasm32-wasip1".into() });
}

#[test]
#[should_panic(expected = "E_INVALID_ARGUMENT")]
fn owner_cannot_make_agent_a_signer() {
    let mut t = setup();
    as_with(owner(), 1);
    t.rotate_signers(vec![signer(), agent()], 1);
}

#[test]
#[should_panic(expected = "E_NOT_AGENT")]
fn signer_cannot_settle() {
    let mut t = setup();
    register(&mut t, 'a', "normal", 0);
    accept_by_signer(&mut t, 0);
    let auth = authorize(&mut t, 0).auth.unwrap();
    as_(signer());
    t.settle(auth);
}

// ---------------------------------------------------------------------------------------
// Ownership works with the agent offline
// ---------------------------------------------------------------------------------------

#[test]
fn owner_revokes_pauses_and_recovers_without_agent() {
    let mut t = setup();
    as_(token());
    t.ft_on_transfer(owner(), U128(1_000_000_000), String::new());
    as_(owner());
    t.revoke_agent();
    t.pause();
    as_with(owner(), 1);
    t.recover(U128(400_000_000), owner());
    assert_eq!(t.get_config().balance.0, 600_000_000);
    assert!(t.get_config().agent.is_none());
}

#[test]
#[should_panic(expected = "E_AGENT_REVOKED")]
fn revoked_agent_cannot_act() {
    let mut t = setup();
    as_(owner());
    t.revoke_agent();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
}

#[test]
#[should_panic(expected = "E_TREASURY_PAUSED")]
fn paused_blocks_agent() {
    let mut t = setup();
    as_(owner());
    t.pause();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
}

#[test]
#[should_panic(expected = "E_WRONG_ASSET")]
fn only_configured_asset_funds() {
    let mut t = setup();
    as_(acc("fake-usdc.testnet"));
    t.ft_on_transfer(owner(), U128(1), String::new());
}

#[test]
fn recovery_changes_ledger_state_but_funding_does_not() {
    let mut t = setup();
    let ls0 = t.ledger_state_hash.clone();
    as_(token());
    t.ft_on_transfer(owner(), U128(10), String::new());
    assert_eq!(ls0, t.ledger_state_hash, "funding cannot break a reserve check");
    as_with(owner(), 1);
    t.recover(U128(5), owner());
    assert_ne!(ls0, t.ledger_state_hash);
}

// ---------------------------------------------------------------------------------------
// Commitments
// ---------------------------------------------------------------------------------------

#[test]
fn claim_is_always_claimed_and_dedupes() {
    let mut t = setup();
    let d = register(&mut t, 'a', "normal", 0);
    assert!(d.ok);
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Claimed);
    let dup = register(&mut t, 'a', "normal", 0);
    assert!(!dup.ok);
    assert_eq!(dup.reason.as_deref(), Some("duplicate_evidence"));
    assert_eq!(dup.original, Some(U64(0)));
    assert_eq!(t.next_commitment, 1);
}

#[test]
fn destination_mismatch_suspends_and_signer_approves() {
    let mut t = setup();
    let d = register(&mut t, 'a', "normal", flags::DESTINATION_MISMATCH);
    assert_eq!(d.reason.as_deref(), Some("vendor_destination_mismatch"));
    let c = t.get_commitment(U64(0)).unwrap();
    assert_eq!(c.state, State::Claimed);
    let vc = t.get_vendor_change(c.vendor_change.unwrap()).unwrap();
    assert_eq!(vc.settlement_status, SettlementStatus::SuspendedDestinationMismatch);
    as_(signer());
    t.approve_vendor_change(U64(0));
    let vc = t.get_vendor_change(U64(0)).unwrap();
    assert_eq!(vc.settlement_status, SettlementStatus::ApprovedCoolingOff);
    assert_eq!(vc.decided_by, Some(signer()));
}

#[test]
fn engine_accept_and_refusal_paths() {
    let mut t = setup();
    register(&mut t, 'a', "normal", flags::PROVISIONAL_VENDOR);
    // Engine refuses (needs signer acceptance): no state change, reason surfaced.
    as_with(agent(), 10);
    t.request_acceptance(U64(0));
    let rq = t.next_request - 1;
    let out = json!({ "v":1, "op":"accept", "ok":false, "echo": echo(&t, rq, Some(0)), "reason":"would_break_commitments", "blocking":[7,8] });
    let d = deliver(&mut t, rq, out);
    assert_eq!(d.reason.as_deref(), Some("would_break_commitments"));
    assert_eq!(d.blocking, vec![U64(7), U64(8)]);
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Claimed);
    assert!(get_logs().iter().any(|l| l.contains("\"refusal\"")));
    // Engine accepts under policy.
    as_with(agent(), 10);
    t.request_acceptance(U64(0));
    let rq = t.next_request - 1;
    let out = json!({ "v":1, "op":"accept", "ok":true, "echo": echo(&t, rq, Some(0)) });
    assert!(deliver(&mut t, rq, out).ok);
    let c = t.get_commitment(U64(0)).unwrap();
    assert_eq!(c.state, State::Accepted);
    assert_eq!(c.accepted_by, Some(AcceptedBy::Policy));
}

#[test]
fn null_engine_output_is_an_error_not_approval() {
    let mut t = setup();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
    // OutLayer delivers `null` for a refused/failed run (observed in step 0).
    testing_env_with_promise_results(ctx(treasury(), 0).build(), SdkPromiseResult::Successful(b"null".to_vec()));
    let d = t.on_engine(U64(0));
    assert_eq!(d.reason.as_deref(), Some("engine_error"));
    assert_eq!(t.next_commitment, 0);
}

#[test]
fn engine_echo_must_match_context() {
    let mut t = setup();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
    let mut out = claim_out(&t, 0, 'a', "normal", 0);
    out["echo"]["ph"] = json!("9".repeat(64)); // engine evaluated a different policy
    let d = deliver(&mut t, 0, out);
    assert_eq!(d.reason.as_deref(), Some("engine_echo_mismatch"));
    assert_eq!(t.next_commitment, 0);
}

#[test]
fn engine_cannot_flag_unknown_bits_or_inject_reason() {
    let mut t = setup();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
    let out = claim_out(&t, 0, 'a', "normal", 0x80);
    assert_eq!(deliver(&mut t, 0, out).reason.as_deref(), Some("engine_output_invalid"));
}

#[test]
fn downgrade_only_discretionary_accepted() {
    let mut t = setup();
    register(&mut t, 'a', "discretionary", 0);
    accept_by_signer(&mut t, 0);
    as_(signer());
    t.downgrade_discretionary(U64(0));
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Claimed);
}

#[test]
#[should_panic(expected = "E_INVALID_TRANSITION")]
fn cannot_downgrade_critical() {
    let mut t = setup();
    register(&mut t, 'a', "critical", 0);
    accept_by_signer(&mut t, 0);
    as_(signer());
    t.downgrade_discretionary(U64(0));
}

#[test]
#[should_panic(expected = "E_INVALID_TRANSITION")]
fn signer_cannot_close_accepted_reservation() {
    let mut t = setup();
    register(&mut t, 'a', "critical", 0);
    accept_by_signer(&mut t, 0);
    as_(signer());
    t.close_commitment(U64(0));
}

// ---------------------------------------------------------------------------------------
// Settlement authorization
// ---------------------------------------------------------------------------------------

fn ready(t: &mut Treasury) -> SettlementAuth {
    register(t, 'a', "normal", 0);
    accept_by_signer(t, 0);
    authorize(t, 0).auth.unwrap()
}

#[test]
fn settle_then_replay_is_nonce_used() {
    let mut t = setup();
    let auth = ready(&mut t);
    as_(agent());
    let d = t.settle(auth.clone());
    assert!(d.ok, "{:?}", d.reason);
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Settled);
    assert_eq!(t.sealed_outflow, "b3V0Zmxvdw==");
    let again = t.settle(auth);
    assert_eq!(again.reason.as_deref(), Some("nonce_used"));
}

#[test]
fn altered_amount_is_authorization_mismatch() {
    let mut t = setup();
    let mut auth = ready(&mut t);
    auth.amount_commit = "6".repeat(64);
    as_(agent());
    let d = t.settle(auth);
    assert_eq!(d.reason.as_deref(), Some("authorization_mismatch"));
    assert_eq!(d.field.as_deref(), Some("amount_commit"));
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Accepted);
}

#[test]
fn authorization_for_one_payment_cannot_settle_another() {
    let mut t = setup();
    let mut auth = ready(&mut t);
    auth.commitment_id = U64(1);
    as_(agent());
    assert_eq!(t.settle(auth).field.as_deref(), Some("commitment_id"));
}

#[test]
fn forged_authorization_is_unknown() {
    let mut t = setup();
    let mut auth = ready(&mut t);
    auth.nonce = "deadbeef".repeat(4);
    as_(agent());
    assert_eq!(t.settle(auth).reason.as_deref(), Some("unknown_authorization"));
}

#[test]
fn expired_authorization_dies() {
    let mut t = setup();
    let auth = ready(&mut t);
    let mut c = ctx(agent(), 0);
    c.block_timestamp(1_800_000_000_000_000_000 + 3_600_000_000_000);
    testing_env!(c.build());
    assert_eq!(t.settle(auth).reason.as_deref(), Some("authorization_expired"));
}

#[test]
fn ledger_change_after_authorization_makes_it_stale() {
    let mut t = setup();
    let auth = ready(&mut t);
    as_(token());
    t.ft_on_transfer(owner(), U128(10), String::new());
    as_with(owner(), 1);
    t.recover(U128(1), owner()); // balance reduced after the reserve check
    as_(agent());
    assert_eq!(t.settle(auth).reason.as_deref(), Some("ledger_state_stale"));
}

#[test]
fn repinning_engine_kills_outstanding_authorizations() {
    let mut t = setup();
    let auth = ready(&mut t);
    as_with(owner(), 1);
    t.set_engine(PinnedEngine { wasm_url: "https://test.fastfs.io/y.wasm".into(), wasm_hash: "e".repeat(64), build_target: "wasm32-wasip1".into() });
    as_(agent());
    assert_eq!(t.settle(auth).reason.as_deref(), Some("authorization_engine_changed"));
}

#[test]
fn authorization_ttl_is_capped() {
    let mut t = setup();
    register(&mut t, 'a', "normal", 0);
    accept_by_signer(&mut t, 0);
    as_with(agent(), 10);
    t.request_authorization(U64(0));
    let rq = t.next_request - 1;
    let mut out = auth_out(&t, rq, 0, &"3".repeat(64));
    out["auth"]["exp"] = json!(u64::MAX);
    let auth = deliver(&mut t, rq, out).auth.unwrap();
    assert_eq!(auth.expiry.0, 1_800_000_000_000_000_000 + MAX_AUTH_TTL_NS);
}

// ---------------------------------------------------------------------------------------
// Policy versions
// ---------------------------------------------------------------------------------------

#[test]
fn policy_threshold_and_rotation_drop_stale_approvals() {
    let mut t = setup();
    as_with(owner(), 1);
    t.rotate_signers(vec![signer(), signer2()], 2);
    as_(signer());
    let id = t.propose_policy(2, "9".repeat(64), U64(2_000_000_000_000_000_000), "c2VhbGVk".into(), "8".repeat(64));
    assert_eq!(t.policy.version, 1);
    // signer is removed; their approval must no longer count.
    as_with(owner(), 1);
    t.rotate_signers(vec![signer2(), acc("signer3.testnet")], 2);
    as_(signer2());
    assert!(!t.approve_policy(id));
    as_(acc("signer3.testnet"));
    assert!(t.approve_policy(id));
    assert_eq!(t.policy.version, 2);
    assert_eq!(t.policy.hash, "9".repeat(64));
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn agent_cannot_reconcile_outflow() {
    let mut t = setup();
    as_with(agent(), 1);
    t.reconcile_outflow(String::new());
}

#[test]
fn in_flight_answer_after_repin_is_refused() {
    let mut t = setup();
    register(&mut t, 'a', "normal", 0);
    accept_by_signer(&mut t, 0);
    as_with(agent(), 10);
    t.request_authorization(U64(0));
    let rq = t.next_request - 1;
    let out = auth_out(&t, rq, 0, &"3".repeat(64));
    as_with(owner(), 1);
    t.set_engine(PinnedEngine { wasm_url: "https://test.fastfs.io/y.wasm".into(), wasm_hash: "e".repeat(64), build_target: "wasm32-wasip1".into() });
    // the answer was computed against the old ledger and the old engine: refused either way
    let d = deliver(&mut t, rq, out);
    assert!(!d.ok);
    assert!(t.issued.get(&t.pending.get(&rq).map(|p| p.nonce.clone().unwrap()).unwrap_or_default()).is_none());
}

#[test]
fn in_flight_answer_after_agent_change_is_refused() {
    let mut t = setup();
    as_with(agent(), 10);
    t.register_claim("c2VhbGVk".into());
    let rq = t.next_request - 1;
    let mut out = claim_out(&t, rq, 'a', "normal", 0);
    as_(owner());
    t.set_agent(acc("agent2.testnet"));
    out["echo"]["ls"] = json!(t.ledger_state_hash); // even with a fresh echo, the requester changed
    let d = deliver(&mut t, rq, out);
    assert!(!d.ok);
    assert_eq!(t.next_commitment, 0);
}

#[test]
fn downgrade_marks_commitment_signer_only() {
    let mut t = setup();
    register(&mut t, 'a', "discretionary", 0);
    accept_by_signer(&mut t, 0);
    as_(signer());
    t.downgrade_discretionary(U64(0));
    assert_eq!(t.get_commitment(U64(0)).unwrap().flags & flags::DOWNGRADED, flags::DOWNGRADED);
}

#[test]
fn reject_vendor_change_never_releases_an_accepted_reservation() {
    let mut t = setup();
    register(&mut t, 'a', "normal", flags::DESTINATION_MISMATCH);
    accept_by_signer(&mut t, 0);
    as_(signer());
    t.reject_vendor_change(U64(0));
    assert_eq!(t.get_commitment(U64(0)).unwrap().state, State::Accepted);
}

#[test]
fn settled_plain_commitments_leave_the_engine_input() {
    let mut t = setup();
    let auth = ready(&mut t);
    assert!(t.open.contains(&0));
    as_(agent());
    assert!(t.settle(auth).ok);
    assert!(!t.open.contains(&0));
}
