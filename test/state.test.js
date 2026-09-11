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

test("fromHaWeather converts an imperial-unit weather entity to canonical base units", () => {
  // Regression: an HA weather entity reports in ITS OWN unit system (here:
  // OpenWeatherMap configured imperial) — the *_unit attributes say so, and
  // the raw values must be converted, not passed through as if already °C/hPa/km.
  const s = state.fromHaWeather({
    state: "cloudy",
    attributes: {
      temperature: 67,
      temperature_unit: "°F",
      apparent_temperature: 68,
      humidity: 92,
      pressure: 29.97,
      pressure_unit: "inHg",
      wind_speed: 5,
      wind_speed_unit: "mph",
      visibility: 6.21,
      visibility_unit: "mi",
    },
  });
  assert.ok(Math.abs(s.current.tempC - 19.44) < 0.1);
  assert.ok(Math.abs(s.current.pressureHpa - 1014.9) < 1);
  assert.ok(Math.abs(s.current.windKmh - 8.05) < 0.1);
  assert.ok(Math.abs(s.current.visibilityKm - 9.99) < 0.1);
});

test("computeDewPointC is sane for a warm humid day", () => {
  const dp = state.computeDewPointC(25, 80);
  assert.ok(dp > 19 && dp < 22);
});
