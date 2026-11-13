// High-level Takara AI operations over the deployed testnet system.
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { call, view } from "./near.mjs";
import { runEngine } from "./engine.mjs";
import { intakeDocument } from "../../backend/intake.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const D = JSON.parse(readFileSync(join(ROOT, "fixtures", "deployment.json"), "utf8"));
export const T = D.accounts.treasury;
export const AGENT = D.accounts.agent;
export const SIGNER = D.accounts.signer;
export const OWNER = D.owner;
const ENGINE_DEPOSIT = "0.01 NEAR";

export function ownerKeys() {
  const p = join(ROOT, ".secrets", "keys.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export const invoice = (name) => readFileSync(join(ROOT, "fixtures", "invoices", name));

export async function submitDocument(name, as = AGENT) {
  const intake = await intakeDocument(invoice(name), { enginePk: D.engine.public_key });
  const r = await call(as, T, "register_claim", { sealed_claim: intake.sealed }, { deposit: ENGINE_DEPOSIT });
  return { intake, ...r, decision: r.value };
}

export const requestAcceptance = (id, as = AGENT) => call(as, T, "request_acceptance", { commitment_id: String(id) }, { deposit: ENGINE_DEPOSIT }).then((r) => ({ ...r, decision: r.value }));
export const requestAuthorization = (id, as = AGENT) => call(as, T, "request_authorization", { commitment_id: String(id) }, { deposit: ENGINE_DEPOSIT }).then((r) => ({ ...r, decision: r.value }));
export const settle = (auth, as = AGENT) => call(as, T, "settle", { auth }, { gas: "50.0 Tgas" }).then((r) => ({ ...r, decision: r.value }));
export const signerAccept = (id, as = SIGNER) => call(as, T, "accept_commitment", { commitment_id: String(id) }, { gas: "30.0 Tgas" });
export const approveVendorChange = (id, as = SIGNER) => call(as, T, "approve_vendor_change", { change_id: String(id) }, { gas: "30.0 Tgas" });

/** Owner-only deterministic report: runs the same engine binary locally over the on-chain ledger.
 *  The key is passed in the input (local only); the engine refuses this op with the TEE key. */
export async function report() {
  const keys = ownerKeys();
  if (!keys) throw new Error("owner keys not found (.secrets/keys.json): reports are for the owner");
  const input = JSON.parse(await view(T, "preview_engine_input", { op: "claim", commitment_id: null }));
  // The owner's report lists every non-closed commitment, including settled ones (the engine's
  // contract input omits ordinary settled ones; their amounts are already in the outflow total,
  // and the report's reserved/burn figures only count claimed/accepted, so figures are unchanged).
  const all = [];
  for (let from = 0; ; from += 100) {
    const page = await view(T, "list_commitments", { from: String(from), limit: 100 });
    all.push(...page);
    if (page.length < 100) break;
  }
  const changes = Object.fromEntries((await view(T, "list_vendor_changes")).map((v) => [v.id, v]));
  input.cs = all
    .filter((c) => c.state !== "closed")
    .map((c) => {
      const vc = c.vendor_change != null ? changes[c.vendor_change] : null;
      const acc = c.accepted_by === "policy" ? "p" : c.accepted_by ? "s" : "";
      return [Number(c.id), c.state, c.priority, c.flags, acc, c.sealed, vc?.settlement_status ?? null, vc?.decided_at ? Number(vc.decided_at) : null];
    });
  const r = await runEngine({ ...input, op: "report", sk: keys.engine_sk });
  // The engine's label predates the audit fix (M6): the burn counts accepted recurrences only.
  if (r.queries) r.queries.daily_recurring_burn = "sum(monthly-equivalent amount) where state == accepted and recurring, / 30";
  return r;
}

/** Owner-only: open a sealed refusal detail or record. */
export async function openSealed(sealed) {
  const keys = ownerKeys();
  if (!keys) throw new Error("owner keys not found");
  const r = await runEngine({ v: 1, op: "open_local", sk: keys.engine_sk, sealed });
  return r.ok ? r.plaintext : null;
}
