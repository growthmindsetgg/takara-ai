// Takara AI: top up a treasury to the state the demo video expects, with NON-money-moving actions only.
//
// Usage:
//   node scripts/seed-demo.mjs                              testnet, dry run (prints the plan, sends nothing)
//   node scripts/seed-demo.mjs --execute                    testnet, sends the planned transactions
//   NEAR_NETWORK=mainnet node scripts/seed-demo.mjs [--execute]
//                                                           mainnet (amounts scaled by the deployed profile)
// Options:
//   --tag <t>     suffix for seeded invoice numbers (default: a fresh one per run, so a bill the
//                 Signer rejected in a rehearsal can be re-seeded without tripping duplicate_evidence)
//   --no-signer   never fall back to a Signer acceptance (policy-only acceptances)
//   --force       execute even if the treasury had activity in the last 3 minutes (a judge run may
//                 be in progress; seeding mid-run would make its authorizations stale)
//
// The demo expects (docs/demo-script.md):
//   - reserved (accepted) bills: Payroll run, Railway, Inkwell, Tiny Logo
//   - one Big Agency bill left `claimed`, waiting for a Signer, large enough that approving it overdraws
//   - settled payments, including one to Ana
//   - "Caught" refusals (payout change, hidden instructions, duplicate, reserve breach) and one
//     claim from someone who isn't on the team (unknown_requester)
//
// What this script may send: register_claim (email intake, sealed to the engine), request_acceptance
// (policy acceptance: reserves money, transfers nothing) and, when the policy needs one, the Signer's
// accept_commitment (also a reservation only). It never calls request_authorization, settle,
// recover, fund or ft_transfer. Settled payments it cannot create are printed as founder commands.
//
// Idempotent: it reads the owner report first and only plans what is missing.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
const newVendorId = (domain) => `new:${createHash("sha256").update(domain).digest("hex").slice(0, 12)}`;

// The deployment record must exist before the libraries load (they read it at import time).
const RECORD = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", process.env.NEAR_NETWORK === "mainnet" ? "deployment.mainnet.json" : "deployment.json");
if (!existsSync(RECORD)) {
  console.log(`No deployment record (${RECORD}): the ${process.env.NEAR_NETWORK ?? "testnet"} treasury isn't deployed yet. Nothing to do.`);
  process.exit(0);
}
const { call, view, explorer, accountExists } = await import("./lib/near.mjs");
const { intakeDocument } = await import("../backend/intake.mjs");
const K = await import("./lib/takara.mjs");
const { NETWORK, MAINNET, show, UNIT } = await import("./lib/judge-net.mjs");

const { T, AGENT, SIGNER, D } = K;
const argv = process.argv.slice(2);
const EXECUTE = argv.includes("--execute");
const FORCE = argv.includes("--force");
const NO_SIGNER = argv.includes("--no-signer");
const tagArg = argv.includes("--tag") ? argv[argv.indexOf("--tag") + 1] : null;
const TAG = tagArg ?? `S${new Date().toISOString().slice(5, 16).replace(/\D/g, "")}${randomBytes(1).toString("hex")}`;
if (!/^[A-Za-z0-9]{1,16}$/.test(TAG)) throw new Error("--tag must be 1-16 letters or digits");
const ENGINE_DEPOSIT = "0.01 NEAR";

// ------------------------------------------------------------------ amounts (exact, base units)
const DEC = 6n;
const toBase = (s) => { const [i, f = ""] = String(s).replace("-", "").split("."); const v = BigInt(i || "0") * 10n ** DEC + BigInt((f + "000000").slice(0, 6) || "0"); return String(s).startsWith("-") ? -v : v; };
const fmtBase = (v) => { const neg = v < 0n; const a = neg ? -v : v; const fr = (a % 10n ** DEC).toString().padStart(6, "0").replace(/0+$/, ""); return `${neg ? "-" : ""}${a / 10n ** DEC}${fr ? "." + fr : ""}`; };

// ------------------------------------------------------------------ documents
/** A fixture invoice with a seed header and a tagged invoice number (same scheme as the judge's run id). */
function doc(name, { amountWhole } = {}) {
  let raw = K.invoice(name).toString("utf8");
  if (amountWhole != null) raw = raw.replace(/^(Amount:\s*)[\d.,]+/m, `$1${show(amountWhole)}`);
  return Buffer.from(raw.replace(/\n/, `\nX-Takara-Seed: ${TAG}\n`).replace(/^((?:Invoice number:|Invoice)\s*)([A-Z]{2,4}-[\w-]+)/m, `$1$2-${TAG}`));
}
/** A payment request from someone who isn't on the signed roster: the engine refuses it (unknown_requester). */
function strangerDoc() {
  return Buffer.from(
    [
      "From: Sam <sam@fixtureco.example>",
      `X-Takara-Seed: ${TAG}`,
      "To: ap@takara.example",
      "Subject: Payment request: conference ticket",
      "Authentication-Results: mx.takara.example; dkim=pass header.d=fixtureco.example",
      "",
      "FICTIONAL TEST DOCUMENT",
      "Payment request from Sam",
      "Purpose: conference ticket",
      `Amount: ${show(75)} USDC`,
      "",
    ].join("\n"),
  );
}

// ------------------------------------------------------------------ what exists
async function inventory() {
  const cfg = await view(T, "get_config");
  const rep = await K.report();
  const cs = rep.commitments;
  const is = {
    payroll: (c) => c.vendor_id === "payroll",
    railway: (c) => c.vendor_id === "railway",
    inkwell: (c) => c.vendor_id === "inkwell",
    // First-time vendors carry the engine's id "new:" + sha256(sender domain)[..12], not a name.
    tinylogo: (c) => c.vendor_id === newVendorId("tinylogo.example") || /tiny\s*logo/i.test(c.vendor ?? ""),
    bigagency: (c) => c.vendor_id === newVendorId("bigagency.example") || /big\s*agency/i.test(c.vendor ?? ""),
    ana: (c) => c.vendor_id === "member:ana",
  };
  const find = (k, state) => cs.filter((c) => is[k](c) && (!state || c.state === state));
  // Refusals leave no commitment: read them from this machine's decision log (what the app shows),
  // limited to this treasury and to entries newer than its first commitment (the account was redeployed before).
  const first = await view(T, "list_commitments", { from: "0", limit: 1 });
  const since = first.length ? Number(BigInt(first[0].created_at) / 1_000_000n) : 0;
  const logPath = join(K.ROOT, ".data", "decisions.jsonl");
  const decs = existsSync(logPath)
    ? readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((d) => d && d.contract === T && Date.parse(d.at) >= since)
    : [];
  const reasons = (r) => decs.filter((d) => d.value && d.value.reason === r).length;
  const caught = {
    "payout change (frozen)": cs.filter((c) => c.destination_mismatch).length,
    "hidden instructions": cs.filter((c) => c.injection_flagged).length,
    "duplicate invoice": reasons("duplicate_evidence"),
    "reserve breach": reasons("would_break_commitments") + reasons("below_min_runway"),
    "unknown requester": reasons("unknown_requester") + reasons("member_not_in_roster"),
  };
  const lastAt = decs.length ? Math.max(...decs.map((d) => Date.parse(d.at))) : 0;
  return { cfg, rep, cs, find, caught, lastAt };
}

// ------------------------------------------------------------------ plan
function plan(inv) {
  const steps = [];
  const founder = [];
  const notes = [];
  let spendable = toBase(inv.rep.figures.spendable);

  const reserve = (key, file, label, policyAccepts) => {
    const accepted = inv.find(key, "accepted");
    if (accepted.length) return notes.push(`ok    ${label}: reserved (#${accepted.map((c) => c.id).join(", #")})`);
    const claimed = inv.find(key, "claimed").filter((c) => !c.destination_mismatch && !c.injection_flagged);
    const amount = claimed[0] ? toBase(claimed[0].amount) : null;
    if (claimed[0]) steps.push({ kind: "accept", key, label, id: String(claimed[0].id), policyAccepts });
    else steps.push({ kind: "claim+accept", key, label, file, policyAccepts });
    const amt = amount ?? toBase(show(FIXTURE_AMOUNT[key]));
    spendable -= amt;
    notes.push(`TODO  ${label}: ${claimed[0] ? `accept claimed #${claimed[0].id}` : `claim ${file} and accept`} (reserves ${fmtBase(amt)} ${UNIT}, transfers nothing)`);
  };
  reserve("payroll", "payroll-2026-12.eml", "Payroll run", false);
  reserve("railway", "railway-2026-11.eml", "Railway", true);
  reserve("inkwell", "inkwell-2026-11.eml", "Inkwell", true);
  reserve("tinylogo", "tinylogo-001.eml", "Tiny Logo", true);

  // Big Agency: claimed and waiting for a Signer, sized to overdraw.
  const bigAccepted = inv.find("bigagency", "accepted");
  const bigClaimed = inv.find("bigagency", "claimed");
  if (bigAccepted.length) {
    notes.push(`WARN  Big Agency #${bigAccepted[0].id} is already ACCEPTED: the treasury reads "short" for everyone. A Signer should reject it (close_commitment) in the app, then re-run this script.`);
  } else if (bigClaimed.length) {
    const b = bigClaimed[0];
    const after = spendable - toBase(b.amount);
    notes.push(`ok    Big Agency: #${b.id} claimed, ${b.amount} ${UNIT}; approving it would leave ${after < 0n ? `${fmtBase(-after)} ${UNIT} short (overdraws, as the demo needs)` : `${fmtBase(after)} free: DOES NOT overdraw`}`);
    if (after >= 0n) notes.push("WARN  the Big Agency bill no longer overdraws. Reject it as Signer in the app and re-run: a larger one will be seeded.");
  } else {
    let whole = FIXTURE_AMOUNT.bigagency;
    if (toBase(show(whole)) <= spendable) {
      // Next round figure (testnet scale, multiple of 100) that overdraws by a visible margin.
      const scale = toBase(show(1));
      whole = Number(((spendable * 3n) / 2n / scale / 100n + 1n) * 100n);
    }
    const amt = toBase(show(whole));
    steps.push({ kind: "claim+hold", key: "bigagency", label: "Big Agency", file: "bigagency-001.eml", amountWhole: whole === FIXTURE_AMOUNT.bigagency ? null : whole });
    notes.push(`TODO  Big Agency: claim ${amt === toBase(show(FIXTURE_AMOUNT.bigagency)) ? "bigagency-001.eml" : `a Big Agency invoice for ${fmtBase(amt)} ${UNIT}`} and ask for policy acceptance (expect needs_signer_acceptance; stays claimed). Approving would leave ${fmtBase(amt - spendable)} ${UNIT} short.`);
  }

  // Settled payments (cannot be seeded: settle moves real tokens).
  const anaSettled = inv.find("ana", "settled");
  const settledAll = inv.cs.filter((c) => c.state === "settled");
  if (anaSettled.length) notes.push(`ok    Ana: settled (#${anaSettled.map((c) => `${c.id} ${c.amount}`).join(", #")} ${UNIT})`);
  else {
    const anaAcc = inv.find("ana", "accepted")[0];
    founder.push(anaAcc
      ? { why: `Ana #${anaAcc.id} is accepted but not paid. Settling sends ${anaAcc.amount} ${UNIT} to ${anaAcc.destination}.`, cmd: settleCmd(anaAcc.id) }
      : { why: "No settled payment to Ana. The judge run's test 2 creates one (it also moves the other judge payments). Otherwise, after an Ana request is claimed and accepted, settle it with:", cmd: settleCmd("<ana-commitment-id>") });
  }
  notes.push(`info  settled payments on the ledger: ${settledAll.length} (${settledAll.map((c) => `#${c.id} ${c.vendor} ${c.amount}`).join("; ") || "none"})`);

  // Caught.
  for (const [k, n] of Object.entries(inv.caught)) notes.push(`${n ? "ok   " : "gap  "} Caught / ${k}: ${n}`);
  if (!inv.caught["unknown requester"]) steps.push({ kind: "stranger", label: "Unknown requester" });
  if (!inv.caught["hidden instructions"]) steps.push({ kind: "claim-only", label: "Hidden instructions (Railway)", file: "railway-2026-12-injection.eml" });
  if (!inv.caught["payout change (frozen)"]) steps.push({ kind: "claim-only", label: "Payout change (Railway)", file: "railway-2026-12-swapped.eml" });
  if (!inv.caught["duplicate invoice"]) steps.push({ kind: "duplicate", label: "Duplicate (Railway resubmitted)", file: "railway-2026-11.eml" });
  if (!inv.caught["reserve breach"]) notes.push("gap   no reserve-breach refusal in this machine's log. It needs Ana's request refused for lack of free money; the judge's test 1 makes it. Not seeded (a policy acceptance of Ana could succeed and reserve 400).");

  return { steps, founder, notes, spendableAfter: spendable };
}

const FIXTURE_AMOUNT = { payroll: 600, railway: 120, inkwell: 45, tinylogo: 40, bigagency: 900 };

function settleCmd(id) {
  const env = MAINNET ? "NEAR_NETWORK=mainnet " : "";
  return `${env}SETTLE_ID=${id} node --input-type=module -e 'import * as K from "./scripts/lib/takara.mjs"; import { openOpening } from "./scripts/lib/engine.mjs"; const z = await K.requestAuthorization(process.env.SETTLE_ID); if (!z.decision?.ok) throw new Error(z.decision?.reason); const o = (await openOpening(K.ownerKeys().agent_payout_sk, z.decision.opening)).opening; const s = await K.settle(z.decision.auth, K.AGENT, { amount: o.a, receiver_id: o.x, salt: o.s }); console.log(s.txHash, JSON.stringify(s.decision))'`;
}

// ------------------------------------------------------------------ execute
async function submit(buf, label) {
  const intake = await intakeDocument(buf, { enginePk: D.engine.public_key });
  const r = await call(AGENT, T, "register_claim", { sealed_claim: intake.sealed }, { deposit: ENGINE_DEPOSIT });
  console.log(`   register_claim ${label}: ${explorer(r.txHash)}  -> ${r.failure ?? (r.value?.ok ? `claimed #${r.value.commitment_id}` : r.value?.reason)}`);
  return r;
}
async function accept(id, label, policyFirst = true) {
  if (policyFirst) {
    const a = await call(AGENT, T, "request_acceptance", { commitment_id: String(id) }, { deposit: ENGINE_DEPOSIT });
    console.log(`   request_acceptance #${id} (${label}): ${explorer(a.txHash)}  -> ${a.failure ?? (a.value?.ok ? "accepted by policy" : a.value?.reason)}`);
    if (a.value?.ok) return true;
    if (!["needs_signer_acceptance", "below_min_runway"].includes(a.value?.reason)) return false;
  }
  if (NO_SIGNER) { console.log(`   #${id} needs a Signer; --no-signer set, left claimed`); return false; }
  const s = await call(SIGNER, T, "accept_commitment", { commitment_id: String(id) }, { gas: "30.0 Tgas" });
  console.log(`   accept_commitment #${id} (Signer, reservation only): ${explorer(s.txHash)}  -> ${s.failure ?? "accepted"}`);
  return s.ok;
}

async function run(p) {
  for (const s of p.steps) {
    console.log(`\n-> ${s.label} (${s.kind})`);
    if (s.kind === "accept") await accept(s.id, s.label, s.policyAccepts);
    else if (s.kind === "claim+accept") {
      const r = await submit(doc(s.file), s.file);
      if (r.value?.ok) await accept(r.value.commitment_id, s.label, s.policyAccepts);
    } else if (s.kind === "claim+hold") {
      const r = await submit(doc(s.file, { amountWhole: s.amountWhole }), s.file);
      if (r.value?.ok) {
        const a = await call(AGENT, T, "request_acceptance", { commitment_id: String(r.value.commitment_id) }, { deposit: ENGINE_DEPOSIT });
        console.log(`   request_acceptance #${r.value.commitment_id}: ${explorer(a.txHash)}  -> ${a.failure ?? (a.value?.ok ? "ACCEPTED (unexpected: the bill is reserved; reject it as Signer in the app)" : `${a.value?.reason} (stays claimed, waiting for a Signer)`)}`);
      }
    } else if (s.kind === "claim-only") await submit(doc(s.file), s.file);
    else if (s.kind === "stranger") await submit(strangerDoc(), "payment request from Sam (not on the team)");
    else if (s.kind === "duplicate") {
      const b = doc(s.file);
      const first = await submit(b, `${s.file} (original)`);
      // Left claimed (no reservation); the identical resubmission is refused as duplicate_evidence.
      if (first.value?.ok) await submit(b, `${s.file} (identical resubmission)`);
    }
  }
}

// ------------------------------------------------------------------ main
console.log(`Takara AI demo seed: ${NETWORK}, treasury ${T}, ${EXECUTE ? "EXECUTE" : "dry run"}, tag ${TAG}`);
if (!(await accountExists(T))) { console.log(`Treasury ${T} does not exist on ${NETWORK} yet. Nothing to do.`); process.exit(MAINNET ? 0 : 1); }
if (!K.ownerKeys()) throw new Error("owner ledger key not found: this script reads the owner report");

const inv = await inventory();
const f = inv.rep.figures;
console.log(`\nNow: balance ${f.treasury_balance} · settled outflow ${f.settled_outflow} · set aside ${f.reserved} · free to spend ${f.spendable} ${UNIT} · runway ${f.runway_days ?? "-"} days`);
console.log(`     paused ${inv.cfg.paused} · agent ${inv.cfg.agent} · ${inv.cs.length} open/settled commitments`);
const NAMES = { [newVendorId("tinylogo.example")]: "Tiny Logo Studio (new vendor)", [newVendorId("bigagency.example")]: "Big Agency (new vendor)" };
for (const c of inv.cs) console.log(`     #${c.id} ${c.state.padEnd(8)} ${String(c.amount).padStart(8)} ${NAMES[c.vendor_id] ?? c.vendor}${c.destination_mismatch ? " [payout change]" : ""}${c.injection_flagged ? " [hidden instructions]" : ""}${c.provisional_vendor ? " [new vendor]" : ""}${c.new_vendor_over_limit ? " [over new-vendor limit]" : ""}`);

const p = plan(inv);
console.log("\nChecklist:");
for (const n of p.notes) console.log(`  ${n}`);
console.log(`\nPlan (${p.steps.length} step${p.steps.length === 1 ? "" : "s"}, none moves money):`);
p.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}: ${s.kind}${s.file ? ` ${s.file}` : ""}${s.id ? ` #${s.id}` : ""}${s.amountWhole ? ` (amount ${show(s.amountWhole)} ${UNIT})` : ""}`));
console.log(`  free to spend after the plan: ${fmtBase(p.spendableAfter)} ${UNIT} (estimate)`);
if (p.founder.length) {
  console.log("\nFounder-run (moves real tokens; this script never does):");
  for (const x of p.founder) console.log(`  - ${x.why}\n    ${x.cmd}`);
}
if (!inv.cfg.paused && inv.cfg.agent !== AGENT) console.log(`\nWARN the treasury's agent is ${inv.cfg.agent}, not ${AGENT}: agent calls would fail.`);

if (!EXECUTE) { console.log("\nDry run: nothing sent. Re-run with --execute to send the plan."); process.exit(0); }
if (inv.cfg.paused || inv.cfg.agent !== AGENT) { console.log("\nTreasury paused or agent not set: not executing."); process.exit(1); }
if (!FORCE && Date.now() - inv.lastAt < 180_000) {
  console.log(`\nThe treasury had activity ${Math.round((Date.now() - inv.lastAt) / 1000)} s ago (a judge run may be in progress). Not executing; wait or pass --force.`);
  process.exit(1);
}
if (!p.steps.length) { console.log("\nNothing to do: the demo state is complete."); process.exit(0); }
await run(p);
const after = (await K.report()).figures;
console.log(`\nAfter: balance ${after.treasury_balance} · set aside ${after.reserved} · free to spend ${after.spendable} ${UNIT} · runway ${after.runway_days ?? "-"} days`);
console.log("Re-run without --execute to confirm the checklist. Hosted app: run node scripts/build-platform.mjs and redeploy so its activity log includes these entries.");
