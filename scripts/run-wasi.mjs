// Run an OutLayer-style WASI (wasip1) job locally: JSON on stdin, JSON on stdout.
// Usage: node scripts/run-wasi.mjs <file.wasm> '<input json>'
import { readFileSync, writeFileSync, mkdtempSync, openSync, closeSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WASI } from "node:wasi";

const [wasmPath, input = ""] = process.argv.slice(2);
if (!wasmPath) {
  console.error("usage: node scripts/run-wasi.mjs <file.wasm> '<input>'");
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), "takara-wasi-"));
const inPath = join(dir, "stdin");
const outPath = join(dir, "stdout");
writeFileSync(inPath, input);
writeFileSync(outPath, "");
const stdin = openSync(inPath, "r");
const stdout = openSync(outPath, "w");

const wasi = new WASI({ version: "preview1", args: [], env: {}, stdin, stdout, stderr: 2, returnOnExit: true });
const module = await WebAssembly.compile(readFileSync(wasmPath));
const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
const code = wasi.start(instance);
closeSync(stdin);
closeSync(stdout);

const out = readFileSync(outPath, "utf8");
rmSync(dir, { recursive: true, force: true });
process.stdout.write(out + "\n");
if (Buffer.byteLength(out) > 900) console.error(`WARNING: stdout is ${Buffer.byteLength(out)} bytes, OutLayer limit is 900`);
process.exit(code);
