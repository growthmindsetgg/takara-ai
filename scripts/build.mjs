// Build all wasm artifacts and copy them to dist/ with their sha256 (dist/ is committed so a
// judge can deploy without Rust).
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd) => execSync(cmd, { cwd: join(ROOT, cwd), stdio: "inherit" });
run("cargo near build non-reproducible-wasm --no-abi", "contract");
run("cargo near build non-reproducible-wasm --no-abi", "mock-ft");
run("cargo build --target wasm32-wasip1 --release", "engine");
mkdirSync(join(ROOT, "dist"), { recursive: true });
const files = {
  "takara_treasury.wasm": "contract/target/near/takara_treasury.wasm",
  "takara_mock_ft.wasm": "mock-ft/target/near/takara_mock_ft.wasm",
  "takara-engine.wasm": "engine/target/wasm32-wasip1/release/takara-engine.wasm",
};
const sums = [];
for (const [name, src] of Object.entries(files)) {
  copyFileSync(join(ROOT, src), join(ROOT, "dist", name));
  sums.push(`${createHash("sha256").update(readFileSync(join(ROOT, "dist", name))).digest("hex")}  ${name}`);
}
writeFileSync(join(ROOT, "dist", "SHA256SUMS"), sums.join("\n") + "\n");
console.log(sums.join("\n"));
