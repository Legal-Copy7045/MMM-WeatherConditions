#!/usr/bin/env node
/**
 * Vendors the shared core/*.py files into custom_components/weather_conditions/core/
 * so the HA integration can `from .core import state as core_state` etc.
 * Run after editing anything in core/*.py. CI fails on drift (see test/spec_check.py).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "core");
const DEST = path.join(ROOT, "custom_components", "weather_conditions", "core");

const PY_FILES = ["units.py", "state.py", "conditions.py", "windscale.py", "soilforecast.py"];

fs.mkdirSync(DEST, { recursive: true });
fs.writeFileSync(
  path.join(DEST, "__init__.py"),
  '"""Vendored copy of ../../../core/*.py — do not edit here, edit the source and re-run `npm run sync`."""\n'
);

for (const file of PY_FILES) {
  const src = path.join(SRC, file);
  const dest = path.join(DEST, file);
  const header = `"""Vendored from core/${file} by scripts/sync-core.js — do not edit directly."""\n\n`;
  const body = fs.readFileSync(src, "utf8").replace(/^"""[\s\S]*?"""\n\n?/, "");
  fs.writeFileSync(dest, header + body);
  console.log(`synced ${file}`);
}

// Vendor Chart.js's UMD build so the module works with MagicMirror fully offline.
const chartSrc = path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.min.js");
const vendorDir = path.join(ROOT, "vendor");
if (fs.existsSync(chartSrc)) {
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.copyFileSync(chartSrc, path.join(vendorDir, "chart.umd.min.js"));
  console.log("vendored chart.umd.min.js");
} else {
  console.warn("chart.js not installed — run `npm install` before `npm run sync` to vendor it");
}

console.log("sync-core: done");
