// Run the Takara AI engine WASM locally (same binary OutLayer runs). Used by owner tools
// (sealing the policy, reports), the backend (sealing claims) and the judge script.
import { existsSync, readFileSync, writeFileSync, mkdtempSync, openSync, closeSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WASI } from "node:wasi";
import { randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUILT = join(ROOT, "engine", "target", "wasm32-wasip1", "release", "takara-engine.wasm");
export const ENGINE_WASM = process.env.TAKARA_ENGINE_WASM ?? (existsSync(BUILT) ? BUILT : join(ROOT, "dist", "takara-engine.wasm"));

let compiled;
async function module() {
  compiled ??= await WebAssembly.compile(readFileSync(ENGINE_WASM));
  return compiled;
}

/** Run one engine request. `env` may carry TAKARA_ENGINE_SK for owner-side ops. */
export async function runEngine(input, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "takara-engine-"));
  const inPath = join(dir, "in");
  const outPath = join(dir, "out");
  writeFileSync(inPath, typeof input === "string" ? input : JSON.stringify(input));
  writeFileSync(outPath, "");
  // The input may carry the owner's key (local owner ops): the temp folder is removed whatever
  // happens.
  try {
    const stdin = openSync(inPath, "r");
    const stdout = openSync(outPath, "w");
    try {
      const wasi = new WASI({ version: "preview1", args: [], env, stdin, stdout, stderr: 2, returnOnExit: true });
      const instance = await WebAssembly.instantiate(await module(), wasi.getImportObject());
      wasi.start(instance);
    } finally {
      closeSync(stdin);
      closeSync(stdout);
    }
    return JSON.parse(readFileSync(outPath, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** ECIES-seal plaintext to a public key (no engine key needed). */
export async function sealTo(pkHex, plaintext) {
  const r = await runEngine({ v: 1, op: "seal_to", to: pkHex, eph: randomBytes(32).toString("hex"), pt: plaintext });
  if (!r.ok) throw new Error(`seal_to failed: ${r.reason}`);
  return r.sealed;
}

export async function publicKey(skHex) {
  const r = await runEngine({ v: 1, op: "pubkey" }, { TAKARA_ENGINE_SK: skHex });
  if (!r.ok) throw new Error(`pubkey failed: ${r.reason}`);
  return r.pk;
}

export async function openOpening(agentSkHex, sealed) {
  return runEngine({ v: 1, op: "open_opening", sk: agentSkHex, sealed });
}
