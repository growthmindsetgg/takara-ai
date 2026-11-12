// One-time testnet setup for Takara AI. Idempotent: re-running skips what exists.
// Usage: TAKARA_OWNER=<your>.testnet node scripts/setup-testnet.mjs [--redeploy-treasury]
//
// Accounts (sub-accounts of the owner, created and funded from it):
//   treasury.<owner>  Takara AI treasury contract
//   tusdc.<owner>     fictional test stablecoin (no value)
//   agent.<owner>     execution authority (the agent)
//   signer.<owner>    policy signer
// The owner account itself holds ownership authority.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accountExists, call, cli, view, NETWORK } from "./lib/near.mjs";
import { runEngine, ENGINE_WASM, publicKey } from "./lib/engine.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = process.env.TAKARA_OWNER ?? "takara-ai-hq.testnet";
const A = { treasury: `treasury.${OWNER}`, tusdc: `tusdc.${OWNER}`, agent: `agent.${OWNER}`, signer: `signer.${OWNER}` };
const FUND = { treasury: "4 NEAR", tusdc: "2 NEAR", agent: "1.2 NEAR", signer: "0.3 NEAR" };
const SECRETS = join(ROOT, ".secrets");
const DEPLOY = join(ROOT, "fixtures", "deployment.json");
const redeploy = process.argv.includes("--redeploy-treasury");
const log = (...a) => console.log("•", ...a);
const artifact = (built, name) => (existsSync(join(ROOT, built)) ? join(ROOT, built) : join(ROOT, "dist", name));

// 1. Keys (owner-side, never committed). The engine key is the business's ledger key: the
//    owner keeps a copy so they can always read their own books.
mkdirSync(SECRETS, { recursive: true });
const keysPath = join(SECRETS, "keys.json");
const keys = existsSync(keysPath) ? JSON.parse(readFileSync(keysPath, "utf8")) : { engine_sk: randomBytes(32).toString("hex"), agent_payout_sk: randomBytes(32).toString("hex") };
writeFileSync(keysPath, JSON.stringify(keys, null, 2));
const enginePk = await publicKey(keys.engine_sk);
const agentPayoutPk = (await runEngine({ v: 1, op: "pubkey" }, { TAKARA_ENGINE_SK: keys.agent_payout_sk })).pk;
log("engine public key", enginePk);

const deployment = existsSync(DEPLOY) ? JSON.parse(readFileSync(DEPLOY, "utf8")) : {};

// 2. Engine wasm on FastFS.
const wasm = readFileSync(ENGINE_WASM);
const wasmHash = createHash("sha256").update(wasm).digest("hex");
let wasmUrl = deployment.engine?.wasm_hash === wasmHash ? deployment.engine.wasm_url : null;
if (!wasmUrl) {
  log("uploading engine", wasmHash);
  const r = spawnSync("outlayer", ["upload", ENGINE_WASM], { encoding: "utf8" });
  const m = ((r.stdout ?? "") + (r.stderr ?? "")).match(/FastFS URL:\s*(https:\/\/\S+)/);
  if (!m) throw new Error(`outlayer upload failed:\n${r.stdout}\n${r.stderr}`);
  wasmUrl = m[1];
}
log("engine", wasmUrl);

// 3. Engine secret, bound to this exact wasm hash. Readable only when the agent signs AND the call
//    comes through the treasury contract: the agent cannot call OutLayer directly with the key.
if (deployment.secret_for_hash !== wasmHash || deployment.secret_rule !== `agent-via-treasury`) {
  log("binding engine secret to", wasmHash, "for", A.treasury);
  const r = spawnSync("outlayer", ["secrets", "set", JSON.stringify({ TAKARA_ENGINE_SK: keys.engine_sk }), "--wasm-hash", wasmHash, "--access", `whitelist:${A.agent}`, "--via", A.treasury], { encoding: "utf8" });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(`outlayer secrets set failed:\n${out}`);
  deployment.secret_for_hash = wasmHash;
  deployment.secret_rule = `agent-via-treasury`;
}

// 4. Accounts.
for (const [k, id] of Object.entries(A)) {
  if (await accountExists(id)) continue;
  log("creating", id, "funded with", FUND[k]);
  cli(["account", "create-account", "fund-myself", id, FUND[k], "autogenerate-new-keypair", "save-to-legacy-keychain", "sign-as", OWNER, "network-config", NETWORK, "sign-with-legacy-keychain", "send"]);
}

// 5. Test token.
const hasCode = (id) => {
  const out = cli(["account", "view-account-summary", id, "network-config", NETWORK, "now"], { allowFail: true });
  return !/Contract\s+No contract code/i.test(out) && /Contract\s+\(?SHA|Contract\s+[1-9A-HJ-NP-Za-km-z]{30,}|Contract code SHA/i.test(out);
};
const tokenReady = await view(A.tusdc, "ft_metadata").then(() => true).catch(() => false);
if (!tokenReady) {
  log("deploying tUSDC to", A.tusdc);
  cli(["contract", "deploy", A.tusdc, "use-file", artifact("mock-ft/target/near/takara_mock_ft.wasm", "takara_mock_ft.wasm"), "with-init-call", "new", "json-args", JSON.stringify({ minter: OWNER }), "prepaid-gas", "100.0 Tgas", "attached-deposit", "0 NEAR", "network-config", NETWORK, "sign-with-legacy-keychain", "send"]);
}

// 6. Policy bundle, sealed to the engine.
const template = readFileSync(join(ROOT, "fixtures", "policy.template.json"), "utf8");
const policyPt = JSON.stringify(JSON.parse(template.replaceAll("${ASSET}", A.tusdc).replaceAll("${AGENT_PAYOUT_PK}", agentPayoutPk).replaceAll("${SIGNER}", A.signer)));
const sealedPolicy = await runEngine({ v: 1, op: "seal_policy_local", pt: policyPt, eph: randomBytes(32).toString("hex") }, { TAKARA_ENGINE_SK: keys.engine_sk });
writeFileSync(join(SECRETS, "policy.plain.json"), policyPt); // owner's own copy
log("policy hash", sealedPolicy.hash);

// 7. Treasury.
const treasuryReady = await view(A.treasury, "get_config").then(() => true).catch(() => false);
if (!treasuryReady || redeploy) {
  log(treasuryReady ? "redeploying" : "deploying", "treasury to", A.treasury);
  const init = {
    owners: [OWNER],
    agent: A.agent,
    outlayer: NETWORK === "mainnet" ? "outlayer.near" : "outlayer.testnet",
    engine: { wasm_url: wasmUrl, wasm_hash: wasmHash, build_target: "wasm32-wasip1" },
    secrets: { profile: "default", account_id: OWNER },
    asset: A.tusdc,
    policy: { version: 1, hash: sealedPolicy.hash, signers: [A.signer], threshold: 1, expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n), sealed: sealedPolicy.sealed },
  };
  const args = ["contract", "deploy", A.treasury, "use-file", artifact("contract/target/near/takara_treasury.wasm", "takara_treasury.wasm")];
  if (!treasuryReady || process.argv.includes("--reinit")) args.push("with-init-call", "new", "json-args", JSON.stringify(init), "prepaid-gas", "100.0 Tgas", "attached-deposit", "0 NEAR");
  else args.push("without-init-call");
  args.push("network-config", NETWORK, "sign-with-legacy-keychain", "send");
  cli(args);
}
const cfg = await view(A.treasury, "get_config");
if (cfg.engine.wasm_hash !== wasmHash) {
  log("pinning new engine build", wasmHash);
  const r = await call(OWNER, A.treasury, "set_engine", { engine: { wasm_url: wasmUrl, wasm_hash: wasmHash, build_target: "wasm32-wasip1" } }, { deposit: "1 yoctoNEAR", gas: "30.0 Tgas" });
  if (!r.ok) throw new Error(`set_engine failed: ${r.failure}`);
}

// 8. Funding: register, mint, deposit 1,000 tUSDC into the treasury.
if (BigInt((await view(A.treasury, "get_config")).balance) === 0n) {
  for (const id of [A.treasury, OWNER]) await call(OWNER, A.tusdc, "register", { account_id: id }, { gas: "30.0 Tgas" });
  await call(OWNER, A.tusdc, "mint", { account_id: OWNER, amount: "100000000000" }, { gas: "30.0 Tgas" });
  const r = await call(OWNER, A.tusdc, "ft_transfer_call", { receiver_id: A.treasury, amount: "1000000000", msg: "" }, { deposit: "1 yoctoNEAR", gas: "100.0 Tgas" });
  log("funded treasury with 1,000 tUSDC", r.ok ? "ok" : r.failure);
}

// 9. Public deployment record (no secrets).
Object.assign(deployment, {
  network: NETWORK,
  owner: OWNER,
  accounts: A,
  engine: { wasm_url: wasmUrl, wasm_hash: wasmHash, build_target: "wasm32-wasip1", public_key: enginePk },
  agent_payout_public_key: agentPayoutPk,
  policy_hash: (await view(A.treasury, "get_config")).policy_hash,
});
writeFileSync(DEPLOY, JSON.stringify(deployment, null, 2) + "\n");
const final = await view(A.treasury, "get_config");
console.log(JSON.stringify({ treasury: A.treasury, balance: final.balance, policy_version: final.policy_version, engine: final.engine.wasm_hash, agent: final.agent, signers: final.signers }, null, 2));
