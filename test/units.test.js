const { test } = require("node:test");
const assert = require("node:assert/strict");
const units = require("../core/units");

test("temperature C -> F", () => {
  assert.equal(units.fromBase("temperature", 0, "F"), 32);
  assert.equal(units.fromBase("temperature", 100, "F"), 212);
});

test("pressure hPa -> inHg", () => {
  const inHg = units.fromBase("pressure", 1013.25, "inHg");
  assert.ok(Math.abs(inHg - 29.92) < 0.01);
});

test("speed kmh -> knots and back", () => {
  const kn = units.fromBase("speed", 100, "kn");
  assert.ok(Math.abs(kn - 53.9957) < 0.01);
  const kmh = units.toBase("speed", kn, "kn");
  assert.ok(Math.abs(kmh - 100) < 0.001);
});

test("beaufort thresholds", () => {
  assert.equal(units.kmhToBeaufort(0), 0);
  assert.equal(units.kmhToBeaufort(5), 1);
  assert.equal(units.kmhToBeaufort(50), 7);
  assert.equal(units.kmhToBeaufort(200), 12);
});

test("format includes unit label", () => {
  assert.equal(units.format("temperature", 20, "C"), "20°C");
  assert.equal(units.format("speed", 36, "kmh"), "36 km/h");
});

test("format handles null gracefully", () => {
  assert.equal(units.format("temperature", null, "C"), "--");
});
