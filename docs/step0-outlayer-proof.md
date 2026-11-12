# Step 0: OutLayer execution with a verified attestation

Date: 2026-11-12. Network: NEAR testnet. This step proves the one dependency everything else rests on.

## What was proven

A NEAR contract, not an off-chain party, asked OutLayer to run one exact WASM build (pinned by sha256),
and the result came back only through that contract's own private callback. The execution's Intel TDX
attestation was then verified independently.

| Item | Value |
|---|---|
| Engine source | `engine/src/main.rs` (no dependencies) |
| Engine wasm sha256 (pinned) | `dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019` |
| Engine hosted at | `https://test.fastfs.io/takara-ai-hq.testnet/outlayer.testnet/dc3e7c5c….wasm` |
| Probe contract | `takara-ai-hq.testnet` (`probe/src/lib.rs`) |
| OutLayer contract | `outlayer.testnet`, method `request_execution` |
| Request id | 30883 |
| Request tx | `9WXFnzhUPvsmRoxkcBZMw6sKoZBcWy6zXi2uHAQv3Y8N` |
| Cost | 0.0010806 NEAR charged, 0.0489194 NEAR refunded; 11,533 instructions, 148 ms |
| Callback output | `{"ok":true,"engine":"takara-ai-engine","step":0,"input_len":61,"echo":"request:step0-onchaintreasury:takara-ai-hq.testnet"}` |

## Independent verification

```
node scripts/verify-attestation.mjs 30883 dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019 \
  '{"request":"step0-onchain","treasury":"takara-ai-hq.testnet"}' \
  '{"ok":true,"engine":"takara-ai-engine","step":0,"input_len":61,"echo":"request:step0-onchaintreasury:takara-ai-hq.testnet"}'

PASS  1 executed wasm == pinned hash
PASS  2 sha256(input) == input_hash
PASS  3 sha256(callback bytes) == output_hash
PASS  4 TDX quote REPORTDATA == recomputed task hash  format V1
PASS  5 worker measurement approved on-chain  worker.outlayer.testnet -> true
PASS  6 Intel DCAP signature chain verified  TCB status UpToDate
```

Check 4 means the Intel-signed hardware quote commits to exactly this code, this input and this
output. Check 6 verifies the quote's signature chain against Intel's root CA using collateral fetched
directly from Intel PCS (`@phala/dcap-qvl` 0.7.0). Check 5 reads the measurements from the quote
itself and asks the chain whether that worker build is approved.

## Negative tests

| Test | Result |
|---|---|
| Verifier given output altered by one character | check 3 FAIL, exit 1 |
| Contract pins a wrong hash for the same file | OutLayer refused: `"wasm_url content does not match its hash"`, 0 instructions, full refund |

## Findings that shape the treasury contract

1. **A refused or failed execution reaches the callback as a successful promise with value `null`,
   not as `PromiseResult::Failed`.** The treasury must treat `null` or unparseable output as
   `engine_error` and never as approval.
2. **`output_hash` = sha256 of the exact bytes the callback receives** (with `response_format: "Text"`
   the stdout arrives JSON-string-encoded). The contract can hash its own callback bytes and store
   that, which ties every on-chain decision to a specific attestation record.
3. **The attestation task hash uses the V1 layout** from `out-layer/outlayer-verify`
   (`crates/verify-core/src/preimage.rs`), which appends caller, project, secrets ref, timestamp and
   attached USD to the layout the docs describe.
4. The contract cannot verify a TDX quote itself (OutLayer avoids per-call on-chain verification).
   The on-chain guarantee is: OutLayer's registered worker resolved a request this contract made for
   the hash it pinned. The hardware proof is checkable off-chain by anyone with the script above.

## Environment notes (Windows)

Rust uses the GNU host toolchain; `outlayer` CLI 0.2.3 and `cargo-near` 0.23.0 are the official
prebuilt Windows binaries (compiling them needs MSVC `dlltool`). Contracts build with
`cargo near build non-reproducible-wasm --no-abi` (ABI generation links natively and fails on Windows).
