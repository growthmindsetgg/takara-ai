//! Events (NEP-297) and reason codes.
//!
//! Authority violations panic with an `E_*` code so the transaction visibly fails (NEAR drops
//! logs from a failed receipt, so the failed transaction itself is the record). Business
//! refusals do not panic: they return a `Decision` and emit a `refusal` event.

use near_sdk::log;
use near_sdk::serde_json::{json, Value};

pub const STANDARD: &str = "takara-ai";
pub const VERSION: &str = "1.0.0";

pub fn emit(event: &str, data: Value) {
    log!(
        "EVENT_JSON:{}",
        json!({ "standard": STANDARD, "version": VERSION, "event": event, "data": [data] })
    );
}

/// Authority errors (transaction fails).
pub mod err {
    pub const NOT_OWNER: &str = "E_NOT_OWNER";
    pub const NOT_POLICY_SIGNER: &str = "E_NOT_POLICY_SIGNER";
    pub const NOT_AGENT: &str = "E_NOT_AGENT";
    pub const AGENT_REVOKED: &str = "E_AGENT_REVOKED";
    pub const PAUSED: &str = "E_TREASURY_PAUSED";
    pub const ONE_YOCTO: &str = "E_REQUIRES_ONE_YOCTO";
    pub const DEPOSIT_REQUIRED: &str = "E_ENGINE_DEPOSIT_REQUIRED";
    pub const NOT_FOUND: &str = "E_NOT_FOUND";
    pub const INVALID_TRANSITION: &str = "E_INVALID_TRANSITION";
    pub const INVALID_ARGUMENT: &str = "E_INVALID_ARGUMENT";
    pub const ALREADY_APPROVED: &str = "E_ALREADY_APPROVED";
    pub const WRONG_ASSET: &str = "E_WRONG_ASSET";
    pub const INSUFFICIENT_BALANCE: &str = "E_INSUFFICIENT_BALANCE";
    pub const POLICY_EXPIRED: &str = "E_POLICY_EXPIRED";
    pub const TOO_MANY_OPEN: &str = "E_TOO_MANY_OPEN_COMMITMENTS";
}

/// Business refusal reasons (transaction succeeds, decision says no).
pub mod reason {
    pub const WOULD_BREAK_COMMITMENTS: &str = "would_break_commitments";
    pub const DUPLICATE_EVIDENCE: &str = "duplicate_evidence";
    pub const NONCE_USED: &str = "nonce_used";
    pub const UNKNOWN_AUTHORIZATION: &str = "unknown_authorization";
    pub const AUTHORIZATION_MISMATCH: &str = "authorization_mismatch";
    pub const AUTHORIZATION_EXPIRED: &str = "authorization_expired";
    pub const ENGINE_CHANGED: &str = "authorization_engine_changed";
    pub const POLICY_HASH_STALE: &str = "policy_hash_stale";
    pub const LEDGER_STATE_STALE: &str = "ledger_state_stale";
    pub const COMMITMENT_NOT_ACCEPTED: &str = "commitment_not_accepted";
    pub const COMMITMENT_NOT_CLAIMED: &str = "commitment_not_claimed";
    pub const SPENDABLE_NOT_ASSERTED: &str = "spendable_not_asserted";
    pub const ENGINE_ERROR: &str = "engine_error";
    pub const ENGINE_ECHO_MISMATCH: &str = "engine_echo_mismatch";
    pub const ENGINE_OUTPUT_INVALID: &str = "engine_output_invalid";
    pub const TREASURY_PAUSED: &str = "treasury_paused";
    pub const POLICY_EXPIRED: &str = "policy_expired";
    pub const AGENT_CHANGED: &str = "agent_changed";
}
