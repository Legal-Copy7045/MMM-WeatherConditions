const { test } = require("node:test");
const assert = require("node:assert/strict");
const state = require("../core/state");

test("fromOpenMeteo maps current + hourly + daily", () => {
  const raw = {
    latitude: 40.7,
    longitude: -79.8,
    current: { temperature_2m: 18, relative_humidity_2m: 60, wind_speed_10m: 10, weather_code: 1, is_day: 1 },
    hourly: {
      time: ["2026-01-01T00:00", "2026-01-01T01:00"],
      temperature_2m: [17, 16],
      precipitation: [0, 0.2],
      weather_code: [1, 61],
      is_day: [1, 0],
    },
    daily: {
      time: ["2026-01-01"],
      temperature_2m_max: [19],
      temperature_2m_min: [10],
      sunrise: ["2026-01-01T07:00"],
      sunset: ["2026-01-01T17:00"],
    },
  };
  const s = state.fromOpenMeteo(raw);
  assert.equal(s.source, "openmeteo");
  assert.equal(s.current.tempC, 18);
  assert.equal(s.hourly.length, 2);
  assert.equal(s.hourly[1].icon, "rain");
  assert.equal(s.daily[0].tempMaxC, 19);
});

test("fromHaWeather overlays supplemental extra sensors", () => {
  const s = state.fromHaWeather(
    { state: "sunny", attributes: { temperature: 21, humidity: 40 } },
    { extra: { soilTempC: 9.4, rainRateMmh: 0 } }
  );
  assert.equal(s.current.tempC, 21);
  assert.equal(s.current.soilTempC, 9.4);
  assert.equal(s.current.icon, "clear-day");
});

test("computeDewPointC is sane for a warm humid day", () => {
  const dp = state.computeDewPointC(25, 80);
  assert.ok(dp > 19 && dp < 22);
});
