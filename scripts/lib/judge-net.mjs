// Network parameters for scripts/judge.mjs. Testnet values are the original ones. Mainnet scales
// every amount by the deployed profile's divisor (deployment record "amount_scale_divisor": 100 for
// the default profile, 1000 for --profile min) and uses its founder-owned payees ("payee_map").
// Kept out of judge.mjs so the judge's own edits stay small and merge-friendly.
import { NETWORK, OUTLAYER } from "./near.mjs";
import { D } from "./takara.mjs";

export const MAINNET = NETWORK === "mainnet";
export { NETWORK, OUTLAYER };
const SCALE = MAINNET ? BigInt(D.amount_scale_divisor ?? 100) : 1n;
const DECIMALS = 6;

/** The treasury asset: native USDC on mainnet, the test token on testnet. */
export const ASSET = D.asset ?? D.accounts.tusdc;

/** Base units for a testnet-scale amount in whole tokens (1000 -> "1000000000" testnet, "10000000" mainnet). */
export const units = (whole) => {
  const base = BigInt(Math.round(whole * 1e6)) * 10n ** BigInt(DECIMALS - 6);
  if (base % SCALE !== 0n) throw new Error(`amount ${whole} is not exact at 1/${SCALE}`);
  return (base / SCALE).toString();
};

/** Display form the engine report uses for that amount (trailing zeros trimmed): 280 -> "280" / "2.8". */
export const show = (whole) => fmt(BigInt(units(whole)));

/** a - b on engine display strings, exact (no floating point). */
export const minus = (a, b) => fmt(parse(a) - parse(b));

/** Testnet payee name -> this network's payee (mainnet: founder-owned sub-accounts). */
export const payee = (testnetName) => (MAINNET ? D.payee_map?.[testnetName] ?? testnetName : testnetName);

/** Where the run record is written (docs/runs/<prefix>-<date>-<run>.json). */
export const RUN_PREFIX = MAINNET ? "judge-mainnet" : "judge";
export const UNIT = MAINNET ? "USDC" : "tUSDC";

function fmt(v) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const base = 10n ** BigInt(DECIMALS);
  const frac = (a % base).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${a / base}${frac ? `.${frac}` : ""}`;
}
function parse(s) {
  const neg = String(s).startsWith("-");
  const [i, f = ""] = String(s).replace("-", "").split(".");
  const v = BigInt(i || "0") * 10n ** BigInt(DECIMALS) + BigInt((f + "0".repeat(DECIMALS)).slice(0, DECIMALS) || "0");
  return neg ? -v : v;
}
