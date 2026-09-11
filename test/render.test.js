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

// Regression: stats used to be cells in a 2-column CSS Grid, where a grid
// sizes every cell in a row to its tallest member -- so any layout quirk in
// one cell could visually distort its row-mate. Independent label/value
// rows can't leak height into each other; this locks in that each stat is
// its own <div class="wc-stat-row"> rather than a 2-column grid item.
test("currentCardHtml renders stats as independent rows, not a 2-column grid", () => {
  const state = { current: { humidityPct: 62, windKmh: 14, pressureHpa: 1014 } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.doesNotMatch(html, /wc-current-stats/);
  const rowCount = (html.match(/wc-stat-row/g) || []).length;
  assert.equal(rowCount, 4); // Humidity, Pressure, Wind, UV Index (always shown; no moon/soil data here)
});

// Regression: condition + feels-like used to sit beside the icon/temp in
// the same flex row, so their horizontal position depended on how much
// space the icon+temp happened to leave over -- it looked randomly placed
// rather than deliberately laid out. They're now a dedicated full-width
// line below the icon/temp row instead.
test("currentCardHtml puts condition and feels-like on their own line below the icon/temp row", () => {
  const state = { current: { tempC: 19, feelsLikeC: 18, condition: "Partly cloudy" } };
  const html = render.currentCardHtml(state, currentCfg);
  assert.match(html, /<div class="wc-current-main">[\s\S]*?<\/div>\s*<div class="wc-cond-line">/);
  assert.match(html, /wc-cond-line">\s*<span class="wc-cond-text">Partly cloudy<\/span><span class="wc-feelslike wc-dimmed"> · feels like/);
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
