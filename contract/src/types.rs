//! Public, on-chain types. Nothing here carries an amount, a vendor name, a payee address or
//! policy contents in readable form: those live only inside sealed blobs that the pinned engine
//! (and the business owner) can open.

use near_sdk::json_types::U64;
use near_sdk::{near, AccountId};

pub type CommitmentId = u64;

/// Commitment lifecycle. Only `Accepted` reserves funds. There is no delete.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Claimed,
    Accepted,
    Settled,
    Closed,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Critical,
    High,
    Normal,
    Discretionary,
}

/// Who moved a commitment to `Accepted`.
#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum AcceptedBy {
    /// A policy signer, by signature.
    Signer(AccountId),
    /// The pinned engine, inside the signed policy's auto-accept limits.
    Policy,
}

/// Commitment flag bits (set by the engine, never by the agent).
pub mod flags {
    /// First-time vendor below `new_vendor_auto_limit`: destination is a one-time claim.
    pub const PROVISIONAL_VENDOR: u8 = 1;
    /// First-time vendor above the limit: needs one signer acceptance, which verifies the vendor.
    pub const NEW_VENDOR_OVER_LIMIT: u8 = 2;
    /// Document text looked like an instruction. It was ignored and recorded.
    pub const INJECTION_FLAGGED: u8 = 4;
    /// Invoice destination differs from the verified vendor destination.
    pub const DESTINATION_MISMATCH: u8 = 8;
    /// Set by the contract (never the engine) when a signer preempts a discretionary commitment;
    /// from then on only a signer may accept it again.
    pub const DOWNGRADED: u8 = 16;
    /// Flags the engine may set.
    pub const ENGINE_MASK: u8 = 0x0f;
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct AttestationRef {
    /// The engine request number in this contract.
    pub request_no: U64,
    /// sha256 of the exact bytes the callback received. Equals OutLayer's attested `output_hash`,
    /// so anyone can look up the hardware attestation for this decision.
    pub output_hash: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Commitment {
    pub id: U64,
    pub state: State,
    pub priority: Priority,
    /// Keyed hash of the source document (keyed so a guessed document cannot be confirmed).
    /// Unique: this is what rejects duplicates.
    pub evidence_hash: String,
    /// Hash of the private commitment fields (vendor, amount, token, due date, recurrence, salt).
    pub commitment_hash: String,
    /// Opaque, non-reversible vendor reference.
    pub vendor_ref: String,
    pub flags: u8,
    /// Private commitment record, sealed by the engine. Opaque on-chain.
    pub sealed: String,
    pub attestation: AttestationRef,
    pub created_at: U64,
    pub accepted_by: Option<AcceptedBy>,
    pub vendor_change: Option<U64>,
    pub settled_nonce: Option<String>,
}

/// A detected change of payout destination for an already verified vendor.
/// The commitment stays `Claimed`; this record carries the settlement status, so no fifth
/// commitment state exists.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SettlementStatus {
    SuspendedDestinationMismatch,
    /// A policy signer approved the change; the engine still enforces `cooling_off_hours`.
    ApprovedCoolingOff,
    Rejected,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct VendorChange {
    pub id: U64,
    pub commitment_id: U64,
    pub vendor_ref: String,
    pub settlement_status: SettlementStatus,
    pub requested_at: U64,
    pub decided_by: Option<AccountId>,
    pub decided_at: Option<U64>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PinnedEngine {
    pub wasm_url: String,
    /// Lowercase hex sha256 of the engine wasm. OutLayer refuses any other bytes.
    pub wasm_hash: String,
    pub build_target: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct SecretsRef {
    pub profile: String,
    pub account_id: AccountId,
}

/// Public policy header. The full policy is the sealed blob; only its hash is meaningful here.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PolicyHeader {
    pub version: u32,
    /// sha256 (hex) of the plaintext policy bundle (policy + vendor registry + roster).
    pub hash: String,
    pub signers: Vec<AccountId>,
    pub threshold: u8,
    /// Nanoseconds since epoch.
    pub expires_at: U64,
    /// Policy bundle sealed to the engine key. Opaque on-chain.
    pub sealed: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PolicyProposal {
    pub id: u32,
    pub version: u32,
    pub hash: String,
    pub expires_at: U64,
    pub sealed: String,
    /// sha256 of the JSON diff the signers reviewed. The diff itself stays off-chain (policy
    /// contents are private); the hash makes the reviewed diff auditable by the owner.
    pub diff_hash: String,
    pub proposer: AccountId,
    pub approvals: Vec<AccountId>,
    pub applied: bool,
}

/// Settlement authorization: produced by the pinned engine, recorded by this contract's own
/// callback, verified field by field at settlement. Amount, destination and fee are salted
/// commitments, never plaintext.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SettlementAuth {
    pub treasury_id: AccountId,
    pub commitment_id: U64,
    pub asset_id: AccountId,
    pub source: AccountId,
    pub source_chain: String,
    pub destination_chain: String,
    pub amount_commit: String,
    pub destination_commit: String,
    pub max_fee_commit: String,
    pub policy_hash: String,
    pub policy_version: u32,
    pub ledger_state_hash: String,
    pub spendable_after_ok: bool,
    pub engine_hash: String,
    pub nonce: String,
    /// Nanoseconds since epoch.
    pub expiry: U64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct IssuedAuth {
    pub auth: SettlementAuth,
    /// The opening (amount, destination, fee, salt) sealed to the agent's payout key, so the
    /// payout leg can be checked against this authorization off-chain.
    pub opening: String,
    /// Sealed settled-outflow total that becomes current if this authorization settles.
    pub outflow_after: String,
    pub issued_at: U64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Op {
    Claim,
    Accept,
    Authorize,
}

impl Op {
    pub fn as_str(&self) -> &'static str {
        match self {
            Op::Claim => "claim",
            Op::Accept => "accept",
            Op::Authorize => "authorize",
        }
    }
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PendingRequest {
    pub op: Op,
    pub commitment_id: Option<U64>,
    pub policy_hash: String,
    pub ledger_state_hash: String,
    /// The engine build this request named. An answer is only applied if it is still pinned.
    pub engine_hash: String,
    pub nonce: Option<String>,
    pub requested_by: AccountId,
    pub requested_at: U64,
}

/// The result of every decision path: approvals and refusals alike carry a machine-readable
/// reason, and every one is also emitted as an event.
#[near(serializers = [json])]
#[derive(Clone, Debug, Default)]
pub struct Decision {
    pub ok: bool,
    pub op: String,
    pub reason: Option<String>,
    pub commitment_id: Option<U64>,
    pub blocking: Vec<U64>,
    pub until: Option<U64>,
    pub original: Option<U64>,
    pub field: Option<String>,
    pub auth: Option<SettlementAuth>,
    pub opening: Option<String>,
    /// Private refusal detail (for example the shortfall), sealed to the owner. Opaque on-chain.
    pub detail: Option<String>,
}

impl Decision {
    pub fn ok(op: &str) -> Self {
        Self { ok: true, op: op.to_string(), ..Default::default() }
    }
    pub fn refuse(op: &str, reason: &str) -> Self {
        Self { ok: false, op: op.to_string(), reason: Some(reason.to_string()), ..Default::default() }
    }
    pub fn with_commitment(mut self, id: CommitmentId) -> Self {
        self.commitment_id = Some(U64(id));
        self
    }
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub owners: Vec<AccountId>,
    pub agent: Option<AccountId>,
    pub paused: bool,
    pub engine: PinnedEngine,
    pub secrets: Option<SecretsRef>,
    pub outlayer: AccountId,
    pub asset: AccountId,
    pub balance: near_sdk::json_types::U128,
    pub policy_version: u32,
    pub policy_hash: String,
    pub signers: Vec<AccountId>,
    pub threshold: u8,
    pub policy_expires_at: U64,
    pub ledger_state_hash: String,
    pub commitments: U64,
}
