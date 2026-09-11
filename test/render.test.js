const { test } = require("node:test");
const assert = require("node:assert/strict");
const render = require("../core/render");

function mmh(values) {
  return values.map((v) => ({ precipMmh: v }));
}

test("minutelyCalloutText: dry the whole hour", () => {
  const txt = render.minutelyCalloutText(mmh(new Array(60).fill(0)));
  assert.equal(txt, "No rain expected in the next hour");
});

test("minutelyCalloutText: rain starting partway through", () => {
  const rows = mmh([...new Array(12).fill(0), ...new Array(48).fill(1.5)]);
  assert.equal(render.minutelyCalloutText(rows), "Rain starting in 12 min");
});

test("minutelyCalloutText: raining now, stops partway through", () => {
  const rows = mmh([...new Array(8).fill(2), ...new Array(52).fill(0)]);
  assert.equal(render.minutelyCalloutText(rows), "Rain ending in 8 min");
});

test("minutelyCalloutText: raining for the whole hour", () => {
  const rows = mmh(new Array(60).fill(3));
  assert.equal(render.minutelyCalloutText(rows), "Rain for the next hour");
});

test("minutelyCalloutText: empty series", () => {
  assert.equal(render.minutelyCalloutText([]), "");
  assert.equal(render.minutelyCalloutText(null), "");
});

test("minutelyCalloutText: respects the threshold (trace precip doesn't count)", () => {
  const rows = mmh(new Array(60).fill(0.02));
  assert.equal(render.minutelyCalloutText(rows), "No rain expected in the next hour");
});
