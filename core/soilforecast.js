(function () {
/**
 * Soil-temperature forecast from "day-bucket" sensors: a group of entities
 * (day 0, day 1, ...), each holding a bracketed CSV string of hourly values
 * for that day, e.g. sensor.soil_temperature_week_day_0 = "[9.1, 9.0, ...]"
 * (24 values). Mirrors the apexcharts-card data_generator pattern so the
 * same source sensors can feed both a dashboard chart and this module.
 */

/** Parse "[1.2, 3.4, 5.6]" (or "1.2,3.4,5.6") into an array of numbers. */
function parseDayBucketArray(raw) {
  if (raw === null || raw === undefined) return [];
  const cleaned = String(raw).replace(/^\s*\[/, "").replace(/\]\s*$/, "");
  if (!cleaned.trim()) return [];
  return cleaned
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Build a canonical hourly forecast series from ordered day-bucket values.
 * `dayValues` = array of arrays (day 0 first), each ~24 hourly readings.
 * `startOfDay` = Date for midnight of "day 0" (defaults to today, local).
 * `hoursPerDay` = values per day array (default 24).
 */
function buildSoilForecast(dayValues, { startOfDay = null, hoursPerDay = 24 } = {}) {
  const start = startOfDay || new Date(new Date().setHours(0, 0, 0, 0));
  const points = [];
  dayValues.forEach((values, dayIndex) => {
    values.forEach((tempC, hourIndex) => {
      const ts = start.getTime() + (dayIndex * hoursPerDay + hourIndex) * 3600000;
      points.push({ time: new Date(ts).toISOString(), tempC });
    });
  });
  return points;
}

const __exports = { parseDayBucketArray, buildSoilForecast };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.soilforecast = __exports;
}
})();
