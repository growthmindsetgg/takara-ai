//! The policy engine. Pure function: input JSON (+ engine key) -> output JSON.
//!
//! Contract ops (run on OutLayer, input built by the treasury contract):
//!   claim      open a sealed claim, resolve vendor/priority/flags deterministically, seal record
//!   accept     accept a claimed commitment under policy, or refuse with a reason
//!   authorize  issue a settlement authorization for an accepted commitment
//! Local ops (owner/agent tools, same binary run locally):
//!   pubkey     engine public key
//!   report     deterministic figures over the decrypted ledger (owner only: needs the key)
//!   seal_to    ECIES-seal plaintext to a public key (no engine key needed)
//!   open_opening  open a payout opening with the agent payout key

use crate::crypto::{self, Keys};
use crate::model::*;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;

const NS_PER_SEC: u64 = 1_000_000_000;

#[derive(Deserialize, Default)]
#[serde(default)]
struct Input {
    v: u8,
    op: String,
    rq: u64,
    t: String,
    now: u64,
    asset: String,
    bal: String,
    out: String,
    ph: String,
    pv: u32,
    ls: String,
    pol: String,
    c: Option<u64>,
    n: Option<String>,
    claim: Option<String>,
    cs: Vec<Value>,
    // local ops
    pt: Option<String>,
    to: Option<String>,
    eph: Option<String>,
    sealed: Option<String>,
    sk: Option<String>,
}

/// One commitment as the contract describes it, with its private record opened.
#[derive(Clone, Debug)]
struct Entry {
    id: u64,
    state: String,
    priority: String,
    flags: u8,
    accepted_by: String,
    vc_status: Option<String>,
    vc_decided_at: Option<u64>,
    rec: Record,
}

impl Entry {
    fn amount(&self) -> u128 {
        self.rec.a.parse().unwrap_or(0)
    }
}

const F_PROVISIONAL: u8 = 1;
const F_NEW_OVER_LIMIT: u8 = 2;
const F_INJECTION: u8 = 4;
const F_MISMATCH: u8 = 8;
/// Set by the contract when a signer preempted this commitment; only a signer may re-accept.
const F_DOWNGRADED: u8 = 16;

struct Ctx<'a> {
    inp: &'a Input,
    keys: Keys,
    policy: Policy,
    entries: Vec<Entry>,
    outflow: u128,
    balance: u128,
}

pub fn handle(raw: &str, env_key: Option<String>) -> String {
    let inp: Input = match serde_json::from_str(raw) {
        Ok(i) => i,
        Err(_) => return json!({ "v": 1, "ok": false, "reason": "input_unreadable" }).to_string(),
    };
    match inp.op.as_str() {
        "seal_to" => return seal_to(&inp),
        "open_opening" => return open_opening(&inp),
        _ => {}
    }
    // Inside the TEE the key arrives as the OutLayer secret. The full-ledger report is an
    // owner-side op only: it must never run with the TEE key, whoever builds the input.
    if env_key.is_some() && matches!(inp.op.as_str(), "report" | "open_local" | "seal_local") {
        return refuse(&inp, "op_not_allowed_in_tee");
    }
    if inp.op == "seal_local" {
        // Owner tool: seal plaintext under the ledger key (for example a reconciled outflow total).
        let Some(keys) = inp.sk.as_deref().and_then(Keys::from_hex) else { return refuse(&inp, "engine_key_missing") };
        let pt = inp.pt.clone().unwrap_or_default();
        return json!({ "v": 1, "op": "seal_local", "ok": true, "sealed": keys.seal(pt.as_bytes()) }).to_string();
    }
    if inp.op == "open_local" {
        // Owner tool: open any blob sealed to/by this engine key (refusal details, records).
        let Some(keys) = inp.sk.as_deref().and_then(Keys::from_hex) else { return refuse(&inp, "engine_key_missing") };
        let opened = inp.sealed.as_deref().and_then(|s| keys.open(s)).and_then(|b| String::from_utf8(b).ok());
        return match opened {
            Some(pt) => json!({ "v": 1, "op": "open_local", "ok": true, "plaintext": serde_json::from_str::<Value>(&pt).unwrap_or(Value::String(pt)) }).to_string(),
            None => refuse(&inp, "sealed_unreadable"),
        };
    }
    let key = env_key.or_else(|| inp.sk.clone());
    let Some(keys) = key.as_deref().and_then(Keys::from_hex) else {
        return refuse(&inp, "engine_key_missing");
    };
    if inp.op == "pubkey" {
        return json!({ "v": 1, "op": "pubkey", "ok": true, "pk": keys.pk_hex() }).to_string();
    }
    if inp.op == "seal_policy_local" {
        // Owner tool: seal a plaintext policy bundle to this engine and report its hash.
        let pt = inp.pt.clone().unwrap_or_default();
        let eph = inp.eph.as_deref().and_then(crypto::parse_key32).unwrap_or_else(|| keys.derive("eph-policy", pt.as_bytes()));
        return json!({ "v": 1, "op": inp.op, "ok": true, "hash": crypto::sha256_hex(pt.as_bytes()), "sealed": crypto::seal_to(&keys.pk, eph, pt.as_bytes()) }).to_string();
    }

    let ctx = match load(&inp, keys) {
        Ok(c) => c,
        Err(r) => return refuse(&inp, r),
    };
    match inp.op.as_str() {
        "claim" => op_claim(&ctx),
        "accept" => op_accept(&ctx),
        "authorize" => op_authorize(&ctx),
        "report" => op_report(&ctx),
        _ => refuse(&inp, "unknown_op"),
    }
}

// ------------------------------------------------------------------------------------------
// output helpers
// ------------------------------------------------------------------------------------------

fn echo(inp: &Input) -> Value {
    json!({ "t": inp.t, "c": inp.c, "ph": inp.ph, "ls": inp.ls, "rq": inp.rq })
}

fn refuse(inp: &Input, reason: &str) -> String {
    json!({ "v": 1, "op": inp.op, "ok": false, "echo": echo(inp), "reason": reason }).to_string()
}

fn refuse_with(inp: &Input, reason: &str, blocking: Vec<u64>, until: Option<u64>, detail: Option<String>) -> String {
    let mut o = json!({ "v": 1, "op": inp.op, "ok": false, "echo": echo(inp), "reason": reason });
    if !blocking.is_empty() {
        o["blocking"] = json!(blocking);
    }
    if let Some(u) = until {
        o["until"] = json!(u);
    }
    if let Some(d) = detail {
        o["detail"] = json!(d);
    }
    o.to_string()
}

// ------------------------------------------------------------------------------------------
// context
// ------------------------------------------------------------------------------------------

fn load(inp: &Input, keys: Keys) -> Result<Ctx<'_>, &'static str> {
    if inp.v != 1 {
        return Err("input_version_unsupported");
    }
    let pol_bytes = keys.open_ecies(&inp.pol).ok_or("policy_unreadable")?;
    if crypto::sha256_hex(&pol_bytes) != inp.ph {
        return Err("policy_hash_mismatch");
    }
    let policy: Policy = serde_json::from_slice(&pol_bytes).map_err(|_| "policy_unreadable")?;
    if policy.asset != inp.asset {
        return Err("policy_asset_mismatch");
    }
    let mut entries = Vec::with_capacity(inp.cs.len());
    for v in &inp.cs {
        let a = v.as_array().ok_or("ledger_unreadable")?;
        let get_s = |i: usize| a.get(i).and_then(|x| x.as_str()).unwrap_or("").to_string();
        let sealed = get_s(5);
        let rec_bytes = keys.open_sym(&sealed).ok_or("record_unreadable")?;
        let rec: Record = serde_json::from_slice(&rec_bytes).map_err(|_| "record_unreadable")?;
        entries.push(Entry {
            id: a.first().and_then(|x| x.as_u64()).ok_or("ledger_unreadable")?,
            state: get_s(1),
            priority: get_s(2),
            flags: a.get(3).and_then(|x| x.as_u64()).unwrap_or(0) as u8,
            accepted_by: get_s(4),
            vc_status: a.get(6).and_then(|x| x.as_str()).map(String::from),
            vc_decided_at: a.get(7).and_then(|x| x.as_u64()),
            rec,
        });
    }
    let outflow = if inp.out.is_empty() {
        0
    } else {
        let b = keys.open_sym(&inp.out).ok_or("outflow_unreadable")?;
        let v: Value = serde_json::from_slice(&b).map_err(|_| "outflow_unreadable")?;
        v["o"].as_str().and_then(|s| s.parse().ok()).ok_or("outflow_unreadable")?
    };
    let balance: u128 = inp.bal.parse().map_err(|_| "balance_unreadable")?;
    Ok(Ctx { inp, keys, policy, entries, outflow, balance })
}

impl Ctx<'_> {
    fn reserved(&self) -> u128 {
        self.entries.iter().filter(|e| e.state == "accepted").map(Entry::amount).fold(0u128, |a, b| a.saturating_add(b))
    }

    fn spendable(&self) -> i128 {
        self.balance as i128 - self.outflow as i128 - self.reserved() as i128
    }

    /// Monthly-equivalent recurring burn per day (base units), from claimed or accepted
    /// recurring commitments.
    fn daily_burn(&self) -> u128 {
        // Only accepted recurrences count: an unaccepted claim must not be able to inflate the
        // runway buffer and block legitimate spending.
        let monthly = self
            .entries
            .iter()
            .filter(|e| e.state == "accepted")
            .map(|e| match e.rec.r.as_str() {
                "m" => e.amount(),
                "w" => e.amount().saturating_mul(52) / 12,
                _ => 0,
            })
            .fold(0u128, |a, b| a.saturating_add(b));
        monthly / 30
    }

    fn cooling_ns(&self) -> u64 {
        self.policy.cooling_off_hours.saturating_mul(3600 * NS_PER_SEC)
    }

    /// Verified vendor destinations: the signed registry, plus destination changes a signer
    /// approved whose cooling-off has elapsed, plus first-time vendors a signer accepted.
    /// Nothing a document says ever enters this map.
    fn effective_registry(&self) -> BTreeMap<String, BTreeMap<String, String>> {
        let mut reg: BTreeMap<String, BTreeMap<String, String>> =
            self.policy.vendors.iter().map(|v| (v.id.clone(), v.destinations.clone())).collect();
        let mut sorted = self.entries.clone();
        sorted.sort_by_key(|e| e.id);
        for e in &sorted {
            if e.flags & F_MISMATCH != 0
                && e.vc_status.as_deref() == Some("approved_cooling_off")
                && e.vc_decided_at.map(|t| self.inp.now >= t.saturating_add(self.cooling_ns())).unwrap_or(false)
            {
                if let Some(p) = &e.rec.p {
                    reg.entry(e.rec.v.clone()).or_default().insert(e.rec.c.clone(), p.clone());
                }
            }
            if e.flags & F_NEW_OVER_LIMIT != 0 && e.accepted_by == "s" {
                reg.entry(e.rec.v.clone()).or_default().insert(e.rec.c.clone(), e.rec.x.clone());
            }
        }
        reg
    }

    fn blocking(&self, exclude: Option<u64>) -> Vec<u64> {
        let mut acc: Vec<&Entry> = self.entries.iter().filter(|e| e.state == "accepted" && Some(e.id) != exclude).collect();
        acc.sort_by_key(|e| (priority_rank(&e.priority), e.rec.d, e.id));
        acc.iter().map(|e| e.id).collect()
    }

    fn sealed_detail(&self, v: Value) -> String {
        self.keys.seal(v.to_string().as_bytes())
    }

    fn fmt(&self, v: i128) -> String {
        format_amount(v, self.policy.decimals)
    }
}

// ------------------------------------------------------------------------------------------
// claim
// ------------------------------------------------------------------------------------------

fn op_claim(ctx: &Ctx) -> String {
    let inp = ctx.inp;
    let Some(sealed) = inp.claim.as_deref() else { return refuse(inp, "claim_missing") };
    let Some(bytes) = ctx.keys.open_ecies(sealed) else { return refuse(inp, "claim_unreadable") };
    let Ok(claim) = serde_json::from_slice::<Claim>(&bytes) else { return refuse(inp, "claim_unreadable") };
    if claim.doc_sha256.len() != 64 || !claim.doc_sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return refuse(inp, "claim_unreadable");
    }
    let p = &ctx.policy;
    let f = &claim.fields;

    let currency = f.currency.trim().to_ascii_uppercase();
    if !currency.is_empty() && currency != p.symbol.to_ascii_uppercase() && !(p.symbol.contains("USD") && currency == "USD") {
        return refuse(inp, "unsupported_currency");
    }
    let Some(amount) = parse_amount(&f.amount, p.decimals).filter(|a| *a > 0) else {
        return refuse(inp, "amount_unparseable");
    };

    // Every raw string is scanned; none is followed.
    let all_text = [&f.vendor_name, &f.tax_id, &f.invoice_number, &f.amount, &f.currency, &f.due_date, &f.destination, &f.destination_chain, &f.recurrence, &f.memo, &f.purpose];
    let mut flags = if all_text.iter().any(|s| looks_like_instruction(s)) { F_INJECTION } else { 0 };

    let email = claim.sender.email.trim().to_ascii_lowercase();
    let domain = claim.sender.domain.trim().to_ascii_lowercase();
    let dkim_ok = claim.sender.dkim.eq_ignore_ascii_case("pass");
    let extracted_dest = f.destination.trim().to_string();
    let extracted_chain = if f.destination_chain.trim().is_empty() { "near".to_string() } else { f.destination_chain.trim().to_ascii_lowercase() };
    let registry = ctx.effective_registry();

    let (vendor_id, priority, chain, dest, proposed, recurrence): (String, &str, String, String, Option<String>, String);
    if claim.kind == "payment_request" {
        // A team member's request: identity from the signed roster, never from the document.
        let Some(m) = p.roster.iter().find(|m| dkim_ok && m.email.eq_ignore_ascii_case(&email)) else {
            return refuse(inp, "unknown_requester");
        };
        vendor_id = format!("member:{}", m.id);
        priority = "discretionary";
        chain = m.payout_chain.clone();
        dest = m.payout_address.clone();
        proposed = None;
        recurrence = String::new();
    } else if let Some(v) = p.vendors.iter().find(|v| {
        dkim_ok
            && (v.emails.iter().any(|e| e.eq_ignore_ascii_case(&email))
                || v.domains.iter().any(|d| d.eq_ignore_ascii_case(&domain))
                || (!f.tax_id.trim().is_empty() && v.tax_ids.iter().any(|t| t.eq_ignore_ascii_case(f.tax_id.trim()))))
    }) {
        // Verified vendor: resolved by sender address, domain or tax id against the registry.
        vendor_id = v.id.clone();
        priority = valid_priority(&v.priority);
        let verified_chain = if v.destinations.contains_key(&extracted_chain) { extracted_chain.clone() } else { v.destinations.keys().next().cloned().unwrap_or_else(|| "near".into()) };
        let verified = registry.get(&v.id).and_then(|m| m.get(&verified_chain)).cloned().unwrap_or_default();
        chain = verified_chain;
        if !extracted_dest.is_empty() && extracted_dest != verified {
            flags |= F_MISMATCH;
            proposed = Some(extracted_dest.clone());
        } else {
            proposed = None;
        }
        dest = verified;
        recurrence = v.recurrence.clone().map(|r| recurrence_code(&r)).unwrap_or_else(|| recurrence_code(&f.recurrence));
    } else {
        // First-time vendor. Its destination is a one-time claim bound to this evidence.
        if !dkim_ok {
            return refuse(inp, "sender_unverified");
        }
        if extracted_dest.is_empty() {
            return refuse(inp, "missing_destination");
        }
        let key = if !domain.is_empty() { domain.clone() } else { email.clone() };
        let known = registry.iter().find(|(id, _)| **id == format!("new:{}", &crypto::sha256_hex(key.as_bytes())[..12]));
        vendor_id = format!("new:{}", &crypto::sha256_hex(key.as_bytes())[..12]);
        priority = "normal";
        chain = extracted_chain.clone();
        if let Some((_, dests)) = known {
            // A signer already verified this vendor on an earlier invoice.
            let verified = dests.get(&chain).cloned().unwrap_or_default();
            if verified != extracted_dest {
                flags |= F_MISMATCH;
                proposed = Some(extracted_dest.clone());
            } else {
                proposed = None;
            }
            dest = verified;
        } else {
            // Only a genuinely first invoice from this vendor is provisional. Any earlier
            // commitment from the same sender means it is no longer first-time: a signer decides.
            let seen_before = ctx.entries.iter().any(|e| e.rec.v == vendor_id);
            let limit: u128 = p.new_vendor_auto_limit.parse().unwrap_or(0);
            flags |= if amount <= limit && !seen_before { F_PROVISIONAL } else { F_NEW_OVER_LIMIT };
            dest = extracted_dest.clone();
            proposed = None;
        }
        recurrence = recurrence_code(&f.recurrence);
    }

    // Evidence: the same invoice (vendor + invoice number) is a duplicate whatever the bytes
    // around it; without an invoice number, the document bytes identify it.
    let inv_no: String = f.invoice_number.trim().to_ascii_uppercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
    let evidence_src = if inv_no.is_empty() { claim.doc_sha256.clone() } else { format!("inv:{vendor_id}:{inv_no}") };
    let salt = hex::encode(&ctx.keys.derive("salt", claim.doc_sha256.as_bytes())[..8]);
    let rec = Record { v: vendor_id.clone(), a: amount.to_string(), d: parse_date(&f.due_date), x: dest, c: chain, p: proposed, r: recurrence, s: salt };
    let rec_bytes = serde_json::to_vec(&rec).expect("record serializes");
    let vref = format!("v-{}", &hex::encode(ctx.keys.derive("vref", vendor_id.as_bytes()))[..12]);
    json!({
        "v": 1, "op": "claim", "ok": true, "echo": echo(inp),
        "claim": {
            "ev": ctx.keys.evidence_hash(&evidence_src),
            "ch": crypto::sha256_hex(&rec_bytes),
            "pr": priority,
            "vr": vref,
            "fl": flags,
            "sr": ctx.keys.seal(&rec_bytes),
        }
    })
    .to_string()
}

// ------------------------------------------------------------------------------------------
// accept
// ------------------------------------------------------------------------------------------

fn find<'a>(ctx: &'a Ctx, state: &str) -> Result<&'a Entry, &'static str> {
    let id = ctx.inp.c.ok_or("commitment_missing")?;
    let e = ctx.entries.iter().find(|e| e.id == id).ok_or("unknown_commitment")?;
    if e.state != state {
        return Err(if state == "claimed" { "commitment_not_claimed" } else { "commitment_not_accepted" });
    }
    Ok(e)
}

fn op_accept(ctx: &Ctx) -> String {
    let inp = ctx.inp;
    let e = match find(ctx, "claimed") {
        Ok(e) => e,
        Err(r) => return refuse(inp, r),
    };
    let p = &ctx.policy;
    if e.flags & F_MISMATCH != 0 && e.vc_status.as_deref() != Some("approved_cooling_off") {
        return refuse(inp, "vendor_destination_mismatch");
    }
    if e.flags & (F_NEW_OVER_LIMIT | F_DOWNGRADED) != 0 {
        return refuse(inp, "needs_signer_acceptance");
    }
    let amount = e.amount();
    if e.flags & F_PROVISIONAL != 0 {
        let used = ctx
            .entries
            .iter()
            .filter(|x| x.flags & F_PROVISIONAL != 0 && matches!(x.state.as_str(), "accepted" | "settled"))
            .map(Entry::amount)
            .fold(0u128, |a, b| a.saturating_add(b));
        if used.saturating_add(amount) > p.provisional_cap.parse().unwrap_or(0) {
            return refuse(inp, "needs_signer_acceptance");
        }
    }
    if amount > p.max_auto_pay.parse().unwrap_or(0) {
        return refuse(inp, "needs_signer_acceptance");
    }
    if e.flags & F_PROVISIONAL != 0 && amount > p.new_vendor_auto_limit.parse().unwrap_or(0) {
        return refuse(inp, "needs_signer_acceptance");
    }
    let spendable = ctx.spendable();
    let after = spendable - amount as i128;
    if after < 0 {
        let detail = ctx.sealed_detail(json!({ "spendable": ctx.fmt(spendable), "requested": ctx.fmt(amount as i128), "shortfall": ctx.fmt(-after) }));
        return refuse_with(inp, "would_break_commitments", ctx.blocking(Some(e.id)), None, Some(detail));
    }
    if e.priority == "discretionary" {
        let buffer = ctx.daily_burn().saturating_mul(p.min_runway_days as u128) as i128;
        if after < buffer {
            let detail = ctx.sealed_detail(json!({ "spendable_after": ctx.fmt(after), "runway_buffer": ctx.fmt(buffer), "min_runway_days": p.min_runway_days }));
            return refuse_with(inp, "below_min_runway", ctx.blocking(Some(e.id)), None, Some(detail));
        }
    }
    json!({ "v": 1, "op": "accept", "ok": true, "echo": echo(inp) }).to_string()
}

// ------------------------------------------------------------------------------------------
// authorize
// ------------------------------------------------------------------------------------------

fn op_authorize(ctx: &Ctx) -> String {
    let inp = ctx.inp;
    let e = match find(ctx, "accepted") {
        Ok(e) => e,
        Err(r) => return refuse(inp, r),
    };
    let Some(nonce) = inp.n.as_deref() else { return refuse(inp, "nonce_missing") };
    let p = &ctx.policy;

    // Destination: verified record, approved change after cooling-off, or provisional claim.
    let destination = if e.flags & F_MISMATCH != 0 {
        match e.vc_status.as_deref() {
            Some("approved_cooling_off") => {
                let until = e.vc_decided_at.unwrap_or(u64::MAX).saturating_add(ctx.cooling_ns());
                if inp.now < until {
                    return refuse_with(inp, "vendor_change_cooling_off", vec![], Some(until), None);
                }
                match &e.rec.p {
                    Some(p) => p.clone(),
                    None => return refuse(inp, "record_unreadable"),
                }
            }
            Some("rejected") => return refuse(inp, "vendor_change_rejected"),
            _ => return refuse(inp, "vendor_destination_mismatch"),
        }
    } else if let Some(v) = p.vendors.iter().find(|v| v.id == e.rec.v) {
        // Verified vendor: pay the registry's current destination, never a stale copy.
        let reg = ctx.effective_registry();
        let current = reg.get(&v.id).and_then(|m| m.get(&e.rec.c)).cloned().unwrap_or_default();
        if current.is_empty() {
            return refuse(inp, "vendor_destination_unknown");
        }
        if current != e.rec.x {
            return refuse(inp, "vendor_destination_mismatch");
        }
        current
    } else if let Some(member) = e.rec.v.strip_prefix("member:") {
        // Member payout: the signed roster's CURRENT address, so a rotated address takes effect.
        match p.roster.iter().find(|m| m.id == member) {
            Some(m) => m.payout_address.clone(),
            None => return refuse(inp, "member_not_in_roster"),
        }
    } else {
        // First-time vendor: the destination is the one-time claim bound to this evidence.
        e.rec.x.clone()
    };

    let spendable = ctx.spendable();
    if spendable < 0 {
        // Paying an accepted commitment consumes its own reservation, so spendable does not
        // change; but if the treasury no longer covers what is reserved, nothing goes out.
        let detail = ctx.sealed_detail(json!({ "spendable": ctx.fmt(spendable) }));
        return refuse_with(inp, "would_break_commitments", ctx.blocking(None), None, Some(detail));
    }

    let Some(agent_pk) = crypto::parse_key32(&p.agent_payout_pk) else { return refuse(inp, "policy_unreadable") };
    let amount = e.amount();
    let salt = hex::encode(&ctx.keys.derive("auth-salt", nonce.as_bytes())[..8]);
    let fee = "0";
    let amc = crypto::sha256_hex(format!("takara-ai:amount:{}:{}:{}", inp.asset, amount, salt).as_bytes());
    let dsc = crypto::sha256_hex(format!("takara-ai:destination:{}:{}:{}", e.rec.c, destination, salt).as_bytes());
    let mfc = crypto::sha256_hex(format!("takara-ai:max_fee:{}:{}", fee, salt).as_bytes());
    let opening = json!({ "a": amount.to_string(), "x": destination, "c": e.rec.c, "f": fee, "s": salt }).to_string();
    let eph = ctx.keys.derive("eph-opening", nonce.as_bytes());
    let outflow_after = ctx.outflow.saturating_add(amount);
    json!({
        "v": 1, "op": "authorize", "ok": true, "echo": echo(inp),
        "auth": {
            "sch": "near",
            "dch": e.rec.c,
            "amc": amc,
            "dsc": dsc,
            "mfc": mfc,
            "sp": true,
            "exp": inp.now.saturating_add(p.auth_ttl_secs.saturating_mul(NS_PER_SEC)),
            "op": crypto::seal_to(&agent_pk, eph, opening.as_bytes()),
            "oa": ctx.keys.seal(json!({ "o": outflow_after.to_string() }).to_string().as_bytes()),
        }
    })
    .to_string()
}

// ------------------------------------------------------------------------------------------
// local ops
// ------------------------------------------------------------------------------------------

/// Deterministic report over the decrypted ledger. Every figure is computed here; a model
/// only ever writes prose around these numbers.
fn op_report(ctx: &Ctx) -> String {
    let p = &ctx.policy;
    let burn = ctx.daily_burn();
    let available = ctx.balance as i128 - ctx.outflow as i128;
    let runway_days = if burn == 0 { Value::Null } else { json!(available.max(0) as u128 / burn) };
    let vendor_name = |id: &str| -> String {
        if let Some(v) = p.vendors.iter().find(|v| v.id == id) {
            return v.name.clone();
        }
        if let Some(m) = id.strip_prefix("member:").and_then(|m| p.roster.iter().find(|r| r.id == m)) {
            return m.name.clone();
        }
        id.to_string()
    };
    let commitments: Vec<Value> = ctx
        .entries
        .iter()
        .map(|e| {
            json!({
                "id": e.id, "state": e.state, "priority": e.priority, "vendor": vendor_name(&e.rec.v), "vendor_id": e.rec.v,
                "amount": ctx.fmt(e.amount() as i128), "due_day": e.rec.d, "destination": e.rec.x, "chain": e.rec.c,
                "proposed_destination": e.rec.p, "recurrence": e.rec.r, "flags": e.flags,
                "provisional_vendor": e.flags & F_PROVISIONAL != 0, "new_vendor_over_limit": e.flags & F_NEW_OVER_LIMIT != 0,
                "injection_flagged": e.flags & F_INJECTION != 0, "destination_mismatch": e.flags & F_MISMATCH != 0,
                "vendor_change": e.vc_status, "accepted_by": e.accepted_by,
            })
        })
        .collect();
    json!({
        "v": 1, "op": "report", "ok": true, "symbol": p.symbol, "policy_version": p.version,
        "figures": {
            "treasury_balance": ctx.fmt(ctx.balance as i128),
            "settled_outflow": ctx.fmt(ctx.outflow as i128),
            "reserved": ctx.fmt(ctx.reserved() as i128),
            "spendable": ctx.fmt(ctx.spendable()),
            "daily_recurring_burn": ctx.fmt(burn as i128),
            "runway_days": runway_days,
        },
        "queries": {
            "treasury_balance": "contract.get_config().balance",
            "settled_outflow": "open(contract sealed_outflow)",
            "reserved": "sum(amount) where state == accepted",
            "spendable": "treasury_balance - settled_outflow - reserved",
            "daily_recurring_burn": "sum(monthly-equivalent amount) where state in (claimed, accepted) and recurring, / 30",
            "runway_days": "(treasury_balance - settled_outflow) / daily_recurring_burn",
        },
        "commitments": commitments,
    })
    .to_string()
}

fn seal_to(inp: &Input) -> String {
    let (Some(to), Some(eph), Some(pt)) = (inp.to.as_deref().and_then(crypto::parse_key32), inp.eph.as_deref().and_then(crypto::parse_key32), inp.pt.as_deref()) else {
        return json!({ "v": 1, "op": "seal_to", "ok": false, "reason": "bad_arguments" }).to_string();
    };
    json!({ "v": 1, "op": "seal_to", "ok": true, "sealed": crypto::seal_to(&to, eph, pt.as_bytes()) }).to_string()
}

fn open_opening(inp: &Input) -> String {
    let (Some(sk), Some(sealed)) = (inp.sk.as_deref().and_then(crypto::parse_key32), inp.sealed.as_deref()) else {
        return json!({ "v": 1, "op": "open_opening", "ok": false, "reason": "bad_arguments" }).to_string();
    };
    match crypto::open_with(sk, sealed).and_then(|b| String::from_utf8(b).ok()) {
        Some(pt) => json!({ "v": 1, "op": "open_opening", "ok": true, "opening": serde_json::from_str::<Value>(&pt).unwrap_or(Value::String(pt)), "pk": hex::encode(crypto::public_key_of(sk)) }).to_string(),
        None => json!({ "v": 1, "op": "open_opening", "ok": false, "reason": "opening_unreadable" }).to_string(),
    }
}
