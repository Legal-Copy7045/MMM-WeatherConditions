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

const dailyRows = {
  daily: [{ date: "2026-01-01T00:00:00Z", icon: "clear-day", windKmh: 10 }],
  soilForecast: [{ time: "2026-01-01T00:00:00Z", tempC: 10 }],
};
const baseCfg = { units: { wind: { list: ["kmh"] } }, cards: {} };

test("dailyCardHtml includes both view containers when soil forecast is enabled with data", () => {
  const html = render.dailyCardHtml(dailyRows, { ...baseCfg, cards: { soilForecast: true } });
  assert.match(html, /id="wc-daily-temp-view"/);
  assert.match(html, /id="wc-daily-soil-view"/);
  assert.match(html, /id="wc-daily-soil-chart"/);
});

test("dailyCardHtml omits the soil view when soilForecast is off", () => {
  const html = render.dailyCardHtml(dailyRows, { ...baseCfg, cards: { soilForecast: false } });
  assert.match(html, /id="wc-daily-temp-view"/);
  assert.doesNotMatch(html, /id="wc-daily-soil-view"/);
});

test("dailyCardHtml omits the soil view when there's no soil forecast data, even if enabled", () => {
  const html = render.dailyCardHtml({ daily: dailyRows.daily, soilForecast: [] }, { ...baseCfg, cards: { soilForecast: true } });
  assert.doesNotMatch(html, /id="wc-daily-soil-view"/);
});

test("dailyCardHtml has a stable id for the title so it can be swapped between the two view labels", () => {
  const html = render.dailyCardHtml(dailyRows, baseCfg);
  assert.match(html, /id="wc-daily-title"[^>]*>Daily Forecast</);
});

const currentCfg = {
  units: {
    temperature: { list: ["C"] },
    pressure: { list: ["hPa"] },
    wind: { list: ["kmh"] },
  },
};

// Regression: dew point and gust readings used to render on a second line
// inside their stat cell, so a stat with that extra line was taller than
// its row-mate and left a lopsided gap beside it (e.g. Pressure's cell sat
// noticeably shorter than Humidity's, right next to it in the same grid
// row). Folding the note onto the value's own line keeps every cell the
// same height.
test("currentCardHtml keeps each stat to a single line, with dew point/gusts as an inline note", () => {
  const state = { current: { humidityPct: 62, dewPointC: 12, windKmh: 14, windGustKmh: 26, pressureHpa: 1014 } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.doesNotMatch(html, /wc-stat-sub/);
  assert.match(html, /62%<span class="wc-stat-note wc-dimmed"> · dew/);
  assert.match(html, /· gusts/);
});

test("currentCardHtml omits the dew-point/gust note entirely when that reading is unavailable", () => {
  const state = { current: { humidityPct: 62, windKmh: 14, pressureHpa: 1014 } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.doesNotMatch(html, /wc-stat-note/);
});

test("currentCardHtml omits the Soil temp stat when soilTempC is unavailable", () => {
  const state = { current: { humidityPct: 62, windKmh: 14, pressureHpa: 1014 } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.doesNotMatch(html, /Soil temp/);
});

test("currentCardHtml includes the Soil temp stat when soilTempC is present", () => {
  const state = { current: { humidityPct: 62, windKmh: 14, pressureHpa: 1014, soilTempC: 13 } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.match(html, /Soil temp/);
});
