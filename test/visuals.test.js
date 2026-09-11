const { test } = require("node:test");
const assert = require("node:assert/strict");
const visuals = require("../core/visuals");

test("moonPhaseLabel matches the four cardinal phases", () => {
  assert.equal(visuals.moonPhaseLabel(0), "new moon");
  assert.equal(visuals.moonPhaseLabel(0.25), "first quarter");
  assert.equal(visuals.moonPhaseLabel(0.5), "full moon");
  assert.equal(visuals.moonPhaseLabel(0.75), "last quarter");
});

test("moonPhaseLabel wraps phase 1 back to new moon", () => {
  assert.equal(visuals.moonPhaseLabel(1), "new moon");
});

test("moonPhaseLabel handles null gracefully", () => {
  assert.equal(visuals.moonPhaseLabel(null), "--");
});

test("moonPhaseHtml returns a wi icon glyph for every cardinal phase", () => {
  [0, 0.25, 0.5, 0.75].forEach((p) => {
    const html = visuals.moonPhaseHtml(p, { size: 16 });
    assert.match(html, /<i class="wi wi-moon-\S+ wc-moon-icon"/);
  });
});

test("moonPhaseHtml returns empty string for null phase", () => {
  assert.equal(visuals.moonPhaseHtml(null), "");
});

// Regression check that the four cardinal phases map to the icon set's four
// unambiguous cardinal glyphs, and that upstream's inconsistent class-name
// spelling ("waxing-cresent" vs "waning-crescent" — a real typo in the
// weather-icons library, not ours) is reproduced exactly since these are
// literal CSS class names the vendored font's CSS defines.
test("moonPhaseHtml: cardinal phases map to the expected icon classes", () => {
  assert.match(visuals.moonPhaseHtml(0), /wi-moon-new/);
  assert.match(visuals.moonPhaseHtml(0.25), /wi-moon-first-quarter/);
  assert.match(visuals.moonPhaseHtml(0.5), /wi-moon-full/);
  assert.match(visuals.moonPhaseHtml(0.75), /wi-moon-3rd-quarter/);
});

test("moonPhaseHtml: waxing phases use the upstream-typo'd 'cresent' class, waning phases the correctly-spelled 'crescent'", () => {
  assert.match(visuals.moonPhaseHtml(0.1), /wi-moon-waxing-cresent-\d/);
  assert.match(visuals.moonPhaseHtml(0.9), /wi-moon-waning-crescent-\d/);
});

test("conditionIconHtml returns a wi icon glyph for a known condition", () => {
  const html = visuals.conditionIconHtml("rain", { size: 32 });
  assert.match(html, /<i class="wi wi-rain wc-icon wc-icon-rain"/);
});

test("conditionIconHtml falls back to a generic cloud glyph for an unknown condition key", () => {
  const html = visuals.conditionIconHtml("not-a-real-condition", { size: 32 });
  assert.match(html, /wi-cloud/);
});

test("windArrowHtml rotates by direction + 180deg and colours by wind speed", () => {
  const html = visuals.windArrowHtml(90, 10, { size: 14 });
  assert.match(html, /<i class="wi wi-wind-default wc-wind-arrow"/);
  assert.match(html, /rotate\(270deg\)/);
});

test("sunArcHtml returns empty string when sunrise/sunset are unknown", () => {
  assert.equal(visuals.sunArcHtml({ sunrise: null, sunset: null }), "");
});

test("sunArcHtml includes sunrise/sunset icon glyphs and the arc svg", () => {
  const html = visuals.sunArcHtml({
    sunrise: "2026-01-01T07:00:00Z",
    sunset: "2026-01-01T17:00:00Z",
    now: new Date("2026-01-01T12:00:00Z"),
  });
  assert.match(html, /wi-sunrise/);
  assert.match(html, /wi-sunset/);
  assert.match(html, /<svg/);
});

test("uvDescriptor buckets are monotonically increasing severity", () => {
  assert.equal(visuals.uvDescriptor(1).label, "low");
  assert.equal(visuals.uvDescriptor(4).label, "moderate");
  assert.equal(visuals.uvDescriptor(7).label, "high");
  assert.equal(visuals.uvDescriptor(9).label, "very high");
  assert.equal(visuals.uvDescriptor(12).label, "extreme");
});
