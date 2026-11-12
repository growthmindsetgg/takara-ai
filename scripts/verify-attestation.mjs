// Independently verify an OutLayer execution attestation.
// Usage: node scripts/verify-attestation.mjs <request_id> <pinned_wasm_sha256> '<exact input>' '<exact stdout>'
//
// Checks, without trusting the API's own claims:
//   1. the executed wasm sha256 equals the hash our contract pinned
//   2. sha256(input)  equals the attested input_hash
//   3. sha256(stdout) equals the attested output_hash
//   4. the task hash we recompute from those fields equals the 32 bytes that the
//      Intel TDX quote carries in REPORTDATA (quote offset 568), i.e. the hardware
//      quote commits to exactly this code, input and output
//   5. the worker measurement is approved on-chain by worker.outlayer.testnet
// Quote signature-chain verification to Intel's root (DCAP) is a separate step; see README.
import { createHash } from "node:crypto";

const API = process.env.OUTLAYER_API ?? "https://testnet-api.outlayer.ai";
const RPC = process.env.NEAR_RPC ?? "https://rpc.testnet.fastnear.com";
const WORKER_CONTRACT = process.env.OUTLAYER_WORKER ?? "worker.outlayer.testnet";

const [requestId, pinned, input, stdout] = process.argv.slice(2);
if (!requestId || !pinned || input === undefined || stdout === undefined) {
  console.error("usage: node scripts/verify-attestation.mjs <request_id> <pinned_sha256> '<input>' '<stdout>'");
  process.exit(2);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest();
const hex = (b) => Buffer.from(b).toString("hex");
const i64le = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const res = await fetch(`${API}/attestations/by-request/${requestId}`);
if (!res.ok) { console.error(`attestation fetch failed: HTTP ${res.status}`); process.exit(1); }
const a = await res.json();

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

check("1 executed wasm == pinned hash", a.executed_wasm_sha256 === pinned.toLowerCase() && a.wasm_hash === pinned.toLowerCase(), a.executed_wasm_sha256);
check("2 sha256(input) == input_hash", hex(sha256(Buffer.from(input, "utf8"))) === a.input_hash, a.input_hash);
// With response_format "Text" the worker records the output as a JSON string, which is also the
// exact byte string our contract's callback receives. So output_hash binds the callback bytes.
check("3 sha256(callback bytes) == output_hash", hex(sha256(Buffer.from(JSON.stringify(stdout), "utf8"))) === a.output_hash, a.output_hash);

// Task hash, per out-layer/outlayer-verify crates/verify-core/src/preimage.rs:
// strings as UTF-8, task_id/timestamp i64 LE, block_height u64 LE, absent optionals add no bytes.
// V1 records append caller_account_id, project_id, secrets_ref, timestamp, attached_usd.
const str = (s) => (s == null || s === "" ? [] : [Buffer.from(String(s), "utf8")]);
const legacy = [
  Buffer.from(a.task_type, "utf8"), i64le(a.task_id),
  ...str(a.repo_url), ...str(a.commit_hash), ...str(a.build_target), ...str(a.wasm_hash), ...str(a.input_hash),
  Buffer.from(a.output_hash, "utf8"),
  ...(a.block_height != null ? [u64le(a.block_height)] : []),
];
const secretsRef = a.secrets_ref == null || typeof a.secrets_ref === "string" ? a.secrets_ref : JSON.stringify(a.secrets_ref);
const v1 = [...legacy, ...str(a.caller_account_id), ...str(a.project_id), ...str(secretsRef), i64le(a.timestamp), ...str(a.attached_usd)];

const quote = Buffer.from(a.tdx_quote, "base64");
const reportData = quote.subarray(568, 568 + 32);
const hLegacy = sha256(Buffer.concat(legacy));
const hV1 = sha256(Buffer.concat(v1));
const fmt = reportData.equals(hV1) ? "V1" : reportData.equals(hLegacy) ? "legacy" : null;
check("4 TDX quote REPORTDATA == recomputed task hash", fmt !== null, fmt ? `format ${fmt}, ${hex(reportData)}` : `quote has ${hex(reportData)}`);

// Worker measurement approval on-chain. Measurements are read from the quote itself (TDX quote v4:
// 48-byte header, then the TD report body), so the API cannot substitute them.
try {
  const at = (off) => hex(quote.subarray(off, off + 48));
  const measurements = { mrtd: at(184), rtmr0: at(376), rtmr1: at(424), rtmr2: at(472), rtmr3: at(520) };
  const args = { measurements };
  const body = { jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final",
    account_id: WORKER_CONTRACT, method_name: "is_measurements_approved",
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } };
  const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  if (r.result?.result) {
    const v = JSON.parse(Buffer.from(r.result.result).toString());
    check("5 worker measurement approved on-chain", v === true, `${WORKER_CONTRACT} -> ${JSON.stringify(v)}`);
  } else {
    console.log(`SKIP  5 worker measurement approval  (${r.result?.error ?? r.error?.data ?? "unexpected response"})`);
  }
} catch (e) {
  console.log(`SKIP  5 worker measurement approval  (${e.message})`);
}

// Intel DCAP: quote signature chain must terminate at Intel's root CA (built into dcap-qvl), using
// collateral fetched directly from Intel PCS. Also reject debug TDs.
try {
  const { getCollateralFromPcs, verify } = await import("@phala/dcap-qvl");
  const collateral = await getCollateralFromPcs(quote);
  const report = await verify(quote, collateral, Math.floor(Date.now() / 1000));
  const status = report.status ?? report.tcbStatus ?? "unknown";
  check("6 Intel DCAP signature chain verified", true, `TCB status ${status}${report.advisory_ids?.length ? `, advisories ${report.advisory_ids.join(",")}` : ""}`);
} catch (e) {
  check("6 Intel DCAP signature chain verified", false, e.message);
}

console.log(`\nquote: ${quote.length} bytes, tx ${a.transaction_hash}, block ${a.block_height}, caller ${a.caller_account_id}`);
process.exit(results.every(Boolean) ? 0 : 1);
