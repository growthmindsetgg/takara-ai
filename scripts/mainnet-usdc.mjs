// The founder's steps on mainnet that move real USDC or NEAR. Run them yourself.
//   node scripts/mainnet-usdc.mjs balances          read-only
//   node scripts/mainnet-usdc.mjs fund [usdc]       owner -> treasury via ft_transfer_call (default: the profile's
//                                                   opening balance, 1 USDC on min, 10 on default)
//   node scripts/mainnet-usdc.mjs recover           treasury -> owner, the whole treasury ledger balance
//   node scripts/mainnet-usdc.mjs sweep --to <wallet> [--delete-accounts] [--owner-keep <near>] [--execute]
//       Return every leftover to <wallet>: treasury USDC comes back to the owner (contract `recover`), then
//       USDC from the payees and the owner, then spare NEAR from the agent, signer, payees, funder and
//       owner (each keeps its storage minimum). --delete-accounts deletes the payee, agent, signer and
//       funder accounts instead, with <wallet> as beneficiary (all their NEAR). The treasury is never
//       deleted or drained: its contract state locks ~3.8 NEAR as storage. Without --execute it only
//       prints the table; with --execute it asks you to type YES.
process.env.NEAR_NETWORK = "mainnet";
const { call, view, cli, explorer, RPC } = await import("./lib/near.mjs");
const { readFileSync, existsSync } = await import("node:fs");
const { createInterface } = await import("node:readline/promises");
const D = JSON.parse(readFileSync(new URL("../fixtures/deployment.mainnet.json", import.meta.url), "utf8"));
const progressUrl = new URL("../fixtures/mainnet/setup-progress.json", import.meta.url);
const FUNDER = existsSync(progressUrl) ? JSON.parse(readFileSync(progressUrl, "utf8")).funder : null;
const args = process.argv.slice(2);
const cmd = args[0] ?? "balances";
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const flag = (n) => args.includes(n);
const T = D.accounts.treasury;
const usdc = (u) => (Number(u) / 1e6).toString();
const nearStr = (y) => (Number(BigInt(y) / 10n ** 15n) / 1e9).toFixed(6);
const yocto = (n) => BigInt(Math.round(Number(n) * 1e6)) * 10n ** 18n;
const short = (id) => (id.length > 40 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id);

async function rpc(method, params) {
  const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result;
}
async function account(id) {
  try {
    const r = await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
    return { exists: true, amount: BigInt(r.amount), storage: BigInt(r.storage_usage) * 10n ** 19n };
  } catch (e) {
    if (/UNKNOWN_ACCOUNT/.test(e.message)) return { exists: false, amount: 0n, storage: 0n };
    throw e;
  }
}
const ftBalance = async (id) => BigInt((await view(D.asset, "ft_balance_of", { account_id: id }).catch(() => "0")) ?? "0");
const registered = async (id) => !!(await view(D.asset, "storage_balance_of", { account_id: id }));

async function balances() {
  const cfg = await view(T, "get_config");
  console.log(`owner ${D.owner}: ${usdc(await ftBalance(D.owner))} USDC`);
  console.log(`treasury ${T}: ${usdc(await ftBalance(T))} USDC on the token, ${usdc(cfg.balance)} USDC in the treasury ledger`);
  for (const [k, id] of Object.entries(D.payees ?? {})) console.log(`payee ${k} ${id}: ${usdc(await ftBalance(id))} USDC`);
}

async function sweep() {
  const to = opt("--to");
  if (!to) throw new Error("usage: sweep --to <your-wallet> [--delete-accounts] [--owner-keep 0.01] [--execute]");
  const del = flag("--delete-accounts");
  const ownerKeep = yocto(opt("--owner-keep") ?? "0.01"); // owner keeps this beyond its storage, for later owner txs
  const KEEP = yocto("0.001"); // per-account buffer for the transfer's own gas
  const payees = [...new Set(Object.values(D.payees ?? {}))];
  const project = [D.owner, T, D.accounts.agent, D.accounts.signer, ...payees, FUNDER].filter(Boolean);
  if (project.includes(to)) throw new Error(`--to ${to} is one of the project's own accounts`);
  if (!(await account(to)).exists) throw new Error(`--to ${to} does not exist on NEAR mainnet`);

  // ---- plan (exact amounts as of now)
  const rows = [];
  const steps = [];
  const toRegistered = await registered(to);
  if (!toRegistered) {
    rows.push({ step: "USDC storage for --to", from: D.owner, to, asset: "NEAR", amount: "0.00125" });
    steps.push(() => call(D.owner, D.asset, "storage_deposit", { account_id: to, registration_only: true }, { deposit: "0.00125 NEAR", gas: "30.0 Tgas" }));
  }
  const ledger = BigInt((await view(T, "get_config")).balance);
  const tokenAtTreasury = await ftBalance(T);
  if (ledger > 0n) {
    rows.push({ step: "recover (contract)", from: T, to: D.owner, asset: "USDC", amount: usdc(ledger) });
    steps.push(() => call(D.owner, T, "recover", { amount: ledger.toString(), to: D.owner }, { deposit: "1 yoctoNEAR", gas: "60.0 Tgas" }));
  }
  for (const id of payees) {
    const b = await ftBalance(id);
    if (b > 0n) {
      rows.push({ step: "USDC", from: id, to, asset: "USDC", amount: usdc(b) });
      steps.push(() => call(id, D.asset, "ft_transfer", { receiver_id: to, amount: b.toString(), memo: "takara-ai sweep" }, { deposit: "1 yoctoNEAR", gas: "30.0 Tgas" }));
    }
  }
  const ownerUsdc = (await ftBalance(D.owner)) + ledger;
  if (ownerUsdc > 0n) {
    rows.push({ step: "USDC", from: D.owner, to, asset: "USDC", amount: usdc(ownerUsdc) });
    // Read again at run time: the recover above lands first.
    steps.push(async () => {
      const b = await ftBalance(D.owner);
      return b > 0n ? call(D.owner, D.asset, "ft_transfer", { receiver_id: to, amount: b.toString(), memo: "takara-ai sweep" }, { deposit: "1 yoctoNEAR", gas: "30.0 Tgas" }) : null;
    });
  }
  const nearSources = [D.accounts.agent, D.accounts.signer, ...payees, FUNDER].filter(Boolean);
  for (const id of nearSources) {
    const a = await account(id);
    if (!a.exists) continue;
    if (del) {
      if (payees.includes(id) && (await registered(id))) {
        // Take the USDC storage deposit back before deleting (only possible at zero balance).
        rows.push({ step: "USDC storage refund", from: D.asset.slice(0, 10) + "…", to: id, asset: "NEAR", amount: "0.00125" });
        steps.push(async () => {
          const r = await call(id, D.asset, "storage_unregister", { force: false }, { deposit: "1 yoctoNEAR", gas: "30.0 Tgas" });
          if (!r.ok) console.log(`  (storage refund for ${id} refused: ${r.failure}; deleting anyway, 0.00125 NEAR stays with USDC)`);
          return r.ok ? r : null;
        });
      }
      rows.push({ step: "delete account", from: id, to, asset: "NEAR", amount: `all, ~${nearStr(a.amount)}` });
      steps.push(() => cli(["account", "delete-account", id, "beneficiary", to, "network-config", "mainnet", "sign-with-legacy-keychain", "send"]));
    } else {
      const spare = a.amount - a.storage - KEEP;
      if (spare <= 0n) continue;
      rows.push({ step: "NEAR", from: id, to, asset: "NEAR", amount: nearStr(spare) });
      steps.push(async () => {
        const n = await account(id);
        const s = n.amount - n.storage - KEEP;
        return s > 0n ? cli(["tokens", id, "send-near", to, `${s} yoctonear`, "network-config", "mainnet", "sign-with-legacy-keychain", "send"]) : null;
      });
    }
  }
  const o = await account(D.owner);
  const ownerSpare = o.amount - o.storage - ownerKeep - yocto("0.005"); // minus the gas of the owner's own steps above
  if (ownerSpare > 0n) {
    rows.push({ step: "NEAR (last)", from: D.owner, to, asset: "NEAR", amount: `~${nearStr(ownerSpare)}` });
    steps.push(async () => {
      const n = await account(D.owner);
      const s = n.amount - n.storage - ownerKeep;
      return s > 0n ? cli(["tokens", D.owner, "send-near", to, `${s} yoctonear`, "network-config", "mainnet", "sign-with-legacy-keychain", "send"]) : null;
    });
  }

  console.log(`\nSweep to ${to} (exists on mainnet${toRegistered ? ", USDC-registered" : ""})${del ? ", deleting agent / signer / payee / funder accounts" : ""}`);
  console.table(rows.map((r) => ({ ...r, from: short(r.from), to: short(r.to) })));
  const tb = await account(T);
  console.log(`Not moved: treasury ${T} keeps ${nearStr(tb.amount)} NEAR (contract storage ${nearStr(tb.storage)}); owner keeps its storage + ${nearStr(ownerKeep)} NEAR.`);
  if (tokenAtTreasury > ledger) console.log(`Note: ${usdc(tokenAtTreasury - ledger)} USDC sits at the treasury outside its ledger (a plain transfer); recover cannot move it.`);
  if (!flag("--execute")) return console.log("\nDry run. Add --execute to do this.");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\nType YES to move the above to ${to}: `)).trim();
  rl.close();
  if (answer !== "YES") return console.log("Not confirmed; nothing sent.");
  for (const [i, step] of steps.entries()) {
    const r = await step();
    if (r == null) continue;
    if (typeof r === "string") {
      const tx = r.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/)?.[1];
      console.log(`  ${rows[i].step} ${short(rows[i].from)}: ${tx ? explorer(tx) : "done"}`);
    } else {
      console.log(`  ${rows[i].step} ${short(rows[i].from)}: ${r.ok ? "ok" : `FAILED ${r.failure}`} ${explorer(r.txHash)}`);
      if (!r.ok) throw new Error("stopped at the first failure; re-run the dry run to see what is left");
    }
  }
  console.log("\nDone.");
  await balances();
}

if (cmd === "balances") await balances();
else if (cmd === "fund") {
  const dflt = 1000 / Number(D.amount_scale_divisor ?? 100);
  const amount = String(Math.round(Number(args[1] ?? dflt) * 1e6));
  const r = await call(D.owner, D.asset, "ft_transfer_call", { receiver_id: T, amount, msg: "" }, { deposit: "1 yoctoNEAR", gas: "100.0 Tgas" });
  console.log(r.ok ? `funded ${usdc(amount)} USDC` : `FAILED ${r.failure}`, explorer(r.txHash));
  await balances();
} else if (cmd === "recover") {
  const bal = (await view(T, "get_config")).balance;
  if (BigInt(bal) === 0n) console.log("treasury balance is 0, nothing to recover");
  else {
    const r = await call(D.owner, T, "recover", { amount: bal, to: D.owner }, { deposit: "1 yoctoNEAR", gas: "60.0 Tgas" });
    console.log(r.ok ? `recovered ${usdc(bal)} USDC` : `FAILED ${r.failure}`, explorer(r.txHash));
  }
  await balances();
} else if (cmd === "sweep") await sweep();
else throw new Error(`unknown command ${cmd}`);
