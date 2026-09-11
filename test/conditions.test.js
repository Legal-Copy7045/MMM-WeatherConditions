const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deriveAlerts } = require("../core/conditions");

test("no alerts for a mild calm day", () => {
  const alerts = deriveAlerts({ current: { tempC: 18, windGustKmh: 15, uvIndex: 3 } });
  assert.equal(alerts.length, 0);
});

test("flags frost, high wind and high UV together", () => {
  const alerts = deriveAlerts({ current: { tempC: -1, windGustKmh: 75, uvIndex: 9 } });
  const labels = alerts.map((a) => a.label);
  assert.ok(labels.includes("Frost risk"));
  assert.ok(labels.includes("High wind"));
  assert.ok(labels.includes("High UV"));
});

test("thresholds are configurable", () => {
  const alerts = deriveAlerts({ current: { tempC: 5 } }, { frost: { belowC: 6 } });
  assert.equal(alerts[0].label, "Frost risk");
});

test("preserves source-provided alerts (e.g. OWM severe weather)", () => {
  const alerts = deriveAlerts({ current: {}, alerts: [{ level: "warning", label: "Flood Watch" }] });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].label, "Flood Watch");
});
