// Rebuild the local decision log (used by the read-only chat) from a judge run's transactions,
// reading every outcome back from chain.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { outcome, recordDecision } from "./lib/near.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(ROOT, "docs", "runs");
const file = process.argv[2] ?? join(dir, readdirSync(dir).filter((f) => f.endsWith(".json")).sort().pop());
const run = JSON.parse(readFileSync(file, "utf8"));
const D = JSON.parse(readFileSync(join(ROOT, "fixtures", "deployment.json"), "utf8"));
const signerOf = (label) => (/\(owner\)|fund/.test(label) ? D.owner : /\(signer\)/.test(label) ? D.accounts.signer : D.accounts.agent);
let n = 0;
for (const t of run.txs) {
  const r = await outcome(t.tx, signerOf(t.label));
  recordDecision(signerOf(t.label), D.accounts.treasury, t.label.split(" ")[0], r);
  n++;
}
console.log(`replayed ${n} transactions from ${file}`);
