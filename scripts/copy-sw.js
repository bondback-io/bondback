#!/usr/bin/env node
/**
 * Copies scripts/service-worker.js to public/service-worker.js so Next.js can serve it.
 * Run automatically before build (prebuild) or manually: node scripts/copy-sw.js
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "service-worker.js");
const dest = path.join(__dirname, "..", "public", "service-worker.js");

if (!fs.existsSync(src)) {
  console.warn("scripts/copy-sw.js: source service-worker.js not found, skipping.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied scripts/service-worker.js → public/service-worker.js");
