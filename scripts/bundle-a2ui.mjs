#!/usr/bin/env node
/**
 * Cross-platform A2UI bundle script (Windows-compatible replacement for bundle-a2ui.sh)
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const HASH_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/.bundle.hash");
const OUTPUT_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/a2ui.bundle.js");
const A2UI_RENDERER_DIR = path.join(ROOT_DIR, "vendor/a2ui/renderers/lit");
const A2UI_APP_DIR = path.join(ROOT_DIR, "apps/shared/OpenClawKit/Tools/CanvasA2UI");

function onError() {
  console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
  console.error("If this persists, verify pnpm deps and try again.");
  process.exit(1);
}

// Docker builds exclude vendor/apps via .dockerignore.
if (!existsSync(A2UI_RENDERER_DIR) || !existsSync(A2UI_APP_DIR)) {
  if (existsSync(OUTPUT_FILE)) {
    console.log("A2UI sources missing; keeping prebuilt bundle.");
    process.exit(0);
  }
  console.error(`A2UI sources missing and no prebuilt bundle found at: ${OUTPUT_FILE}`);
  onError();
}

const INPUT_PATHS = [
  path.join(ROOT_DIR, "package.json"),
  path.join(ROOT_DIR, "pnpm-lock.yaml"),
  A2UI_RENDERER_DIR,
  A2UI_APP_DIR,
];

function walk(entryPath, files = []) {
  const st = statSync(entryPath);
  if (st.isDirectory()) {
    for (const entry of readdirSync(entryPath)) {
      walk(path.join(entryPath, entry), files);
    }
    return;
  }
  files.push(entryPath);
}

function computeHash() {
  const files = [];
  for (const input of INPUT_PATHS) {
    walk(input, files);
  }
  const normalize = (p) => p.split(path.sep).join("/");
  files.sort((a, b) => normalize(path.relative(ROOT_DIR, a)).localeCompare(normalize(path.relative(ROOT_DIR, b))));
  const hash = createHash("sha256");
  for (const filePath of files) {
    const rel = normalize(path.relative(ROOT_DIR, filePath));
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const currentHash = computeHash();
if (existsSync(HASH_FILE) && existsSync(OUTPUT_FILE)) {
  const previousHash = readFileSync(HASH_FILE, "utf8").trim();
  if (previousHash === currentHash) {
    console.log("A2UI bundle up to date; skipping.");
    process.exit(0);
  }
}

// Run tsc
const tscResult = spawnSync("pnpm", ["-s", "exec", "tsc", "-p", path.join(A2UI_RENDERER_DIR, "tsconfig.json")], {
  cwd: ROOT_DIR,
  stdio: "inherit",
  shell: true,
});
if (tscResult.status !== 0) onError();

// Run rolldown
const rolldownConfig = path.join(A2UI_APP_DIR, "rolldown.config.mjs");
const rolldownResult = spawnSync("pnpm", ["-s", "dlx", "rolldown", "-c", rolldownConfig], {
  cwd: ROOT_DIR,
  stdio: "inherit",
  shell: true,
});
if (rolldownResult.status !== 0) onError();

writeFileSync(HASH_FILE, currentHash, "utf8");
console.log(`Hash written to ${HASH_FILE}`);
