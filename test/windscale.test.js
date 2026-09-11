const { test } = require("node:test");
const assert = require("node:assert/strict");
const windscale = require("../core/windscale");

test("calm wind is the coolest stop colour", () => {
  assert.equal(windscale.colorForKmh(0), windscale.STOPS[0].color);
});

test("extreme wind is the last stop colour", () => {
  assert.equal(windscale.colorForBft(12), windscale.STOPS[windscale.STOPS.length - 1].color);
});

test("colour is deterministic for the same speed (arrows == chart points)", () => {
  assert.equal(windscale.colorForKmh(42), windscale.colorForKmh(42));
});

test("legend has monotonic beaufort ticks", () => {
  const l = windscale.legend();
  const bfts = l.ticks.map((t) => t.bft);
  assert.deepEqual(bfts, [...bfts].sort((a, b) => a - b));
});
