//! Takara AI treasury contract (NEAR testnet).
//!
//! The business owns this contract and its funds. Takara (the agent) holds execution authority
//! only: it can ask the pinned policy engine for a decision and settle what the engine
//! authorized. Three authorities, checked separately:
//!
//! | Authority | Holder             | Can                                                         |
//! |-----------|--------------------|-------------------------------------------------------------|
//! | Ownership | `owners`           | revoke/set agent, pause, recover funds, pin engine, rotate signers |
//! | Policy    | `policy.signers`   | approve policy versions, accept/close/downgrade commitments, decide vendor changes |
//! | Execution | `agent`            | register claims, request acceptance/authorization, settle  |
//!
//! Trust root: this contract believes only answers to its own `outlayer.testnet` requests, which
//! name the pinned wasm sha256 (OutLayer refuses any other bytes). Every answer's exact bytes are
//! hashed and stored; that hash equals OutLayer's attested `output_hash`, so the Intel TDX
//! attestation for each decision can be verified off-chain by anyone.
//!
//! The contract stores hashes, states and sealed blobs, never plaintext amounts, vendor names,
//! payee addresses or policy contents. It does not redo the reserve arithmetic: it verifies that
//! the pinned engine asserted `spendable_after >= 0` against the current ledger state hash.

mod events;
pub mod types;

#[cfg(test)]
mod tests;

use events::{emit, err, reason};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, IterableSet, LookupMap, LookupSet};
use near_sdk::{
    env, near, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
};
use types::*;

const GAS_FOR_OUTLAYER: Gas = Gas::from_tgas(140);
const GAS_FOR_ENGINE_CALLBACK: Gas = Gas::from_tgas(60);
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(20);
const GAS_FOR_RECOVER_CALLBACK: Gas = Gas::from_tgas(15);
/// Hard cap on authorization lifetime, whatever the engine asks for.
const MAX_AUTH_TTL_NS: u64 = 30 * 60 * 1_000_000_000;
const MAX_SEALED_LEN: usize = 24 * 1024;
/// Open commitments the engine evaluates on every request.
const MAX_OPEN: u32 = 200;
/// OutLayer caps stdout at 900 bytes; the JSON-string encoding adds escapes.
const MAX_ENGINE_OUTPUT: usize = 4 * 1024;

/// Storage prefixes, versioned so a re-initialised deployment never reads an earlier layout's
/// entries as its own.
#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    V2Owners,
    V2Proposals,
    V2Commitments,
    V2EvidenceIndex,
    V2VendorChanges,
    V2Pending,
    V2Issued,
    V2UsedNonces,
    V2Open,
}

impl StorageKey {
    fn prefix(self) -> Vec<u8> {
        let tag: &[u8] = match self {
            StorageKey::V2Owners => b"v2o",
            StorageKey::V2Proposals => b"v2p",
            StorageKey::V2Commitments => b"v2c",
            StorageKey::V2EvidenceIndex => b"v2e",
            StorageKey::V2VendorChanges => b"v2v",
            StorageKey::V2Pending => b"v2q",
            StorageKey::V2Issued => b"v2i",
            StorageKey::V2UsedNonces => b"v2n",
            StorageKey::V2Open => b"v2s",
        };
        tag.to_vec()
    }
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Treasury {
    // Ownership
    owners: IterableSet<AccountId>,
    agent: Option<AccountId>,
    paused: bool,
    engine: PinnedEngine,
    secrets: Option<SecretsRef>,
    outlayer: AccountId,
    asset: AccountId,
    balance: u128,
    /// Running total of settled-but-not-withdrawn amounts, sealed by the engine. Testnet
    /// settlement moves no tokens, so the engine subtracts this from `balance`. Replaced at each
    /// settlement by the value the engine computed when it issued that authorization.
    sealed_outflow: String,
    // Policy
    policy: PolicyHeader,
    proposals: IterableMap<u32, PolicyProposal>,
    next_proposal: u32,
    // Commitments
    commitments: IterableMap<CommitmentId, Commitment>,
    evidence_index: LookupMap<String, CommitmentId>,
    /// Commitments the engine still needs to see (bounded by MAX_OPEN): claimed, accepted, and
    /// settled ones that carry vendor history.
    open: IterableSet<CommitmentId>,
    next_commitment: CommitmentId,
    ledger_state_hash: String,
    // Vendor changes
    vendor_changes: IterableMap<u64, VendorChange>,
    next_vendor_change: u64,
    // Engine requests and authorizations
    pending: LookupMap<u64, PendingRequest>,
    next_request: u64,
    issued: LookupMap<String, IssuedAuth>,
    used_nonces: LookupSet<String>,
}

// ---------- engine output (compact keys: OutLayer caps stdout at 900 bytes) ----------

#[near(serializers = [json])]
struct EngineEcho {
    t: AccountId,
    #[serde(default)]
    c: Option<u64>,
    ph: String,
    ls: String,
    rq: u64,
}

#[near(serializers = [json])]
struct EngineClaim {
    ev: String,
    ch: String,
    pr: Priority,
    vr: String,
    fl: u8,
    sr: String,
}

#[near(serializers = [json])]
struct EngineAuth {
    sch: String,
    dch: String,
    amc: String,
    dsc: String,
    mfc: String,
    sp: bool,
    exp: u64,
    op: String,
    /// Sealed settled-outflow total after this payment.
    oa: String,
}

#[near(serializers = [json])]
struct EngineOut {
    v: u8,
    op: String,
    ok: bool,
    echo: EngineEcho,
    #[serde(default)]
    reason: Option<String>,
    #[serde(default)]
    blocking: Vec<u64>,
    #[serde(default)]
    until: Option<u64>,
    #[serde(default)]
    detail: Option<String>,
    #[serde(default)]
    claim: Option<EngineClaim>,
    #[serde(default)]
    auth: Option<EngineAuth>,
}

// ---------- helpers ----------

fn fail(code: &str) -> ! {
    env::panic_str(code)
}

fn hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0xf) as usize] as char);
    }
    s
}

fn is_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn is_reason_code(s: &str) -> bool {
    !s.is_empty() && s.len() <= 48 && s.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
}

fn is_short_token(s: &str, max: usize) -> bool {
    !s.is_empty() && s.len() <= max && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
}

fn is_sealed(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= MAX_SEALED_LEN
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"+/=-_".contains(&b))
}

fn now() -> u64 {
    env::block_timestamp()
}

#[near]
impl Treasury {
    // ======================================================================================
    // Init
    // ======================================================================================

    /// Initialise. `ignore_state` lets the deployer re-initialise over an earlier layout, and
    /// `#[private]` means only the treasury account itself (the deploy transaction) can call it.
    /// For a production deployment, remove the treasury account's full-access keys after deploy
    /// so the code and this method can never be invoked again.
    #[init(ignore_state)]
    #[private]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owners: Vec<AccountId>,
        agent: AccountId,
        outlayer: AccountId,
        engine: PinnedEngine,
        secrets: Option<SecretsRef>,
        asset: AccountId,
        policy: PolicyHeader,
    ) -> Self {
        if owners.is_empty() {
            fail(err::INVALID_ARGUMENT);
        }
        Self::validate_engine(&engine);
        Self::validate_policy_header(&policy);
        if policy.signers.iter().any(|s| *s == agent) {
            // The agent can never hold policy authority.
            fail(err::INVALID_ARGUMENT);
        }
        let mut set = IterableSet::new(StorageKey::V2Owners.prefix());
        for o in owners {
            if o == agent {
                fail(err::INVALID_ARGUMENT);
            }
            set.insert(o);
        }
        let genesis = hex(&env::sha256(
            format!("takara-ai:genesis:{}", env::current_account_id()).as_bytes(),
        ));
        let me = Self {
            owners: set,
            agent: Some(agent),
            paused: false,
            engine,
            secrets,
            outlayer,
            asset,
            balance: 0,
            sealed_outflow: String::new(),
            policy,
            proposals: IterableMap::new(StorageKey::V2Proposals.prefix()),
            next_proposal: 0,
            commitments: IterableMap::new(StorageKey::V2Commitments.prefix()),
            evidence_index: LookupMap::new(StorageKey::V2EvidenceIndex.prefix()),
            open: IterableSet::new(StorageKey::V2Open.prefix()),
            next_commitment: 0,
            ledger_state_hash: genesis,
            vendor_changes: IterableMap::new(StorageKey::V2VendorChanges.prefix()),
            next_vendor_change: 0,
            pending: LookupMap::new(StorageKey::V2Pending.prefix()),
            next_request: 0,
            issued: LookupMap::new(StorageKey::V2Issued.prefix()),
            used_nonces: LookupSet::new(StorageKey::V2UsedNonces.prefix()),
        };
        emit(
            "treasury_initialized",
            json!({ "policy_version": me.policy.version, "policy_hash": me.policy.hash, "engine_hash": me.engine.wasm_hash }),
        );
        me
    }

    // ======================================================================================
    // Ownership authority. Works with the agent offline and the engine unreachable: none of
    // these methods touch OutLayer.
    // ======================================================================================

    pub fn revoke_agent(&mut self) {
        self.require_owner();
        let old = self.agent.take();
        self.bump("agent_revoked", 0);
        emit("agent_revoked", json!({ "agent": old, "by": env::predecessor_account_id() }));
    }

    pub fn set_agent(&mut self, agent: AccountId) {
        self.require_owner();
        if self.owners.contains(&agent) || self.policy.signers.contains(&agent) {
            fail(err::INVALID_ARGUMENT);
        }
        self.agent = Some(agent.clone());
        self.bump("agent_set", 0);
        emit("agent_set", json!({ "agent": agent, "by": env::predecessor_account_id() }));
    }

    pub fn pause(&mut self) {
        self.require_owner();
        self.paused = true;
        self.bump("paused", 0);
        emit("treasury_paused", json!({ "by": env::predecessor_account_id() }));
    }

    pub fn unpause(&mut self) {
        self.require_owner();
        self.paused = false;
        emit("treasury_unpaused", json!({ "by": env::predecessor_account_id() }));
    }

    /// Move funds out under owner authority alone. Allowed while paused, with the agent revoked
    /// and the engine unreachable. This is the non-custodial guarantee.
    #[payable]
    pub fn recover(&mut self, amount: U128, to: AccountId) -> Promise {
        self.require_owner();
        Self::require_one_yocto();
        let amount = amount.0;
        if amount == 0 || amount > self.balance {
            fail(err::INSUFFICIENT_BALANCE);
        }
        self.balance -= amount;
        self.bump("recovered", 0);
        emit(
            "recovery_started",
            json!({ "by": env::predecessor_account_id(), "to": to, "amount": U128(amount) }),
        );
        Promise::new(self.asset.clone())
            .function_call(
                "ft_transfer".to_string(),
                serde_json::to_vec(&json!({ "receiver_id": to, "amount": U128(amount), "memo": "takara-ai owner recovery" }))
                    .unwrap(),
                NearToken::from_yoctonear(1),
                GAS_FOR_FT_TRANSFER,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RECOVER_CALLBACK)
                    .on_recover(U128(amount), to),
            )
    }

    #[private]
    pub fn on_recover(&mut self, amount: U128, to: AccountId) -> bool {
        let ok = env::promise_result_checked(0, 256).is_ok();
        if !ok {
            self.balance += amount.0;
            self.bump("recovery_reverted", 0);
        }
        emit("recovery_completed", json!({ "ok": ok, "to": to, "amount": amount }));
        ok
    }

    /// Owner bookkeeping: record that settled payouts were paid out externally (for example the
    /// confidential payout leg, funded by `recover`), by replacing the sealed settled-outflow
    /// total with one the owner sealed under their own ledger key. Owner only; logged.
    #[payable]
    pub fn reconcile_outflow(&mut self, sealed_outflow: String) {
        self.require_owner();
        Self::require_one_yocto();
        if !sealed_outflow.is_empty() && !is_sealed(&sealed_outflow) {
            fail(err::INVALID_ARGUMENT);
        }
        self.sealed_outflow = sealed_outflow;
        self.bump("outflow_reconciled", 0);
        emit("outflow_reconciled", json!({ "by": env::predecessor_account_id() }));
    }

    #[payable]
    pub fn set_engine(&mut self, engine: PinnedEngine) {
        self.require_owner();
        Self::require_one_yocto();
        Self::validate_engine(&engine);
        self.engine = engine;
        self.bump("engine_pinned", 0);
        emit("engine_pinned", json!({ "wasm_hash": self.engine.wasm_hash }));
    }

    #[payable]
    pub fn set_secrets(&mut self, secrets: Option<SecretsRef>) {
        self.require_owner();
        Self::require_one_yocto();
        self.secrets = secrets;
        self.bump("engine_secrets_set", 0);
        emit("engine_secrets_set", json!({ "set": self.secrets.is_some() }));
    }

    #[payable]
    pub fn rotate_signers(&mut self, signers: Vec<AccountId>, threshold: u8) {
        self.require_owner();
        Self::require_one_yocto();
        if signers.is_empty() || threshold == 0 || threshold as usize > signers.len() {
            fail(err::INVALID_ARGUMENT);
        }
        if let Some(agent) = &self.agent {
            if signers.contains(agent) {
                fail(err::INVALID_ARGUMENT);
            }
        }
        self.policy.signers = signers;
        self.policy.threshold = threshold;
        // A removed signer's approvals must not count toward any pending proposal.
        let current = self.policy.signers.clone();
        for p in self.proposals.values_mut().filter(|p| !p.applied) {
            p.approvals.retain(|a| current.contains(a));
        }
        self.bump("signers_rotated", 0);
        emit("signers_rotated", json!({ "signers": self.policy.signers, "threshold": threshold }));
    }

    // ======================================================================================
    // Policy authority
    // ======================================================================================

    /// Propose a new signed policy version. `diff` is the human-readable JSON diff the dashboard
    /// showed. The proposer's approval counts.
    pub fn propose_policy(&mut self, version: u32, hash: String, expires_at: U64, sealed: String, diff_hash: String) -> u32 {
        let signer = self.require_signer();
        if version <= self.policy.version || !is_hex(&hash, 64) || !is_sealed(&sealed) || !is_hex(&diff_hash, 64) {
            fail(err::INVALID_ARGUMENT);
        }
        let id = self.next_proposal;
        self.next_proposal += 1;
        self.proposals.insert(
            id,
            PolicyProposal { id, version, hash, expires_at, sealed, diff_hash, proposer: signer.clone(), approvals: vec![], applied: false },
        );
        emit("policy_proposed", json!({ "proposal_id": id, "version": version, "by": signer }));
        self.approve_policy(id);
        id
    }

    pub fn approve_policy(&mut self, proposal_id: u32) -> bool {
        let signer = self.require_signer();
        let threshold = self.policy.threshold as usize;
        let current_version = self.policy.version;
        let signers = self.policy.signers.clone();
        let p = self.proposals.get_mut(&proposal_id).unwrap_or_else(|| fail(err::NOT_FOUND));
        if p.applied || p.version <= current_version {
            fail(err::INVALID_TRANSITION);
        }
        if p.approvals.contains(&signer) {
            fail(err::ALREADY_APPROVED);
        }
        p.approvals.push(signer.clone());
        let approvals = p.approvals.iter().filter(|a| signers.contains(a)).count();
        emit("policy_approved", json!({ "proposal_id": proposal_id, "by": signer, "approvals": approvals, "threshold": threshold }));
        if approvals >= threshold {
            p.applied = true;
            let (version, hash, expires_at, sealed) = (p.version, p.hash.clone(), p.expires_at, p.sealed.clone());
            self.policy.version = version;
            self.policy.hash = hash;
            self.policy.expires_at = expires_at;
            self.policy.sealed = sealed;
            self.bump("policy_applied", version as u64);
            emit("policy_applied", json!({ "proposal_id": proposal_id, "version": version, "policy_hash": self.policy.hash }));
            return true;
        }
        false
    }

    /// A policy signer accepts a claimed commitment: it now reserves funds. For a first-time
    /// vendor above `new_vendor_auto_limit`, this one acceptance also verifies the vendor.
    pub fn accept_commitment(&mut self, commitment_id: U64) -> Decision {
        let signer = self.require_signer();
        let c = self.commitments.get_mut(&commitment_id.0).unwrap_or_else(|| fail(err::NOT_FOUND));
        if c.state != State::Claimed {
            fail(err::INVALID_TRANSITION);
        }
        c.state = State::Accepted;
        c.accepted_by = Some(AcceptedBy::Signer(signer.clone()));
        let vendor_verified = c.flags & flags::NEW_VENDOR_OVER_LIMIT != 0;
        self.bump("accepted", commitment_id.0);
        emit(
            "commitment_accepted",
            json!({ "commitment_id": commitment_id, "by": "signer", "signer": signer, "vendor_verified": vendor_verified }),
        );
        Decision::ok("accept").with_commitment(commitment_id.0)
    }

    /// Close a commitment (for example a fraudulent invoice). Never deletes. A policy signer may
    /// close only a `claimed` commitment: releasing an accepted reservation is either the
    /// signer-only discretionary downgrade, or an owner decision (ownership authority).
    pub fn close_commitment(&mut self, commitment_id: U64) {
        let who = env::predecessor_account_id();
        let is_owner = self.owners.contains(&who);
        if !is_owner && !self.policy.signers.contains(&who) {
            fail(err::NOT_POLICY_SIGNER);
        }
        let signer = who;
        let c = self.commitments.get_mut(&commitment_id.0).unwrap_or_else(|| fail(err::NOT_FOUND));
        let allowed = match c.state {
            State::Claimed => true,
            State::Accepted => is_owner,
            _ => false,
        };
        if !allowed {
            fail(err::INVALID_TRANSITION);
        }
        c.state = State::Closed;
        self.open.remove(&commitment_id.0);
        self.bump("closed", commitment_id.0);
        emit("commitment_closed", json!({ "commitment_id": commitment_id, "by": signer }));
    }

    /// Preemption: a policy signer may move an accepted `discretionary` commitment back to
    /// `claimed` to free liquidity for a critical one. Only a signer, only discretionary, only
    /// accepted -> claimed, always logged. The agent can never invoke this.
    pub fn downgrade_discretionary(&mut self, commitment_id: U64) {
        let signer = self.require_signer();
        let c = self.commitments.get_mut(&commitment_id.0).unwrap_or_else(|| fail(err::NOT_FOUND));
        if c.state != State::Accepted || c.priority != Priority::Discretionary {
            fail(err::INVALID_TRANSITION);
        }
        c.state = State::Claimed;
        c.accepted_by = None;
        c.flags |= flags::DOWNGRADED;
        self.bump("downgraded", commitment_id.0);
        emit("commitment_downgraded", json!({ "commitment_id": commitment_id, "from": "accepted", "to": "claimed", "by": signer }));
    }

    /// Approve a detected destination change. The vendor record itself is never edited by this
    /// contract or by any invoice; the engine treats the new destination as verified only after
    /// this approval and an elapsed `cooling_off_hours`.
    pub fn approve_vendor_change(&mut self, change_id: U64) {
        let signer = self.require_signer();
        self.decide_vendor_change(change_id.0, signer, SettlementStatus::ApprovedCoolingOff);
    }

    pub fn reject_vendor_change(&mut self, change_id: U64) {
        let signer = self.require_signer();
        let commitment_id = self.decide_vendor_change(change_id.0, signer.clone(), SettlementStatus::Rejected);
        if let Some(c) = self.commitments.get_mut(&commitment_id) {
            // Only a claimed commitment closes here; an accepted reservation is released by the
            // owner (close_commitment), not by a single signer.
            if c.state == State::Claimed {
                c.state = State::Closed;
                self.open.remove(&commitment_id);
                self.bump("closed", commitment_id);
                emit("commitment_closed", json!({ "commitment_id": U64(commitment_id), "by": signer, "cause": "vendor_change_rejected" }));
            }
        }
    }

    // ======================================================================================
    // Execution authority (agent). Each engine op is a request this contract makes to OutLayer
    // with the pinned wasm hash; the answer comes back only through `on_engine`.
    // ======================================================================================

    /// Register a forwarded document. `sealed_claim` is the parsed document (raw strings only,
    /// with its NEAR AI Cloud attestation evidence), sealed to the engine key. The engine
    /// resolves vendor, priority and flags deterministically; the result is always `claimed`.
    #[payable]
    pub fn register_claim(&mut self, sealed_claim: String) -> Promise {
        self.require_agent();
        if !is_sealed(&sealed_claim) {
            fail(err::INVALID_ARGUMENT);
        }
        self.engine_request(Op::Claim, None, Some(sealed_claim))
    }

    /// Ask the engine to accept a claimed commitment under policy (auto-accept limits, vendor
    /// tier, reserves). Above the limits it refuses with `needs_signer_acceptance`.
    #[payable]
    pub fn request_acceptance(&mut self, commitment_id: U64) -> Promise {
        self.require_agent();
        let c = self.commitments.get(&commitment_id.0).unwrap_or_else(|| fail(err::NOT_FOUND));
        if c.state != State::Claimed {
            fail(err::INVALID_TRANSITION);
        }
        self.engine_request(Op::Accept, Some(commitment_id.0), None)
    }

    /// Ask the engine for a settlement authorization for an accepted commitment.
    #[payable]
    pub fn request_authorization(&mut self, commitment_id: U64) -> Promise {
        self.require_agent();
        let c = self.commitments.get(&commitment_id.0).unwrap_or_else(|| fail(err::NOT_FOUND));
        if c.state != State::Accepted {
            fail(err::INVALID_TRANSITION);
        }
        self.engine_request(Op::Authorize, Some(commitment_id.0), None)
    }

    /// Settle with an authorization this contract itself recorded. Checks, in order: nonce not
    /// used, authorization issued here, every field equal, not expired, engine still pinned,
    /// policy and ledger state current, spendable asserted, commitment accepted.
    ///
    /// Testnet settlement is a state transition (escrow release, receipt, nonce burn, ledger
    /// hash update) with no plaintext amount or vendor address on-chain. The confidential payout
    /// is a separate mainnet integration demo that this contract does not enforce.
    pub fn settle(&mut self, auth: SettlementAuth) -> Decision {
        self.require_agent();
        let op = "settle";
        let cid = auth.commitment_id.0;
        let refuse = |r: &str| Decision::refuse(op, r).with_commitment(cid);

        if self.paused {
            return self.refusal(refuse(reason::TREASURY_PAUSED));
        }
        if self.used_nonces.contains(&auth.nonce) {
            return self.refusal(refuse(reason::NONCE_USED));
        }
        let Some(issued) = self.issued.get(&auth.nonce).cloned() else {
            return self.refusal(refuse(reason::UNKNOWN_AUTHORIZATION));
        };
        if let Some(field) = Self::first_mismatch(&issued.auth, &auth) {
            let mut d = refuse(reason::AUTHORIZATION_MISMATCH);
            d.field = Some(field.to_string());
            return self.refusal(d);
        }
        if now() > issued.auth.expiry.0 {
            return self.refusal(refuse(reason::AUTHORIZATION_EXPIRED));
        }
        if issued.auth.engine_hash != self.engine.wasm_hash {
            return self.refusal(refuse(reason::ENGINE_CHANGED));
        }
        if issued.auth.policy_hash != self.policy.hash {
            return self.refusal(refuse(reason::POLICY_HASH_STALE));
        }
        if now() > self.policy.expires_at.0 {
            return self.refusal(refuse(reason::POLICY_EXPIRED));
        }
        if issued.auth.ledger_state_hash != self.ledger_state_hash {
            return self.refusal(refuse(reason::LEDGER_STATE_STALE));
        }
        if !issued.auth.spendable_after_ok {
            return self.refusal(refuse(reason::SPENDABLE_NOT_ASSERTED));
        }
        match self.commitments.get(&cid) {
            Some(c) if c.state == State::Accepted => {}
            _ => return self.refusal(refuse(reason::COMMITMENT_NOT_ACCEPTED)),
        }

        // Execute.
        let c = self.commitments.get_mut(&cid).unwrap();
        c.state = State::Settled;
        c.settled_nonce = Some(auth.nonce.clone());
        let keep_history = c.flags & (flags::NEW_VENDOR_OVER_LIMIT | flags::DESTINATION_MISMATCH | flags::PROVISIONAL_VENDOR) != 0;
        if !keep_history {
            self.open.remove(&cid);
        }
        self.used_nonces.insert(auth.nonce.clone());
        self.issued.remove(&auth.nonce);
        // Only one authorization can settle per ledger state (the stale check above), so the
        // outflow total the engine computed for this one is exactly the new total.
        self.sealed_outflow = issued.outflow_after;
        self.bump("settled", cid);
        let auth_hash = hex(&env::sha256(&serde_json::to_vec(&auth).unwrap()));
        emit(
            "settlement_receipt",
            json!({
                "commitment_id": U64(cid),
                "nonce": auth.nonce,
                "auth_hash": auth_hash,
                "amount_commit": auth.amount_commit,
                "destination_commit": auth.destination_commit,
                "destination_chain": auth.destination_chain,
                "ledger_state_hash": self.ledger_state_hash,
            }),
        );
        let mut d = Decision::ok(op).with_commitment(cid);
        d.auth = Some(auth);
        d
    }

    // ======================================================================================
    // Funding (NEP-141 receiver). Anyone may fund the treasury with the configured asset.
    // ======================================================================================

    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        let _ = msg;
        if env::predecessor_account_id() != self.asset {
            fail(err::WRONG_ASSET);
        }
        // No ledger bump: more funds can never break a reserve check, and bumping here would let
        // anyone holding the asset void every in-flight request with a 1-unit transfer.
        self.balance += amount.0;
        emit("treasury_funded", json!({ "from": sender_id, "amount": amount, "balance": U128(self.balance) }));
        PromiseOrValue::Value(U128(0))
    }

    // ======================================================================================
    // Engine callback
    // ======================================================================================

    #[private]
    pub fn on_engine(&mut self, request_no: U64) -> Decision {
        let rq = request_no.0;
        let pending = self.pending.remove(&rq).unwrap_or_else(|| fail(err::NOT_FOUND));
        let op = pending.op.as_str();
        let cid = pending.commitment_id.map(|c| c.0);
        let base = |r: &str| {
            let d = Decision::refuse(op, r);
            match cid {
                Some(id) => d.with_commitment(id),
                None => d,
            }
        };

        // OutLayer reports a refused or failed run as a *successful* promise with value `null`.
        // Anything that is not a well-formed engine answer is an engine error, never approval.
        let bytes = match env::promise_result_checked(0, MAX_ENGINE_OUTPUT) {
            Ok(b) => b,
            Err(_) => return self.refusal(base(reason::ENGINE_ERROR)),
        };
        let output_hash = hex(&env::sha256(&bytes));
        let Ok(text) = serde_json::from_slice::<String>(&bytes) else {
            return self.refusal(base(reason::ENGINE_ERROR));
        };
        let Ok(out) = serde_json::from_str::<EngineOut>(&text) else {
            return self.refusal(base(reason::ENGINE_OUTPUT_INVALID));
        };

        // The engine must echo exactly the context this contract sent, and that context must
        // still be current.
        let echo_ok = out.v == 1
            && out.op == op
            && out.echo.t == env::current_account_id()
            && out.echo.rq == rq
            && out.echo.c == cid
            && out.echo.ph == pending.policy_hash
            && out.echo.ph == self.policy.hash
            && out.echo.ls == pending.ledger_state_hash;
        if !echo_ok {
            return self.refusal(base(reason::ENGINE_ECHO_MISMATCH));
        }
        if out.echo.ls != self.ledger_state_hash {
            return self.refusal(base(reason::LEDGER_STATE_STALE));
        }
        if pending.engine_hash != self.engine.wasm_hash {
            return self.refusal(base(reason::ENGINE_CHANGED));
        }
        if self.agent.as_ref() != Some(&pending.requested_by) {
            return self.refusal(base(reason::AGENT_CHANGED));
        }
        if self.paused {
            return self.refusal(base(reason::TREASURY_PAUSED));
        }

        if !out.ok {
            let r = out.reason.as_deref().filter(|r| is_reason_code(r)).unwrap_or(reason::ENGINE_OUTPUT_INVALID);
            let mut d = base(r);
            d.blocking = out.blocking.iter().map(|b| U64(*b)).collect();
            d.until = out.until.map(U64);
            d.detail = out.detail.filter(|s| is_sealed(s));
            return self.refusal_with_attestation(d, rq, &output_hash);
        }

        let attestation = AttestationRef { request_no: U64(rq), output_hash };
        match pending.op {
            Op::Claim => self.apply_claim(out, attestation),
            Op::Accept => self.apply_accept(cid.unwrap(), attestation),
            Op::Authorize => self.apply_authorize(cid.unwrap(), pending, out, attestation),
        }
    }

    // ======================================================================================
    // Views
    // ======================================================================================

    pub fn get_config(&self) -> Config {
        Config {
            owners: self.owners.iter().cloned().collect(),
            agent: self.agent.clone(),
            paused: self.paused,
            engine: self.engine.clone(),
            secrets: self.secrets.clone(),
            outlayer: self.outlayer.clone(),
            asset: self.asset.clone(),
            balance: U128(self.balance),
            policy_version: self.policy.version,
            policy_hash: self.policy.hash.clone(),
            signers: self.policy.signers.clone(),
            threshold: self.policy.threshold,
            policy_expires_at: self.policy.expires_at,
            ledger_state_hash: self.ledger_state_hash.clone(),
            commitments: U64(self.next_commitment),
        }
    }

    pub fn get_policy(&self) -> PolicyHeader {
        self.policy.clone()
    }

    pub fn get_commitment(&self, commitment_id: U64) -> Option<Commitment> {
        self.commitments.get(&commitment_id.0).cloned()
    }

    pub fn list_commitments(&self, from: Option<U64>, limit: Option<u32>) -> Vec<Commitment> {
        let from = from.map(|f| f.0).unwrap_or(0);
        let limit = limit.unwrap_or(50).min(100) as usize;
        (from..self.next_commitment).filter_map(|id| self.commitments.get(&id).cloned()).take(limit).collect()
    }

    pub fn get_vendor_change(&self, change_id: U64) -> Option<VendorChange> {
        self.vendor_changes.get(&change_id.0).cloned()
    }

    pub fn list_vendor_changes(&self) -> Vec<VendorChange> {
        self.vendor_changes.values().cloned().collect()
    }

    pub fn get_proposal(&self, proposal_id: u32) -> Option<PolicyProposal> {
        self.proposals.get(&proposal_id).cloned()
    }

    pub fn get_issued(&self, nonce: String) -> Option<IssuedAuth> {
        self.issued.get(&nonce).cloned()
    }

    pub fn is_nonce_used(&self, nonce: String) -> bool {
        self.used_nonces.contains(&nonce)
    }

    pub fn get_pending(&self, request_no: U64) -> Option<PendingRequest> {
        self.pending.get(&request_no.0).cloned()
    }

    /// The exact engine input this contract would send now for `op` (for local reports and
    /// audits; the same function builds the real request).
    pub fn preview_engine_input(&self, op: Op, commitment_id: Option<U64>) -> String {
        self.engine_input(op, self.next_request, commitment_id.map(|c| c.0), None, None)
    }
}

// ==========================================================================================
// Internal
// ==========================================================================================

impl Treasury {
    fn require_owner(&self) -> AccountId {
        let who = env::predecessor_account_id();
        if !self.owners.contains(&who) {
            fail(err::NOT_OWNER);
        }
        who
    }

    fn require_signer(&self) -> AccountId {
        let who = env::predecessor_account_id();
        if !self.policy.signers.contains(&who) {
            fail(err::NOT_POLICY_SIGNER);
        }
        who
    }

    fn require_agent(&self) -> AccountId {
        let who = env::predecessor_account_id();
        match &self.agent {
            None => fail(err::AGENT_REVOKED),
            Some(a) if *a != who => fail(err::NOT_AGENT),
            _ => {}
        }
        if self.paused {
            fail(err::PAUSED);
        }
        who
    }

    fn require_one_yocto() {
        if env::attached_deposit() != NearToken::from_yoctonear(1) {
            fail(err::ONE_YOCTO);
        }
    }

    fn validate_engine(engine: &PinnedEngine) {
        let ok = is_hex(&engine.wasm_hash, 64)
            && engine.wasm_url.starts_with("https://")
            && matches!(engine.build_target.as_str(), "wasm32-wasip1" | "wasm32-wasip2");
        if !ok {
            fail(err::INVALID_ARGUMENT);
        }
    }

    fn validate_policy_header(p: &PolicyHeader) {
        let ok = is_hex(&p.hash, 64)
            && !p.signers.is_empty()
            && p.threshold > 0
            && p.threshold as usize <= p.signers.len()
            && is_sealed(&p.sealed);
        if !ok {
            fail(err::INVALID_ARGUMENT);
        }
    }

    /// Rolling ledger state hash over every state transition.
    fn bump(&mut self, tag: &str, id: u64) {
        let mut buf = Vec::with_capacity(96);
        buf.extend_from_slice(self.ledger_state_hash.as_bytes());
        buf.extend_from_slice(tag.as_bytes());
        buf.extend_from_slice(&id.to_le_bytes());
        buf.extend_from_slice(&now().to_le_bytes());
        self.ledger_state_hash = hex(&env::sha256(&buf));
    }

    fn refusal(&mut self, d: Decision) -> Decision {
        emit(
            "refusal",
            json!({ "op": d.op, "reason": d.reason, "commitment_id": d.commitment_id, "blocking": d.blocking, "until": d.until, "field": d.field, "original": d.original }),
        );
        d
    }

    fn refusal_with_attestation(&mut self, d: Decision, rq: u64, output_hash: &str) -> Decision {
        emit(
            "refusal",
            json!({ "op": d.op, "reason": d.reason, "commitment_id": d.commitment_id, "blocking": d.blocking, "until": d.until, "request_no": U64(rq), "output_hash": output_hash }),
        );
        d
    }

    fn decide_vendor_change(&mut self, change_id: u64, signer: AccountId, status: SettlementStatus) -> CommitmentId {
        let vc = self.vendor_changes.get_mut(&change_id).unwrap_or_else(|| fail(err::NOT_FOUND));
        if vc.settlement_status != SettlementStatus::SuspendedDestinationMismatch {
            fail(err::INVALID_TRANSITION);
        }
        vc.settlement_status = status;
        vc.decided_by = Some(signer.clone());
        vc.decided_at = Some(U64(now()));
        let commitment_id = vc.commitment_id.0;
        let tag = if status == SettlementStatus::Rejected { "vendor_change_rejected" } else { "vendor_change_approved" };
        self.bump(tag, change_id);
        emit(tag, json!({ "change_id": U64(change_id), "commitment_id": U64(commitment_id), "by": signer, "settlement_status": status }));
        commitment_id
    }

    fn engine_request(&mut self, op: Op, commitment_id: Option<CommitmentId>, sealed_claim: Option<String>) -> Promise {
        if now() > self.policy.expires_at.0 {
            fail(err::POLICY_EXPIRED);
        }
        let deposit = env::attached_deposit();
        if deposit.is_zero() {
            fail(err::DEPOSIT_REQUIRED);
        }
        if op == Op::Claim && self.open.len() >= MAX_OPEN {
            fail(err::TOO_MANY_OPEN);
        }
        let rq = self.next_request;
        self.next_request += 1;
        let nonce = (op == Op::Authorize).then(|| {
            hex(&env::sha256(format!("{}:{}:{}", env::current_account_id(), rq, now()).as_bytes()))[..32].to_string()
        });
        let input = self.engine_input(op, rq, commitment_id, sealed_claim.as_deref(), nonce.as_deref());
        self.pending.insert(
            rq,
            PendingRequest {
                op,
                commitment_id: commitment_id.map(U64),
                policy_hash: self.policy.hash.clone(),
                ledger_state_hash: self.ledger_state_hash.clone(),
                engine_hash: self.engine.wasm_hash.clone(),
                nonce,
                requested_by: env::predecessor_account_id(),
                requested_at: U64(now()),
            },
        );

        let mut args = json!({
            "source": { "WasmUrl": {
                "url": self.engine.wasm_url,
                "hash": self.engine.wasm_hash,
                "build_target": self.engine.build_target,
            }},
            "resource_limits": {
                "max_instructions": 10_000_000_000u64,
                "max_memory_mb": 128u32,
                "max_execution_seconds": 60u64,
            },
            "input_data": input,
            "response_format": "Text",
            // Same as the path proven in step 0: refunds of unused deposit return to the treasury.
            "payer_account_id": env::current_account_id(),
        });
        if let Some(s) = &self.secrets {
            args["secrets_ref"] = json!({ "profile": s.profile, "account_id": s.account_id });
        }
        emit(
            "engine_requested",
            json!({ "request_no": U64(rq), "op": op, "commitment_id": commitment_id.map(U64), "engine_hash": self.engine.wasm_hash }),
        );
        Promise::new(self.outlayer.clone())
            .function_call("request_execution".to_string(), serde_json::to_vec(&args).unwrap(), deposit, GAS_FOR_OUTLAYER)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_ENGINE_CALLBACK).on_engine(U64(rq)))
    }

    /// Public engine input. Contains only ids, states, hashes, the public balance and sealed
    /// blobs. Built by the contract, so the engine always evaluates the real ledger.
    fn engine_input(
        &self,
        op: Op,
        rq: u64,
        commitment_id: Option<CommitmentId>,
        sealed_claim: Option<&str>,
        nonce: Option<&str>,
    ) -> String {
        let cs: Vec<Value> = self
            .open
            .iter()
            .filter_map(|id| self.commitments.get(id))
            // Closed commitments never matter. Settled ones matter only as vendor history (a
            // signer-verified new vendor or an approved destination change); their amounts are
            // already in `sealed_outflow`. This keeps the input bounded.
            .filter(|c| match c.state {
                State::Closed => false,
                State::Settled => c.flags & (flags::NEW_VENDOR_OVER_LIMIT | flags::DESTINATION_MISMATCH | flags::PROVISIONAL_VENDOR) != 0,
                _ => true,
            })
            .map(|c| {
                let vc = c.vendor_change.and_then(|v| self.vendor_changes.get(&v.0));
                let acc = match &c.accepted_by {
                    Some(AcceptedBy::Signer(_)) => "s",
                    Some(AcceptedBy::Policy) => "p",
                    None => "",
                };
                json!([
                    c.id.0,
                    c.state,
                    c.priority,
                    c.flags,
                    acc,
                    c.sealed,
                    vc.map(|v| v.settlement_status),
                    vc.and_then(|v| v.decided_at.map(|t| t.0)),
                ])
            })
            .collect();
        json!({
            "v": 1,
            "op": op,
            "rq": rq,
            "t": env::current_account_id(),
            "now": now(),
            "asset": self.asset,
            "bal": self.balance.to_string(),
            "out": self.sealed_outflow,
            "ph": self.policy.hash,
            "pv": self.policy.version,
            "ls": self.ledger_state_hash,
            "pol": self.policy.sealed,
            "c": commitment_id,
            "n": nonce,
            "claim": sealed_claim,
            "cs": cs,
        })
        .to_string()
    }

    fn apply_claim(&mut self, out: EngineOut, attestation: AttestationRef) -> Decision {
        let op = "claim";
        let Some(claim) = out.claim else {
            return self.refusal(Decision::refuse(op, reason::ENGINE_OUTPUT_INVALID));
        };
        let valid = is_hex(&claim.ev, 64)
            && is_hex(&claim.ch, 64)
            && is_short_token(&claim.vr, 64)
            && is_sealed(&claim.sr)
            && claim.fl & !flags::ENGINE_MASK == 0;
        if !valid {
            return self.refusal(Decision::refuse(op, reason::ENGINE_OUTPUT_INVALID));
        }
        if let Some(original) = self.evidence_index.get(&claim.ev) {
            let mut d = Decision::refuse(op, reason::DUPLICATE_EVIDENCE);
            d.original = Some(U64(*original));
            return self.refusal_with_attestation(d, attestation.request_no.0, &attestation.output_hash);
        }

        let id = self.next_commitment;
        self.next_commitment += 1;
        let mismatch = claim.fl & flags::DESTINATION_MISMATCH != 0;
        let vendor_change = mismatch.then(|| {
            let vc_id = self.next_vendor_change;
            self.next_vendor_change += 1;
            self.vendor_changes.insert(
                vc_id,
                VendorChange {
                    id: U64(vc_id),
                    commitment_id: U64(id),
                    vendor_ref: claim.vr.clone(),
                    settlement_status: SettlementStatus::SuspendedDestinationMismatch,
                    requested_at: U64(now()),
                    decided_by: None,
                    decided_at: None,
                },
            );
            U64(vc_id)
        });
        self.evidence_index.insert(claim.ev.clone(), id);
        self.open.insert(id);
        self.commitments.insert(
            id,
            Commitment {
                id: U64(id),
                state: State::Claimed,
                priority: claim.pr,
                evidence_hash: claim.ev,
                commitment_hash: claim.ch,
                vendor_ref: claim.vr,
                flags: claim.fl,
                sealed: claim.sr,
                attestation: attestation.clone(),
                created_at: U64(now()),
                accepted_by: None,
                vendor_change,
                settled_nonce: None,
            },
        );
        self.bump("claimed", id);
        let c = self.commitments.get(&id).unwrap();
        emit(
            "commitment_claimed",
            json!({
                "commitment_id": U64(id),
                "priority": c.priority,
                "flags": c.flags,
                "vendor_ref": c.vendor_ref,
                "evidence_hash": c.evidence_hash,
                "request_no": attestation.request_no,
                "output_hash": attestation.output_hash,
            }),
        );
        if let Some(vc) = vendor_change {
            emit(
                "refusal",
                json!({ "op": "claim", "reason": "vendor_destination_mismatch", "commitment_id": U64(id), "change_id": vc, "settlement_status": SettlementStatus::SuspendedDestinationMismatch }),
            );
        }
        let mut d = Decision::ok(op).with_commitment(id);
        if mismatch {
            d.reason = Some("vendor_destination_mismatch".to_string());
        }
        d
    }

    fn apply_accept(&mut self, cid: CommitmentId, attestation: AttestationRef) -> Decision {
        let op = "accept";
        let Some(c) = self.commitments.get_mut(&cid) else {
            return self.refusal(Decision::refuse(op, reason::COMMITMENT_NOT_CLAIMED));
        };
        if c.state != State::Claimed {
            return self.refusal(Decision::refuse(op, reason::COMMITMENT_NOT_CLAIMED).with_commitment(cid));
        }
        c.state = State::Accepted;
        c.accepted_by = Some(AcceptedBy::Policy);
        let fl = c.flags;
        self.bump("accepted", cid);
        emit(
            "commitment_accepted",
            json!({ "commitment_id": U64(cid), "by": "policy", "flags": fl, "request_no": attestation.request_no, "output_hash": attestation.output_hash }),
        );
        Decision::ok(op).with_commitment(cid)
    }

    fn apply_authorize(&mut self, cid: CommitmentId, pending: PendingRequest, out: EngineOut, attestation: AttestationRef) -> Decision {
        let op = "authorize";
        let Some(a) = out.auth else {
            return self.refusal(Decision::refuse(op, reason::ENGINE_OUTPUT_INVALID).with_commitment(cid));
        };
        let valid = is_hex(&a.amc, 64)
            && is_hex(&a.dsc, 64)
            && is_hex(&a.mfc, 64)
            && is_short_token(&a.sch, 32)
            && is_short_token(&a.dch, 32)
            && is_sealed(&a.op)
            && is_sealed(&a.oa);
        if !valid {
            return self.refusal(Decision::refuse(op, reason::ENGINE_OUTPUT_INVALID).with_commitment(cid));
        }
        if !a.sp {
            return self.refusal(Decision::refuse(op, reason::SPENDABLE_NOT_ASSERTED).with_commitment(cid));
        }
        match self.commitments.get(&cid) {
            Some(c) if c.state == State::Accepted => {}
            _ => return self.refusal(Decision::refuse(op, reason::COMMITMENT_NOT_ACCEPTED).with_commitment(cid)),
        }
        let nonce = pending.nonce.unwrap_or_else(|| fail(err::INVALID_ARGUMENT));
        let expiry = a.exp.min(now() + MAX_AUTH_TTL_NS);
        let auth = SettlementAuth {
            treasury_id: env::current_account_id(),
            commitment_id: U64(cid),
            asset_id: self.asset.clone(),
            source: env::current_account_id(),
            source_chain: a.sch,
            destination_chain: a.dch,
            amount_commit: a.amc,
            destination_commit: a.dsc,
            max_fee_commit: a.mfc,
            policy_hash: self.policy.hash.clone(),
            policy_version: self.policy.version,
            ledger_state_hash: self.ledger_state_hash.clone(),
            spendable_after_ok: true,
            engine_hash: self.engine.wasm_hash.clone(),
            nonce: nonce.clone(),
            expiry: U64(expiry),
        };
        self.issued.insert(
            nonce.clone(),
            IssuedAuth { auth: auth.clone(), opening: a.op.clone(), outflow_after: a.oa, issued_at: U64(now()) },
        );
        emit(
            "authorization_issued",
            json!({ "commitment_id": U64(cid), "nonce": nonce, "expiry": U64(expiry), "request_no": attestation.request_no, "output_hash": attestation.output_hash }),
        );
        let mut d = Decision::ok(op).with_commitment(cid);
        d.auth = Some(auth);
        d.opening = Some(a.op);
        d
    }

    /// First field where the submitted authorization differs from the one this contract issued.
    fn first_mismatch(issued: &SettlementAuth, given: &SettlementAuth) -> Option<&'static str> {
        let checks: [(&'static str, bool); 16] = [
            ("treasury_id", issued.treasury_id == given.treasury_id),
            ("commitment_id", issued.commitment_id == given.commitment_id),
            ("asset_id", issued.asset_id == given.asset_id),
            ("source", issued.source == given.source),
            ("source_chain", issued.source_chain == given.source_chain),
            ("destination_chain", issued.destination_chain == given.destination_chain),
            ("amount_commit", issued.amount_commit == given.amount_commit),
            ("destination_commit", issued.destination_commit == given.destination_commit),
            ("max_fee_commit", issued.max_fee_commit == given.max_fee_commit),
            ("policy_hash", issued.policy_hash == given.policy_hash),
            ("policy_version", issued.policy_version == given.policy_version),
            ("ledger_state_hash", issued.ledger_state_hash == given.ledger_state_hash),
            ("spendable_after_ok", issued.spendable_after_ok == given.spendable_after_ok),
            ("engine_hash", issued.engine_hash == given.engine_hash),
            ("nonce", issued.nonce == given.nonce),
            ("expiry", issued.expiry == given.expiry),
        ];
        checks.iter().find(|(_, ok)| !ok).map(|(f, _)| *f)
    }
}
