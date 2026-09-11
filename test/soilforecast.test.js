const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseDayBucketArray, buildSoilForecast } = require("../core/soilforecast");

test("parses bracketed CSV", () => {
  assert.deepEqual(parseDayBucketArray("[9.1, 9.0, 8.8]"), [9.1, 9.0, 8.8]);
});

test("parses bare CSV without brackets", () => {
  assert.deepEqual(parseDayBucketArray("1,2,3"), [1, 2, 3]);
});

test("handles unknown/unavailable/empty gracefully", () => {
  assert.deepEqual(parseDayBucketArray("unknown"), []);
  assert.deepEqual(parseDayBucketArray(""), []);
  assert.deepEqual(parseDayBucketArray(null), []);
});

test("buildSoilForecast lays out day-bucket values back to back in time", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const points = buildSoilForecast([[1, 2], [3, 4]], { startOfDay: start, hoursPerDay: 2 });
  assert.equal(points.length, 4);
  assert.equal(points[0].tempC, 1);
  assert.equal(points[0].time, "2026-01-01T00:00:00.000Z");
  assert.equal(points[2].tempC, 3);
  assert.equal(points[2].time, "2026-01-01T02:00:00.000Z"); // day 1 starts at hour 1*hoursPerDay
});
