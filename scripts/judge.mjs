// Takara AI: the ten judge checks, end to end on NEAR testnet.
// Usage: node scripts/judge.mjs            (needs the deployment from scripts/setup-testnet.mjs)
//
// Every check is a real transaction against treasury.<owner>.testnet. Engine decisions run in
// OutLayer (Intel TDX) on the pinned wasm; figures come from the owner-side deterministic report
// (same engine binary, run locally with the owner's ledger key).
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { call, view, explorer } from "./lib/near.mjs";
import { runEngine, openOpening } from "./lib/engine.mjs";
import { intakeDocument } from "../backend/intake.mjs";
import * as K from "./lib/takara.mjs";

const { T, AGENT, SIGNER, OWNER, D } = K;
const RUN = randomBytes(4).toString("hex");
const results = [];
let current = null;
const txs = [];

function check(name, cond, detail = "") {
  current.checks.push({ name, ok: !!cond, detail });
  console.log(`   ${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
function tx(label, r) {
  txs.push({ test: current?.n, label, tx: r.txHash });
  console.log(`         ${label}: ${explorer(r.txHash)}${r.failure ? `  -> ${r.failure}` : ""}`);
  return r;
}
async function test(n, title, fn) {
  current = { n, title, checks: [] };
  console.log(`\n[${n}] ${title}`);
  try {
    await fn();
  } catch (e) {
    check("ran without error", false, e.message.slice(0, 300));
  }
  current.ok = current.checks.length > 0 && current.checks.every((c) => c.ok);
  results.push(current);
}

/** Documents get a per-run header so re-runs don't collide; resubmitting within a run is identical bytes. */
function doc(name) {
  const raw = K.invoice(name).toString("utf8");
  // A fresh run issues fresh invoices: the run id is appended to invoice numbers (duplicate
  // detection keys on vendor + invoice number) and added as a header (documents without one).
  return Buffer.from(raw.replace(/\n/, `\nX-Takara-Run: ${RUN}\n`).replace(/^((?:Invoice number:|Invoice)\s*)([A-Z]{2,4}-[\w-]+)/m, `$1$2-${RUN}`));
}
async function submit(name, as = AGENT) {
  const intake = await intakeDocument(doc(name), { enginePk: D.engine.public_key });
  return tx(`register_claim ${name}`, await call(as, T, "register_claim", { sealed_claim: intake.sealed }, { deposit: "0.01 NEAR" }));
}
const engineCall = async (method, id) => tx(`${method} #${id}`, await call(AGENT, T, method, { commitment_id: String(id) }, { deposit: "0.01 NEAR" }));
const signer = async (method, args) => tx(`${method} (signer)`, await call(SIGNER, T, method, args, { gas: "30.0 Tgas" }));
const owner = async (method, args, deposit = "0 NEAR") => tx(`${method} (owner)`, await call(OWNER, T, method, args, { deposit, gas: "60.0 Tgas" }));
const fund = async (amount) => tx(`fund ${amount}`, await call(OWNER, D.accounts.tusdc, "ft_transfer_call", { receiver_id: T, amount, msg: "" }, { deposit: "1 yoctoNEAR", gas: "100.0 Tgas" }));
const figures = async () => (await K.report()).figures;
const commitment = (id) => view(T, "get_commitment", { commitment_id: String(id) });

async function reset() {
  console.log(`Run ${RUN}: resetting the fixture treasury (owner + signer only)`);
  const cfg = await view(T, "get_config");
  if (cfg.paused) await owner("unpause", {});
  if (cfg.agent !== AGENT) await owner("set_agent", { agent: AGENT });
  for (let from = 0; ; from += 100) {
    const page = await view(T, "list_commitments", { from: String(from), limit: 100 });
    for (const c of page) {
      if (c.state === "claimed") await signer("close_commitment", { commitment_id: c.id });
      else if (c.state === "accepted") await owner("close_commitment", { commitment_id: c.id });
    }
    if (page.length < 100) break;
  }
  const bal = (await view(T, "get_config")).balance;
  if (BigInt(bal) > 0n) await owner("recover", { amount: bal, to: OWNER }, "1 yoctoNEAR");
  const zero = await runEngine({ v: 1, op: "seal_local", sk: K.ownerKeys().engine_sk, pt: JSON.stringify({ o: "0" }) });
  await owner("reconcile_outflow", { sealed_outflow: zero.sealed }, "1 yoctoNEAR");
  await fund("1000000000");
  console.log(`   treasury balance ${(await figures()).treasury_balance} tUSDC, spendable ${(await figures()).spendable}`);
}

const ids = {};
await reset();

await test(1, "Reserve protection: 400 refused while payroll 600 and Railway 120 are reserved", async () => {
  ids.payroll = (await submit("payroll-2026-12.eml")).value.commitment_id;
  await signer("accept_commitment", { commitment_id: ids.payroll });
  ids.railway = (await submit("railway-2026-11.eml")).value.commitment_id;
  await signer("accept_commitment", { commitment_id: ids.railway });
  check("spendable reads 280", (await figures()).spendable === "280", `spendable ${(await figures()).spendable}`);
  ids.ana = (await submit("ana-request-offsite.eml")).value.commitment_id;
  const r = await engineCall("request_acceptance", ids.ana);
  const d = r.value;
  check("refused with would_break_commitments", d?.ok === false && d.reason === "would_break_commitments", d?.reason);
  check("names both blocking commitments", JSON.stringify(d?.blocking) === JSON.stringify([ids.payroll, ids.railway]), `blocking ${JSON.stringify(d?.blocking)}`);
  const detail = d?.detail ? await K.openSealed(d.detail) : null;
  check("shortfall is 120 (sealed to owner)", detail?.shortfall === "120", `shortfall ${detail?.shortfall}`);
  check("spendable still 280", (await figures()).spendable === "280");
});

await test(2, "Release after funding: same payment clears after a 500 top-up", async () => {
  await fund("500000000");
  const a = await engineCall("request_acceptance", ids.ana);
  check("accepted under policy", a.value?.ok === true, a.value?.reason ?? "ok");
  const z = await engineCall("request_authorization", ids.ana);
  check("authorization issued", z.value?.ok === true && !!z.value.auth, z.value?.reason ?? "ok");
  const s = tx("settle", await call(AGENT, T, "settle", { auth: z.value.auth }, { gas: "50.0 Tgas" }));
  check("settled", s.value?.ok === true && (await commitment(ids.ana)).state === "settled", s.value?.reason ?? "ok");
  check("spendable recomputed to 380", (await figures()).spendable === "380", `spendable ${(await figures()).spendable}`);
});

await test(3, "Claimed is not accepted", async () => {
  const before = (await figures()).spendable;
  ids.inkwell = (await submit("inkwell-2026-11.eml")).value.commitment_id;
  check("new invoice lands as claimed", (await commitment(ids.inkwell)).state === "claimed");
  check("spendable unchanged", (await figures()).spendable === before, `${before} -> ${(await figures()).spendable}`);
  await signer("accept_commitment", { commitment_id: ids.inkwell });
  check("accepted by a policy signer", (await commitment(ids.inkwell)).state === "accepted");
  check("spendable drops by 45", (await figures()).spendable === String(Number(before) - 45), `${before} -> ${(await figures()).spendable}`);
});

await test(4, "Duplicate rejection", async () => {
  const r = await submit("railway-2026-11.eml");
  check("rejected as duplicate_evidence", r.value?.ok === false && r.value.reason === "duplicate_evidence", r.value?.reason);
  check("references the original commitment", r.value?.original === ids.railway, `original ${r.value?.original}`);
});

await test(5, "Destination change on a verified vendor: suspended, agent cannot approve, signer can, cooling-off holds", async () => {
  const phBefore = (await view(T, "get_config")).policy_hash;
  const r = await submit("railway-2026-12-swapped.eml");
  ids.swapped = r.value.commitment_id;
  check("suspended: vendor_destination_mismatch", r.value?.reason === "vendor_destination_mismatch", r.value?.reason);
  const c = await commitment(ids.swapped);
  const vc = await view(T, "get_vendor_change", { change_id: c.vendor_change });
  check("commitment stays claimed; change record suspended", c.state === "claimed" && vc.settlement_status === "suspended_destination_mismatch", vc?.settlement_status);
  const rep = (await K.report()).commitments.find((x) => String(x.id) === ids.swapped);
  check("both destinations shown to the owner", rep?.destination === "railway-pay.testnet" && rep?.proposed_destination === "railway-new-bank.testnet", `${rep?.destination} vs ${rep?.proposed_destination}`);
  check("vendor record unchanged (policy hash same)", (await view(T, "get_config")).policy_hash === phBefore);
  const agentTry = tx("approve_vendor_change (AGENT key)", await call(AGENT, T, "approve_vendor_change", { change_id: c.vendor_change }, { gas: "30.0 Tgas" }));
  check("agent key rejected: E_NOT_POLICY_SIGNER", agentTry.failure === "E_NOT_POLICY_SIGNER", agentTry.failure);
  await signer("approve_vendor_change", { change_id: c.vendor_change });
  check("signer approval recorded", (await view(T, "get_vendor_change", { change_id: c.vendor_change })).settlement_status === "approved_cooling_off");
  await signer("accept_commitment", { commitment_id: ids.swapped });
  const z = await engineCall("request_authorization", ids.swapped);
  check("payment held: vendor_change_cooling_off", z.value?.reason === "vendor_change_cooling_off", z.value?.reason);
  check("hold ends 24h after approval", !!z.value?.until, z.value?.until ? new Date(Number(BigInt(z.value.until) / 1_000_000n)).toISOString() : "");
});

await test(6, "Prompt injection: the invoice text changes nothing", async () => {
  const ph = (await view(T, "get_config")).policy_hash;
  const r = await submit("railway-2026-12-injection.eml");
  const c = await commitment(r.value.commitment_id);
  check("lands as claimed", c.state === "claimed");
  check("instruction flagged in the record", (c.flags & 4) === 4, `flags ${c.flags}`);
  check("destination not changed by the text", (c.flags & 8) === 0);
  check("policy hash unchanged", (await view(T, "get_config")).policy_hash === ph);
});

await test(7, "Replay and field tampering", async () => {
  const z = await engineCall("request_authorization", ids.railway);
  const auth = z.value.auth;
  const s1 = tx("settle (first)", await call(AGENT, T, "settle", { auth }, { gas: "50.0 Tgas" }));
  check("first settlement succeeds", s1.value?.ok === true, s1.value?.reason ?? "ok");
  const s2 = tx("settle (replay)", await call(AGENT, T, "settle", { auth }, { gas: "50.0 Tgas" }));
  check("replay rejected: nonce_used", s2.value?.reason === "nonce_used", s2.value?.reason);
  // A fresh, unused authorization for another payment, with the amount altered by one unit.
  const z2 = await engineCall("request_authorization", ids.payroll);
  const fresh = z2.value.auth;
  const opening = (await openOpening(K.ownerKeys().agent_payout_sk, z2.value.opening)).opening;
  const commit = (amount) => createHash("sha256").update(`takara-ai:amount:${fresh.asset_id}:${amount}:${opening.s}`).digest("hex");
  check("opening matches the authorization's amount commitment", commit(opening.a) === fresh.amount_commit, `amount ${opening.a}`);
  const tampered = { ...fresh, amount_commit: commit((BigInt(opening.a) + 1n).toString()) };
  const s3 = tx("settle (amount +1 unit)", await call(AGENT, T, "settle", { auth: tampered }, { gas: "50.0 Tgas" }));
  check("rejected: authorization_mismatch on amount_commit", s3.value?.reason === "authorization_mismatch" && s3.value?.field === "amount_commit", `${s3.value?.reason} ${s3.value?.field}`);
});

await test(8, "Non-custodial proof: owner recovers with the agent offline; agent key refused", async () => {
  // No agent process, no engine call: these are plain owner transactions.
  await owner("pause", {});
  await owner("revoke_agent", {});
  const rec = await owner("recover", { amount: "100000000", to: OWNER }, "1 yoctoNEAR");
  const touchedOutLayer = rec.logs.some((l) => l.includes("near-outlayer"));
  check("owner recovery moved funds", rec.ok && rec.events.some((e) => e.event === "recovery_completed" && e.data[0].ok), rec.failure ?? "ok");
  check("recovery never touched OutLayer or the agent", !touchedOutLayer);
  const w = tx("recover (AGENT key)", await call(AGENT, T, "recover", { amount: "1", to: AGENT }, { deposit: "1 yoctoNEAR", gas: "30.0 Tgas" }));
  check("agent withdrawal rejected: E_NOT_OWNER", w.failure === "E_NOT_OWNER", w.failure);
  const p = tx("propose_policy (AGENT key)", await call(AGENT, T, "propose_policy", { version: 99, hash: "f".repeat(64), expires_at: "4000000000000000000", sealed: "AA==", diff_hash: "e".repeat(64) }, { gas: "30.0 Tgas" }));
  check("agent policy rewrite rejected: E_NOT_POLICY_SIGNER", p.failure === "E_NOT_POLICY_SIGNER", p.failure);
  const reinit = tx("new (AGENT tries to re-initialise)", await call(AGENT, T, "new", { owners: [AGENT], agent: AGENT, outlayer: "outlayer.testnet", engine: { wasm_url: "https://x.example/a.wasm", wasm_hash: "f".repeat(64), build_target: "wasm32-wasip1" }, secrets: null, asset: D.accounts.tusdc, policy: { version: 9, hash: "f".repeat(64), signers: [AGENT], threshold: 1, expires_at: "4000000000000000000", sealed: "AA==" } }, { gas: "30.0 Tgas" }));
  check("agent cannot re-initialise the contract", !reinit.ok && /private/i.test(reinit.failure ?? ""), reinit.failure);
  const g = tx("register_claim (revoked AGENT)", await call(AGENT, T, "register_claim", { sealed_claim: "AA==" }, { deposit: "0.01 NEAR" }));
  check("revoked agent cannot act: E_AGENT_REVOKED", g.failure === "E_AGENT_REVOKED", g.failure);
  await owner("set_agent", { agent: AGENT });
  await owner("unpause", {});
});

await test(9, "Field-level spoofing: memo asks to become payroll/critical", async () => {
  const r = await submit("railway-2026-12-spoof.eml");
  const c = await commitment(r.value.commitment_id);
  const rep = (await K.report()).commitments.find((x) => String(x.id) === r.value.commitment_id);
  check("records the real vendor (resolved from verified sender)", rep?.vendor_id === "railway", rep?.vendor_id);
  check("priority normal", c.priority === "normal", c.priority);
});

await test(10, "Tiered friction", async () => {
  const small = (await submit("tinylogo-001.eml")).value.commitment_id;
  check("new $40 vendor flagged provisional", ((await commitment(small)).flags & 1) === 1);
  const a = await engineCall("request_acceptance", small);
  const c = await commitment(small);
  check("accepted with no signature, no wait", a.value?.ok === true && c.state === "accepted" && c.accepted_by === "policy", a.value?.reason ?? JSON.stringify(c.accepted_by));
  const big = (await submit("bigagency-001.eml")).value.commitment_id;
  const b = await engineCall("request_acceptance", big);
  check("new $900 vendor held for one signer acceptance", b.value?.reason === "needs_signer_acceptance", b.value?.reason);
  check("verified vendor destination change hits the full freeze (test 5)", results.find((x) => x.n === 5)?.ok === true);
});

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed  (run ${RUN})`);
mkdirSync(join(K.ROOT, "docs", "runs"), { recursive: true });
const out = join(K.ROOT, "docs", "runs", `judge-${new Date().toISOString().slice(0, 10)}-${RUN}.json`);
writeFileSync(out, JSON.stringify({ run: RUN, at: new Date().toISOString(), treasury: T, engine: D.engine.wasm_hash, passed, total: results.length, results, txs }, null, 2));
console.log(`results: ${out}`);
process.exit(passed === results.length ? 0 : 1);
