const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * Regression test: MagicMirror's getScripts() loads each core/*.js file as
 * its OWN <script> tag, and classic (non-module) scripts share ONE global
 * lexical scope for const/let declarations across the whole page. A file
 * that runs fine alone can still throw `Identifier '...' has already been
 * declared` once a second file with the same top-level const name loads
 * into that same scope — `require()`-based tests never catch this because
 * each require() gets its own isolated module scope.
 *
 * This runs every core/*.js file, in getScripts() order, in one shared vm
 * context (closer to real <script> tag semantics than require() is), and
 * asserts every one of them actually finishes and populates window.WeatherCore.
 */
test("every core/*.js file loads without global-scope collisions, in MM's getScripts() order", () => {
  const files = [
    "units.js",
    "windscale.js",
    "visuals.js",
    "unitcycle.js",
    "render.js",
    "charts.js",
    "state.js",
    "conditions.js",
    "soilforecast.js",
  ];
  const sandboxWindow = { WeatherCore: {} };
  const sandbox = vm.createContext({ window: sandboxWindow, console, Math, Date, JSON, Infinity });

  for (const file of files) {
    const src = fs.readFileSync(path.join(__dirname, "..", "core", file), "utf8");
    vm.runInContext(src, sandbox, { filename: file });
  }

  const expectedKeys = [
    "units",
    "windscale",
    "visuals",
    "unitcycle",
    "render",
    "charts",
    "state",
    "conditions",
    "soilforecast",
  ];
  for (const key of expectedKeys) {
    assert.ok(sandboxWindow.WeatherCore[key], `window.WeatherCore.${key} should be defined after loading ${key}.js`);
  }
  assert.equal(typeof sandboxWindow.WeatherCore.render.weatherHtml, "function");
});
