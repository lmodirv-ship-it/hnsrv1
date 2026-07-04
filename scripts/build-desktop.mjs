#!/usr/bin/env node
// Build & smoke-test the Electron desktop package, then zip it.
// Runs preflight first; runs Electron headless to verify it boots; zips only on success.
import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("build.config.json", "utf8"));
const PLATFORM = process.argv[2] || "win32";
const OUT_DIR = "/tmp/electron-release";
const ZIP_DIR = "/mnt/documents";
const BUILD_DIR = "/tmp/electron-build";

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// 1. Preflight
run("node scripts/preflight.mjs --desktop");

// 2. Prepare isolated build folder (avoid polluting web deps)
rmSync(BUILD_DIR, { recursive: true, force: true });
mkdirSync(BUILD_DIR, { recursive: true });
for (const f of ["package.json", "electron", "build.config.json"]) {
  cpSync(f, join(BUILD_DIR, f), { recursive: true });
}

// 3. Install electron toolchain in isolation
run("npm install --no-save --ignore-scripts electron @electron/packager", { cwd: BUILD_DIR });

// 4. Smoke test — boot electron headless for 6s, expect no crash
console.log("\n▶ Smoke test (headless boot)…");
const smoke = spawn("npx", ["electron", "electron/main.cjs", "--no-sandbox", "--headless"], {
  cwd: BUILD_DIR,
  env: { ...process.env, HN_APP_URL: cfg.domains.primary, ELECTRON_DISABLE_GPU: "1" },
});
let smokeErr = "";
smoke.stderr.on("data", (d) => (smokeErr += d.toString()));
await new Promise((r) => setTimeout(r, 6000));
smoke.kill("SIGTERM");
if (smokeErr.match(/error|failed|cannot find/i)) {
  console.error("\n✗ Smoke test failed:\n" + smokeErr.slice(0, 800));
  process.exit(1);
}
console.log("  ✓ boots without fatal errors");

// 5. Package
rmSync(OUT_DIR, { recursive: true, force: true });
run(
  `npx @electron/packager . "${cfg.appName}" --platform=${PLATFORM} --arch=${cfg.desktop.arch} --out=${OUT_DIR} --overwrite --ignore="^/node_modules/(?!.)"`,
  { cwd: BUILD_DIR }
);

// 6. Zip
mkdirSync(ZIP_DIR, { recursive: true });
const outName = `${cfg.appName}-${PLATFORM}-${cfg.desktop.arch}`;
const zipPath = join(ZIP_DIR, `${outName}.zip`);
rmSync(zipPath, { force: true });
run(`cd ${OUT_DIR} && zip -qr ${zipPath} ${outName}`);

console.log(`\n✓ Desktop build ready: ${zipPath}\n`);
