// NEAR mainnet setup for Takara AI. Idempotent and phased: re-running skips what exists.
//
//   node scripts/setup-mainnet.mjs plan [--wasm <file>]    the exact NEAR this profile needs, nothing sent
//   node scripts/setup-mainnet.mjs status                  balances, nothing sent
//   node scripts/setup-mainnet.mjs owner                   create takara-ai-hq.near from the funding implicit account
//   node scripts/setup-mainnet.mjs accounts                treasury / agent / signer / payee sub-accounts, USDC storage
//   node scripts/setup-mainnet.mjs outlayer                engine upload to FastFS, secret binding, engine smoke runs
//   node scripts/setup-mainnet.mjs treasury --wasm <file> --yes-deploy [--settle-moves-tokens]
//                                                          deploy + init the treasury, write fixtures/deployment.mainnet.json
//
// Profiles (--profile <name> on the first run; it is then remembered in the progress file):
//   default  amounts 1/100 of testnet (treasury 10 + 5 USDC), 5 payees, treasury 5 / agent 1.5 / signer 0.3 NEAR
//   min      amounts 1/1000 (treasury 1 + 0.5 USDC), 2 payees, treasury sized from the wasm, agent 0.5 / signer 0.05
//
// Signing: near-cli-rs with the legacy keychain (~/.near-credentials/mainnet). Every generated key is
// also copied to .secrets/mainnet/ (git-ignored). Nothing here moves USDC: the founder funds the
// treasury and runs the judge (which settles and recovers) with the commands in docs/mainnet-deployment.md.
// Public progress (accounts, tx hashes, hashes, smoke results) goes to fixtures/mainnet/setup-progress.json;
// fixtures/deployment.mainnet.json is written only once the treasury is deployed, because the app
// treats its presence as "mainnet is live".
process.env.NEAR_NETWORK = "mainnet";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { accountExists, call, cli, view, outcome, NETWORK, RPC, OUTLAYER, explorer } = await import("./lib/near.mjs");
const { runEngine, publicKey } = await import("./lib/engine.mjs");
if (NETWORK !== "mainnet") throw new Error("setup-mainnet must run with NEAR_NETWORK=mainnet");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUNDER = "ba7d4784f723099055e3d61cca98519912bd4d9b7b1437d56e2263279d327364";
const OWNER = process.env.TAKARA_OWNER ?? "takara-ai-hq.near";
const USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const A = { treasury: `treasury.${OWNER}`, agent: `agent.${OWNER}`, signer: `signer.${OWNER}` };
const PROFILES = {
  default: { fixtures: "fixtures/mainnet", fund: { treasury: 5, agent: 1.5, signer: 0.3, payee: 0.02 }, ownerFundMax: 11.7, funderKeep: 0.25, ownerReserve: 0.4, treasuryInAccounts: true },
  // treasury: null = sized from the wasm at deploy time (the account is created then, with exactly that).
  min: { fixtures: "fixtures/mainnet-min", fund: { treasury: null, agent: 0.5, signer: 0.05, payee: 0.01 }, ownerFundMax: Infinity, funderKeep: 0.05, ownerReserve: 0.3, treasuryInAccounts: false },
};
const STORAGE_DEPOSIT = "0.00125 NEAR"; // USDC storage_balance_bounds (measured: min = max = 0.00125)
const ENGINE_DEPOSIT = "0.01 NEAR"; // OutLayer run, ~0.0011 used, rest refunded to the payer

const SECRETS = join(ROOT, ".secrets", "mainnet");
const KEYCHAIN = join(homedir(), ".near-credentials", "mainnet");
const PROGRESS = join(ROOT, "fixtures", "mainnet", "setup-progress.json");
const PREV = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, "utf8")) : null;
const DEPLOY = join(ROOT, "fixtures", "deployment.mainnet.json");
const ENGINE_WASM = join(ROOT, "dist", "takara-engine.wasm");
const PINNED_TESTNET = JSON.parse(readFileSync(join(ROOT, "fixtures", "deployment.json"), "utf8")).engine.wasm_hash;

const args = process.argv.slice(2);
const phase = args[0] ?? "status";
const flag = (n) => args.includes(n);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const log = (...a) => console.log("•", ...a);

const PROFILE = opt("--profile") ?? PREV?.profile ?? "default";
if (!PROFILES[PROFILE]) throw new Error(`unknown profile ${PROFILE}: ${Object.keys(PROFILES).join(", ")}`);
if (PREV?.profile && PREV.profile !== PROFILE) throw new Error(`this setup already runs profile "${PREV.profile}"; refusing to switch to "${PROFILE}"`);
const PR = PROFILES[PROFILE];
const PF = JSON.parse(readFileSync(join(ROOT, PR.fixtures, "profile.json"), "utf8"));
// Founder-owned payees the profile's fixtures pay. The swapped-bank and attacker destinations are
// deliberately never created: nothing should ever be able to pay them.
const PAYEES = PF.payees_created;
const FUND = PR.fund;
const OWNER_FUND_MAX = Number(process.env.TAKARA_OWNER_FUND ?? PR.ownerFundMax);
const FUNDER_KEEP = PR.funderKeep; // gas for the one creation tx, the rest stays with the founder
const OWNER_RESERVE = PR.ownerReserve; // never spend the owner below this

// Treasury sizing: storage is 1 NEAR per 100 KB. Code + account/key records + init state (sealed
// policy, config) + what one judge run adds (about 12 commitments, nonces, a vendor change), plus
// gas for the deploy itself. OutLayer refunds (~0.009 NEAR per engine call) also flow back to it.
const TREASURY_BYTES = { account: 300, init_state: 6_000, run_state: 24_000 };
const treasuryNeed = (wasmBytes) => Math.ceil(((wasmBytes + TREASURY_BYTES.account + TREASURY_BYTES.init_state + TREASURY_BYTES.run_state) / 1e5 + 0.02) * 100) / 100;
/** NEAR plan for this profile (owner-side gas from measured testnet costs, rounded up). */
function plan(wasmBytes) {
  const n = Object.keys(PAYEES).length;
  const items = {
    treasury: FUND.treasury ?? treasuryNeed(wasmBytes),
    agent: FUND.agent,
    signer: FUND.signer,
    payees: +(n * FUND.payee).toFixed(4),
    usdc_storage: +((n + 2) * 0.00125).toFixed(5), // treasury, owner, payees
    outlayer_secret_rows: 0.013, // 2 rows x 0.00646 kept (0.1 attached, rest refunded)
    owner_gas: +((6 + 2 * n) * 0.002 + 0.005).toFixed(4), // creations, storage deposits, secrets, upload (measured 0.0004-0.0016 each)
    owner_own_storage: 0.002,
    owner_reserve: OWNER_RESERVE,
  };
  const owner = Object.values(items).reduce((a, b) => a + b, 0);
  return { profile: PROFILE, items, owner_needs: +owner.toFixed(4), funder_keeps: FUNDER_KEEP, founder_sends_at_least: +(owner + FUNDER_KEEP).toFixed(4) };
}
const yocto = (near) => BigInt(Math.round(near * 1e6)) * 10n ** 18n;
const near = (y) => (Number(BigInt(y) / 10n ** 15n) / 1e9).toFixed(6);
const scrub = (s) => String(s).replace(/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/g, "ed25519:<redacted>").replace(/"private_key"\s*:\s*"[^"]*"/g, '"private_key":"<redacted>"');

mkdirSync(SECRETS, { recursive: true });
mkdirSync(dirname(PROGRESS), { recursive: true });
const ignored = spawnSync("git", ["check-ignore", "-q", join(SECRETS, "keys.json")], { cwd: ROOT }).status === 0;
if (!ignored) throw new Error(".secrets/mainnet is not git-ignored: refusing to write keys");

const P = PREV ?? { network: "mainnet", profile: PROFILE, owner: OWNER, funder: FUNDER, accounts: { ...A }, payees: { ...PAYEES }, asset: USDC, txs: [] };
const save = () => writeFileSync(PROGRESS, JSON.stringify(P, null, 2) + "\n");
const record = (step, tx, extra = {}) => {
  P.txs.push({ at: new Date().toISOString(), step, tx, url: explorer(tx), ...extra });
  save();
  log(step, explorer(tx));
};

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
async function balance(id) {
  try {
    const r = await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
    return { exists: true, amount: BigInt(r.amount), storage: r.storage_usage, code: r.code_hash };
  } catch (e) {
    if (/UNKNOWN_ACCOUNT/.test(e.message)) return { exists: false, amount: 0n, storage: 0, code: null };
    throw e;
  }
}
/** Spendable NEAR of an account: amount minus what its storage locks (1e19 yocto per byte). */
async function free(id) {
  const b = await balance(id);
  return b.amount - BigInt(b.storage) * 10n ** 19n;
}
function txId(out) {
  return out.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/)?.[1] ?? null;
}
function nearCli(argv, step) {
  let out;
  try {
    out = cli(argv);
  } catch (e) {
    throw new Error(scrub(e.message));
  }
  const tx = txId(out);
  if (tx) record(step, tx);
  return out;
}
/** Copy the keychain file(s) for an account into .secrets/mainnet/ (never printed). */
function backupKey(id) {
  const f = join(KEYCHAIN, `${id}.json`);
  if (!existsSync(f)) throw new Error(`no keychain file for ${id}`);
  copyFileSync(f, join(SECRETS, `${id}.json`));
}
async function guardOwner(spendNear, what) {
  const f = await free(OWNER);
  if (f - yocto(spendNear) < yocto(OWNER_RESERVE)) {
    throw new Error(`BUDGET STOP before ${what}: owner has ${near(f)} NEAR free, step needs ${spendNear}, reserve ${OWNER_RESERVE}`);
  }
}
async function createSub(id, amount) {
  if (await accountExists(id)) return log("exists", id);
  await guardOwner(amount + 0.01, `creating ${id}`);
  log("creating", id, "with", amount, "NEAR");
  nearCli(["account", "create-account", "fund-myself", id, `${amount} NEAR`, "autogenerate-new-keypair", "save-to-legacy-keychain", "sign-as", OWNER, "network-config", "mainnet", "sign-with-legacy-keychain", "send"], `create ${id}`);
  backupKey(id);
}
async function registerUsdc(id) {
  const sb = await view(USDC, "storage_balance_of", { account_id: id });
  if (sb) return log("USDC storage already registered", id);
  await guardOwner(0.01, `USDC storage for ${id}`);
  const r = await call(OWNER, USDC, "storage_deposit", { account_id: id, registration_only: true }, { deposit: STORAGE_DEPOSIT, gas: "30.0 Tgas" });
  if (!r.ok) throw new Error(`storage_deposit ${id}: ${r.failure}`);
  record(`USDC storage_deposit ${id}`, r.txHash);
}
function keys() {
  const p = join(SECRETS, "keys.json");
  const k = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  let changed = false;
  for (const name of ["engine_sk", "agent_payout_sk", "smoke_sk"]) if (!k[name]) { k[name] = randomBytes(32).toString("hex"); changed = true; }
  if (changed) writeFileSync(p, JSON.stringify(k, null, 2));
  return k;
}
function outlayer(argv, { secret = false, allowFail = false } = {}) {
  const r = spawnSync("outlayer", argv, { encoding: "utf8", env: { ...process.env, OUTLAYER_NETWORK: "mainnet" }, maxBuffer: 16 * 1024 * 1024 });
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).replace(/\x1b\[[0-9;]*m/g, "");
  if (r.status !== 0 && !allowFail) throw new Error(`outlayer ${secret ? argv[0] + " " + argv[1] : argv.join(" ")} failed:\n${scrub(out).slice(-2000)}`);
  return out;
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ------------------------------------------------------------------------------------ phases
async function status() {
  const ids = [FUNDER, OWNER, ...Object.values(A), ...Object.values(PAYEES)];
  let total = 0n;
  const rows = [];
  for (const id of ids) {
    const b = await balance(id);
    total += b.amount;
    const usdc = b.exists ? await view(USDC, "ft_balance_of", { account_id: id }).catch(() => null) : null;
    rows.push({ account: id.length > 40 ? id.slice(0, 12) + "…" : id, exists: b.exists, near: near(b.amount), storage_bytes: b.storage, usdc: usdc == null ? "-" : (Number(usdc) / 1e6).toString(), code: b.code && b.code !== "11111111111111111111111111111111" ? b.code.slice(0, 10) + "…" : "" });
  }
  console.table(rows);
  console.log(`total NEAR across project accounts: ${near(total)}`);
  return total;
}

async function phaseOwner() {
  if (await accountExists(OWNER)) {
    log("exists", OWNER);
  } else {
    const fb = await balance(FUNDER);
    if (!fb.exists) throw new Error(`funder ${FUNDER} is not funded yet`);
    const max = Number(fb.amount / 10n ** 18n) / 1e6 - FUNDER_KEEP;
    const amount = Math.floor(Math.min(OWNER_FUND_MAX, max) * 1000) / 1000;
    const need = plan(readFileSync(join(ROOT, "dist", "takara_treasury.wasm")).length).owner_needs;
    if (amount < need) throw new Error(`BUDGET STOP: funder holds ${near(fb.amount)} NEAR, owner would get ${amount}, profile ${PROFILE} needs ${need}`);
    log("creating", OWNER, "with", amount, "NEAR from the funder");
    nearCli(["account", "create-account", "fund-myself", OWNER, `${amount} NEAR`, "autogenerate-new-keypair", "save-to-legacy-keychain", "sign-as", FUNDER, "network-config", "mainnet", "sign-with-legacy-keychain", "send"], `create ${OWNER}`);
    P.owner_funded_near = amount;
    save();
  }
  backupKey(OWNER);
  save();
}

async function phaseAccounts() {
  // min profile: the treasury account is created at deploy time, sized from the chosen wasm.
  for (const k of PR.treasuryInAccounts ? ["treasury", "agent", "signer"] : ["agent", "signer"]) await createSub(A[k], FUND[k]);
  for (const id of Object.values(PAYEES)) await createSub(id, FUND.payee);
  for (const id of [...(PR.treasuryInAccounts ? [A.treasury] : []), OWNER, ...Object.values(PAYEES)]) await registerUsdc(id);
}

async function phaseOutlayer() {
  // 1. Same engine build as testnet.
  const wasm = readFileSync(ENGINE_WASM);
  const hash = sha256(wasm);
  const sums = readFileSync(join(ROOT, "dist", "SHA256SUMS"), "utf8");
  if (hash !== PINNED_TESTNET || !sums.includes(`${hash}  takara-engine.wasm`)) throw new Error(`engine hash ${hash} does not match the pinned ${PINNED_TESTNET}`);
  log("engine wasm", hash, "(matches testnet pin and dist/SHA256SUMS)");
  P.engine = { ...(P.engine ?? {}), wasm_hash: hash, build_target: "wasm32-wasip1", bytes: wasm.length };

  // 2. OutLayer mainnet login, non-interactive: the owner's keychain key as near_key credentials.
  const credDir = join(homedir(), ".outlayer", "mainnet");
  const credFile = join(credDir, "credentials.json");
  if (!existsSync(credFile)) {
    const kc = JSON.parse(readFileSync(join(KEYCHAIN, `${OWNER}.json`), "utf8"));
    mkdirSync(credDir, { recursive: true });
    writeFileSync(credFile, JSON.stringify({ account_id: OWNER, public_key: kc.public_key, private_key: kc.private_key, contract_id: OUTLAYER, auth_type: "near_key" }, null, 2));
  }
  const who = outlayer(["whoami"]);
  if (!who.includes(OWNER) || !who.includes("outlayer.near")) throw new Error(`outlayer whoami: ${scrub(who)}`);
  log("outlayer mainnet login ok as", OWNER);

  // 3. Upload to FastFS and verify the served bytes.
  const expectedUrl = `https://main.fastfs.io/${OWNER}/${OUTLAYER}/${hash}.wasm`;
  const served = async (url) => {
    try {
      const r = await fetch(url);
      return r.ok && sha256(Buffer.from(await r.arrayBuffer())) === hash;
    } catch {
      return false;
    }
  };
  if (!(await served(expectedUrl))) {
    if (!P.engine.upload_tx) {
      log("uploading engine to FastFS");
      const out = outlayer(["upload", ENGINE_WASM], { allowFail: true }); // the upload tx fails by design
      const url = out.match(/FastFS URL:\s*(https:\/\/\S+)/)?.[1];
      const tx = txId(out) ?? out.match(/\b([1-9A-HJ-NP-Za-km-z]{43,44})\b/)?.[1];
      if (!url) throw new Error(`upload: no FastFS URL in output:\n${scrub(out).slice(-1500)}`);
      if (url !== expectedUrl) log("note: FastFS URL", url, "differs from expected", expectedUrl);
      if (tx) record("FastFS upload (fails by design: gas 1, the indexer reads the args)", tx);
      P.engine.upload_tx = tx ?? "see outlayer output";
    }
    let ok = false;
    for (let i = 0; i < 18 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      ok = await served(expectedUrl);
    }
    if (!ok) throw new Error(`FastFS does not serve the engine at ${expectedUrl} yet (indexer lag?). Re-run this phase.`);
  }
  P.engine.wasm_url = expectedUrl;
  save();
  log("engine served at", expectedUrl, "sha256 verified");

  // 4. Keys (owner-side) and secret rows bound to this exact wasm hash.
  const k = keys();
  const enginePk = await publicKey(k.engine_sk);
  const smokePk = await publicKey(k.smoke_sk);
  P.engine.public_key = enginePk;
  P.agent_payout_public_key = (await runEngine({ v: 1, op: "pubkey" }, { TAKARA_ENGINE_SK: k.agent_payout_sk })).pk;
  save();
  //  a. smoke row: a throwaway key, readable by the agent directly (proves mainnet binding + decryption).
  if (P.secrets?.smoke !== hash) {
    log("binding smoke secret (throwaway key) to", hash, "for", A.agent);
    outlayer(["secrets", "set", JSON.stringify({ TAKARA_ENGINE_SK: k.smoke_sk }), "--profile", "smoke", "--wasm-hash", hash, "--access", `whitelist:${A.agent}`], { secret: true });
    P.secrets = { ...(P.secrets ?? {}), smoke: hash };
    save();
  }
  //  b. the real row, exactly as testnet: agent signs AND the call comes through the treasury.
  if (P.secrets?.default !== hash) {
    log("binding engine secret to", hash, "whitelist", A.agent, "via", A.treasury);
    outlayer(["secrets", "set", JSON.stringify({ TAKARA_ENGINE_SK: k.engine_sk }), "--wasm-hash", hash, "--access", `whitelist:${A.agent}`, "--via", A.treasury], { secret: true });
    P.secrets = { ...(P.secrets ?? {}), default: hash, rule: "agent-via-treasury" };
    save();
  }
  try {
    P.secrets.list = scrub(outlayer(["secrets", "list"])).split("\n").filter((l) => l.trim()).slice(0, 40);
    save();
  } catch (e) {
    log("secrets list:", e.message.split("\n")[0]);
  }

  // 5. Engine smoke runs on mainnet OutLayer, signed by the agent, straight to outlayer.near.
  const run = async (label, profile, expectPk, shouldMatch) => {
    if (P.smoke?.[label]?.pass) return log("smoke", label, "already passed");
    const input = JSON.stringify({ v: 1, op: "pubkey" });
    const req = {
      source: { WasmUrl: { url: expectedUrl, hash, build_target: "wasm32-wasip1" } },
      resource_limits: { max_instructions: 10_000_000_000, max_memory_mb: 128, max_execution_seconds: 60 },
      input_data: input,
      response_format: "Text",
      payer_account_id: A.agent,
      secrets_ref: { profile, account_id: OWNER },
    };
    await guardOwner(0, "smoke run");
    log("smoke run", label, "(profile", profile + ")");
    const r = await call(A.agent, OUTLAYER, "request_execution", req, { deposit: ENGINE_DEPOSIT, gas: "200.0 Tgas" });
    const blob = JSON.stringify({ value: r.value, logs: r.logs });
    const matched = blob.includes(expectPk);
    const requestId = r.logs.join(" ").match(/request_id\\?"?\s*:\s*(\d+)/)?.[1] ?? null;
    const pass = shouldMatch ? matched : !matched;
    P.smoke = { ...(P.smoke ?? {}), [label]: { tx: r.txHash, url: explorer(r.txHash), request_id: requestId, pass, expected: shouldMatch ? "engine reads the secret" : "secret withheld (no treasury in the call path)", value: typeof r.value === "string" ? r.value.slice(0, 600) : r.value, failure: r.failure, logs: r.logs.map((l) => l.slice(0, 300)).slice(0, 10), input } };
    record(`smoke ${label}`, r.txHash, { pass });
    console.log(`   ${pass ? "PASS" : "FAIL"}  ${label}`);
  };
  await run("secret-read-direct", "smoke", smokePk, true);
  await run("via-treasury-enforced", "default", enginePk, false);
}

async function phaseTreasury() {
  const wasmPath = resolve(opt("--wasm") ?? join(ROOT, "dist", "takara_treasury.wasm"));
  const wasm = readFileSync(wasmPath);
  const wasmSha = sha256(wasm);
  // --expect-sha <prefix>..<suffix> (or the full hash): refuse anything but the audited build.
  const expect = opt("--expect-sha");
  if (expect) {
    const [pre, suf = ""] = expect.split("..");
    if (!wasmSha.startsWith(pre) || !wasmSha.endsWith(suf)) throw new Error(`wasm sha256 ${wasmSha} does not match --expect-sha ${expect}`);
  }
  const sums = readFileSync(join(ROOT, "dist", "SHA256SUMS"), "utf8");
  if (wasmPath === join(ROOT, "dist", "takara_treasury.wasm") && !sums.includes(`${wasmSha}  takara_treasury.wasm`)) throw new Error(`dist/takara_treasury.wasm ${wasmSha} is not the hash in dist/SHA256SUMS`);
  // Hard per-payment ceiling in base units (token-moving contract only).
  const maxPayout = opt("--max-payout");
  if (maxPayout != null && !/^[1-9]\d*$/.test(maxPayout)) throw new Error(`--max-payout must be a positive integer of base units, got ${maxPayout}`);
  const need = treasuryNeed(wasm.length);
  log("treasury wasm", wasmPath, wasmSha, `${wasm.length} bytes; the treasury account needs ${need} NEAR`);
  if (!flag("--yes-deploy")) {
    log("dry run: pass --yes-deploy to deploy this wasm to", A.treasury);
    return;
  }
  if (!P.engine?.wasm_url || !P.secrets?.default) throw new Error("run the outlayer phase first");
  const k = keys();
  // The treasury account must hold what code + state need: create it with that, or top it up.
  const deployed = await view(A.treasury, "get_config").then(() => true).catch(() => false);
  if (!(await accountExists(A.treasury))) {
    await createSub(A.treasury, need);
  } else if (!deployed) {
    const have = Number(near((await balance(A.treasury)).amount));
    if (have < need) {
      const top = Math.ceil((need - have) * 1000) / 1000;
      await guardOwner(top + 0.01, "treasury top-up");
      log("topping up", A.treasury, "by", top, "NEAR");
      nearCli(["tokens", OWNER, "send-near", A.treasury, `${top} NEAR`, "network-config", "mainnet", "sign-with-legacy-keychain", "send"], `top up ${A.treasury}`);
    }
  }
  await registerUsdc(A.treasury);

  // Policy: the mainnet copy (amounts / 100, founder-owned payees), sealed to this engine key.
  const template = readFileSync(join(ROOT, PR.fixtures, "policy.template.json"), "utf8");
  const policyPt = JSON.stringify(JSON.parse(template.replaceAll("${ASSET}", USDC).replaceAll("${AGENT_PAYOUT_PK}", P.agent_payout_public_key).replaceAll("${SIGNER}", A.signer)));
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: policyPt, eph: randomBytes(32).toString("hex") }, { TAKARA_ENGINE_SK: k.engine_sk });
  writeFileSync(join(SECRETS, "policy.plain.json"), policyPt);
  log("policy hash", sealed.hash);

  const ready = await view(A.treasury, "get_config").then(() => true).catch(() => false);
  if (!ready) {
    const init = {
      owners: [OWNER],
      agent: A.agent,
      outlayer: OUTLAYER,
      engine: { wasm_url: P.engine.wasm_url, wasm_hash: P.engine.wasm_hash, build_target: "wasm32-wasip1" },
      secrets: { profile: "default", account_id: OWNER },
      asset: USDC,
      policy: { version: 1, hash: sealed.hash, signers: [A.signer], threshold: 1, expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n), sealed: sealed.sealed },
    };
    if (maxPayout != null) init.max_payout = maxPayout;
    log("deploying treasury to", A.treasury, maxPayout != null ? `(max_payout ${maxPayout})` : "");
    nearCli(["contract", "deploy", A.treasury, "use-file", wasmPath, "with-init-call", "new", "json-args", JSON.stringify(init), "prepaid-gas", "100.0 Tgas", "attached-deposit", "0 NEAR", "network-config", "mainnet", "sign-with-legacy-keychain", "send"], "deploy + init treasury");
  } else {
    log("treasury already initialised; not redeploying");
  }
  const cfg = await view(A.treasury, "get_config");
  if (cfg.engine.wasm_hash !== P.engine.wasm_hash) throw new Error(`treasury pins ${cfg.engine.wasm_hash}, expected ${P.engine.wasm_hash}`);
  const problems = [];
  if (cfg.agent !== A.agent) problems.push(`agent ${cfg.agent}`);
  if (JSON.stringify(cfg.owners) !== JSON.stringify([OWNER])) problems.push(`owners ${JSON.stringify(cfg.owners)}`);
  if (JSON.stringify(cfg.signers) !== JSON.stringify([A.signer])) problems.push(`signers ${JSON.stringify(cfg.signers)}`);
  if (cfg.policy_hash !== sealed.hash && !ready) problems.push(`policy_hash ${cfg.policy_hash}`);
  if (cfg.engine.wasm_url !== P.engine.wasm_url) problems.push(`engine url ${cfg.engine.wasm_url}`);
  if (maxPayout != null && cfg.max_payout !== maxPayout) problems.push(`max_payout ${cfg.max_payout}`);
  if (cfg.paused) problems.push("paused");
  if (problems.length) throw new Error(`get_config mismatch: ${problems.join(", ")}`);
  log("get_config verified: owners, agent, signers, engine, policy hash", maxPayout != null ? `, max_payout ${cfg.max_payout}` : "");

  P.contract = { wasm: wasmPath.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, ""), wasm_sha256: wasmSha, settle_moves_tokens: flag("--settle-moves-tokens") };
  save();
  const deployment = {
    network: "mainnet",
    owner: OWNER,
    accounts: A,
    payees: PAYEES,
    asset: USDC,
    asset_symbol: "USDC",
    asset_decimals: 6,
    outlayer: OUTLAYER,
    engine: { wasm_url: P.engine.wasm_url, wasm_hash: P.engine.wasm_hash, build_target: "wasm32-wasip1", public_key: P.engine.public_key },
    agent_payout_public_key: P.agent_payout_public_key,
    policy_hash: cfg.policy_hash,
    secret_for_hash: P.engine.wasm_hash,
    secret_rule: "agent-via-treasury",
    contract: P.contract,
    settle_moves_tokens: P.contract.settle_moves_tokens,
    max_payout: cfg.max_payout ?? null,
    profile: PROFILE,
    fixtures_dir: PR.fixtures,
    amount_scale_divisor: PF.amount_scale_divisor,
    payee_map: PF.payee_map,
  };
  writeFileSync(DEPLOY, JSON.stringify(deployment, null, 2) + "\n");
  log("wrote", DEPLOY);
  console.log(JSON.stringify({ treasury: A.treasury, balance: cfg.balance, policy_version: cfg.policy_version, engine: cfg.engine.wasm_hash, agent: cfg.agent, signers: cfg.signers, owners: cfg.owners }, null, 2));
}

async function phasePlan() {
  const wasm = readFileSync(resolve(opt("--wasm") ?? join(ROOT, "dist", "takara_treasury.wasm")));
  console.log(JSON.stringify({ treasury_wasm_bytes: wasm.length, ...plan(wasm.length) }, null, 2));
}

const phases = { plan: phasePlan, status, owner: phaseOwner, accounts: phaseAccounts, outlayer: phaseOutlayer, treasury: phaseTreasury };
if (!phases[phase]) throw new Error(`unknown phase ${phase}: ${Object.keys(phases).join(", ")}`);
try {
  await phases[phase]();
  if (phase !== "status" && phase !== "plan") await status();
} catch (e) {
  console.error("STOPPED:", scrub(e.message));
  process.exit(1);
}
