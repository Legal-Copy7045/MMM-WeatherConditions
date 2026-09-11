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

test("moonPhaseSvg returns a non-empty SVG string for every cardinal phase", () => {
  [0, 0.25, 0.5, 0.75].forEach((p) => {
    const svg = visuals.moonPhaseSvg(p, { size: 16 });
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("</svg>"));
  });
});

test("moonPhaseSvg returns empty string for null phase", () => {
  assert.equal(visuals.moonPhaseSvg(null), "");
});

/** Pulls the two elliptical-arc sweep-flag digits out of the generated path. */
function sweepFlags(svg) {
  const m = svg.match(/A [\d.]+ [\d.]+ 0 0 (\d)[^A]*A [\d.]+ [\d.]+ 0 0 (\d)/);
  return [Number(m[1]), Number(m[2])];
}

// Regression snapshot of the sweep-flag pairs at each phase, confirmed
// correct by actually rendering all nine phases in a browser and checking
// the shape (dark new moon -> growing right crescent -> half at first
// quarter -> light full moon -> shrinking left crescent -> dark again) --
// a hand-derived relational assertion got the sweep-flag direction backwards
// once already (top->bottom vs bottom->top arcs bulge to OPPOSITE screen
// sides for the SAME flag value, not the same side), so this locks in the
// verified-by-eye output instead of re-deriving the geometry in the test.
test("moonPhaseSvg: sweep-flag pairs match the visually-verified render at each phase", () => {
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0)), [0, 1]); // new moon
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.1)), [0, 1]); // waxing crescent
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.25)), [1, 1]); // first quarter
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.4)), [1, 1]); // waxing gibbous
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.5)), [0, 0]); // full moon
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.6)), [0, 0]); // waning gibbous
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.75)), [1, 0]); // last quarter
  assert.deepEqual(sweepFlags(visuals.moonPhaseSvg(0.9)), [1, 0]); // waning crescent
});

test("iconSvg returns a non-empty SVG for a known condition", () => {
  const svg = visuals.iconSvg("rain", { size: 32 });
  assert.ok(svg.includes("<svg"));
});

test("uvDescriptor buckets are monotonically increasing severity", () => {
  assert.equal(visuals.uvDescriptor(1).label, "low");
  assert.equal(visuals.uvDescriptor(4).label, "moderate");
  assert.equal(visuals.uvDescriptor(7).label, "high");
  assert.equal(visuals.uvDescriptor(9).label, "very high");
  assert.equal(visuals.uvDescriptor(12).label, "extreme");
});
