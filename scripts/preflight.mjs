#!/usr/bin/env node
// Pre-publish / pre-build validation.
// Usage:
//   node scripts/preflight.mjs            → validate for web publish
//   node scripts/preflight.mjs --desktop  → validate for desktop build
//   node scripts/preflight.mjs --android  → validate for APK build
import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const mode = process.argv.find((a) => a.startsWith("--"))?.slice(2) ?? "web";
const cfg = JSON.parse(readFileSync("build.config.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const errors = [];
const warn = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => errors.push(m);
const warnMsg = (m) => warn.push(m);

console.log(`\n▶ Preflight (${mode})\n`);

// 1. Required files
for (const f of cfg.publish.requiredFiles) {
  existsSync(f) ? ok(`file ${f}`) : fail(`missing required file: ${f}`);
}

// 2. bun.lock freshness — must be newer or equal to package.json
if (existsSync("bun.lock") && existsSync("package.json")) {
  const lockAge = statSync("bun.lock").mtimeMs;
  const pkgAge = statSync("package.json").mtimeMs;
  if (pkgAge > lockAge + 2000) {
    fail("bun.lock is older than package.json — run `bun install --ignore-scripts` to refresh");
  } else ok("bun.lock in sync with package.json");
}

// 3. No forbidden deps leaking into published bundle
const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const bad of cfg.publish.forbiddenDeps) {
  if (mode === "web" && allDeps[bad]) {
    fail(`forbidden dep for web publish: "${bad}" — remove before publishing (belongs to desktop/android build only)`);
  }
}
if (mode === "web" && !errors.some((e) => e.includes("forbidden"))) ok("no build-only deps in package.json");

// 4. bun install dry-run (catches broken lockfile)
try {
  execSync("bun install --ignore-scripts --frozen-lockfile --dry-run", { stdio: "pipe" });
  ok("bun.lock resolves cleanly");
} catch (e) {
  fail("bun install --frozen-lockfile failed:\n" + (e.stderr?.toString() || e.message).slice(0, 400));
}

// 5. Mode-specific
if (mode === "desktop") {
  existsSync("electron/main.cjs") ? ok("electron/main.cjs present") : fail("electron/main.cjs missing");
  existsSync("electron/index.html") ? ok("electron/index.html fallback present") : warnMsg("electron/index.html fallback missing");
}
if (mode === "android") {
  existsSync("android") ? ok("android/ project present") : warnMsg("android/ folder missing — run `npx cap add android`");
  existsSync("capacitor.config.ts") || existsSync("capacitor.config.json")
    ? ok("capacitor config present")
    : fail("capacitor.config not found");
}

// 6. Domain reachability (best-effort)
if (mode !== "web") {
  for (const [k, url] of Object.entries(cfg.domains)) {
    try {
      execSync(`curl -sfI --max-time 5 ${url} -o /dev/null`, { stdio: "pipe" });
      ok(`domain reachable (${k}): ${url}`);
    } catch {
      warnMsg(`domain not reachable (${k}): ${url}`);
    }
  }
}

// Report
console.log("");
warn.forEach((w) => console.log(`  ⚠ ${w}`));
if (errors.length) {
  console.error(`\n✗ Preflight failed (${errors.length}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`\n✓ Preflight passed${warn.length ? ` (${warn.length} warnings)` : ""}\n`);
