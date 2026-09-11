const { test } = require("node:test");
const assert = require("node:assert/strict");
const charts = require("../core/charts");

const baseConfig = () => ({
  units: {
    temperature: { list: ["C"] },
    precipitation: { list: ["mm"] },
  },
  hourlySeries: { temperature: true, precipitation: true, wind: true },
  dailySeries: { temperature: true, precipitation: true, wind: true },
  hourlyPoints: 5,
  hourlyStepHours: 1,
  dailyDays: 5,
});

const hourlyRows = [
  { time: "2026-01-01T00:00:00Z", tempC: 5, precipMm: 0, windKmh: 10 },
  { time: "2026-01-01T01:00:00Z", tempC: 6, precipMm: 2.3, windKmh: 12 },
];

test("lineBarChartConfig includes the precip-labels plugin when precipitation series is on", () => {
  const cfg = charts.lineBarChartConfig(hourlyRows, baseConfig(), "time", false);
  assert.ok(cfg.plugins.some((p) => p.id === "wcPrecipLabels"));
});

test("lineBarChartConfig omits the plugin when precipitation series is off", () => {
  const config = baseConfig();
  config.hourlySeries.precipitation = false;
  const cfg = charts.lineBarChartConfig(hourlyRows, config, "time", false);
  assert.equal(cfg.plugins.length, 0);
});

test("precip-labels plugin draws text only for non-zero bars, in the configured unit", () => {
  const cfg = charts.lineBarChartConfig(hourlyRows, baseConfig(), "time", false);
  const plugin = cfg.plugins.find((p) => p.id === "wcPrecipLabels");
  const calls = [];
  const fakeChart = {
    data: cfg.data,
    getDatasetMeta: () => ({
      hidden: false,
      data: [{ x: 10, y: 50 }, { x: 30, y: 20 }],
    }),
    ctx: {
      save() {},
      restore() {},
      fillText: (...args) => calls.push(args),
    },
  };
  plugin.afterDatasetsDraw(fakeChart);
  assert.equal(calls.length, 1); // only the second bar has non-zero precip
  assert.equal(calls[0][0], "2.3 mm");
});

test("minutelyChartConfig produces one point per minutely row", () => {
  const state = { minutely: [{ precipMmh: 0 }, { precipMmh: 1.2 }] };
  const cfg = charts.minutelyChartConfig(state);
  assert.equal(cfg.data.datasets[0].data.length, 2);
  assert.equal(cfg.data.datasets[0].data[1], 1.2);
});
