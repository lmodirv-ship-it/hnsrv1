#!/usr/bin/env node
// Build Android APK via Capacitor.
// Requires Android SDK + JDK on the host (not available in this sandbox — run locally).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const cfg = JSON.parse(readFileSync("build.config.json", "utf8"));
const run = (c) => execSync(c, { stdio: "inherit" });

run("node scripts/preflight.mjs --android");

if (!existsSync("capacitor.config.ts") && !existsSync("capacitor.config.json")) {
  console.log("Bootstrapping Capacitor…");
  run("npm install --no-save @capacitor/core @capacitor/cli @capacitor/android");
  run(`npx cap init "${cfg.android.name}" "${cfg.android.package}" --web-dir=dist`);
}

run("bun run build");
if (!existsSync("android")) run("npx cap add android");
run("npx cap sync android");

// Point the WebView at the primary domain (server mode) so backend stays live.
console.log(`\nℹ Edit capacitor.config.* → server.url = "${cfg.domains.primary}" for online mode.`);
console.log("Then build the APK:\n  cd android && ./gradlew assembleDebug");
console.log(`  Output: android/app/build/outputs/apk/debug/app-debug.apk\n`);
