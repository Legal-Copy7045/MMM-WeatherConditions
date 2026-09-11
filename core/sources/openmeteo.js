/** Open-Meteo source: free, keyless. Default for standalone mode B. */

const CURRENT_FIELDS = [
  "temperature_2m", "relative_humidity_2m", "apparent_temperature",
  "is_day", "precipitation", "rain", "weather_code", "cloud_cover",
  "surface_pressure", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
  "soil_temperature_0cm",
].join(",");

const HOURLY_FIELDS = [
  "temperature_2m", "precipitation_probability", "precipitation",
  "weather_code", "wind_speed_10m", "wind_direction_10m", "is_day", "uv_index",
].join(",");

const DAILY_FIELDS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "sunrise", "sunset", "precipitation_sum", "precipitation_probability_max",
  "wind_speed_10m_max", "wind_direction_10m_dominant",
].join(",");

function buildUrl({ lat, lon, timezone = "auto", forecastDays = 8 }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone,
    forecast_days: String(forecastDays),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

async function fetchOpenMeteo({ lat, lon, timezone, forecastDays }, fetchImpl = fetch) {
  const res = await fetchImpl(buildUrl({ lat, lon, timezone, forecastDays }));
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

module.exports = { buildUrl, fetchOpenMeteo };
