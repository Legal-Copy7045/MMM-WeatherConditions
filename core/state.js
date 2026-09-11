(function () {
/**
 * Canonical weather state + normalizers from each supported source.
 * Every value is stored in a fixed base unit (°C, hPa, km/h, mm, km) —
 * conversion to display units happens at render time via units.js.
 *
 * Canonical shape:
 * {
 *   updatedAt, source, location: {name, lat, lon},
 *   current: { tempC, feelsLikeC, humidityPct, dewPointC, pressureHpa,
 *              windKmh, windGustKmh, windDirDeg, uvIndex, cloudPct,
 *              visibilityKm, precipMm, soilTempC, rainRateMmh,
 *              condition, icon, isDay, sunrise (ISO), sunset (ISO) },
 *   hourly: [{ time (ISO), tempC, precipMm, precipProbPct, windKmh,
 *              windDirDeg, condition, icon }],
 *   daily: [{ date (ISO), tempMinC, tempMaxC, precipMm, precipProbPct,
 *             windKmh, windDirDeg, condition, icon, sunrise, sunset }]
 * }
 */

const units =
  typeof module === "object" && module.exports ? require("./units") : window.WeatherCore.units;

/** Magnus-Tetens approximation, used when a source doesn't report dew point. */
function computeDewPointC(tempC, humidityPct) {
  if (tempC === null || tempC === undefined || humidityPct === null || humidityPct === undefined) return null;
  const a = 17.62;
  const b = 243.12;
  const gamma = (a * tempC) / (b + tempC) + Math.log(humidityPct / 100);
  return (b * gamma) / (a - gamma);
}

// HA weather entities report values in whatever unit the entity itself uses
// (its own *_unit attribute) — NOT necessarily our canonical base unit. Map
// HA's unit strings to our unit codes so we can convert with units.js.
const HA_TEMP_UNIT_MAP = { "°F": "F", "°C": "C", K: "K" };
const HA_PRESSURE_UNIT_MAP = { hPa: "hPa", mbar: "hPa", inHg: "inHg", mmHg: "mmHg", kPa: "kPa" };
const HA_SPEED_UNIT_MAP = { mph: "mph", "km/h": "kmh", kmh: "kmh", "m/s": "ms", kn: "kn", kt: "kn" };
const HA_LENGTH_SMALL_UNIT_MAP = { mm: "mm", cm: "cm", in: "in" };
const HA_LENGTH_LARGE_UNIT_MAP = { km: "km", mi: "mi" };

/** Convert `value` (in `unitCode`) to the kind's base unit; passes through unchanged if unrecognized. */
function toBaseHa(value, kind, unitCode) {
  if (value === null || value === undefined || !unitCode) return value;
  try {
    return units.toBase(kind, value, unitCode);
  } catch (e) {
    return value;
  }
}

const OWM_ICON_MAP = {
  "01d": "clear-day", "01n": "clear-night",
  "02d": "partly-cloudy-day", "02n": "partly-cloudy-night",
  "03d": "cloudy", "03n": "cloudy",
  "04d": "overcast", "04n": "overcast",
  "09d": "drizzle", "09n": "drizzle",
  "10d": "rain", "10n": "rain",
  "11d": "thunderstorm", "11n": "thunderstorm",
  "13d": "snow", "13n": "snow",
  "50d": "fog", "50n": "fog",
};

/** Normalize an OpenWeather One Call 3.0 response (`/data/3.0/onecall`). */
function fromOpenWeatherMap(json) {
  const cur = json.current || {};
  const w = (cur.weather && cur.weather[0]) || {};
  return {
    updatedAt: new Date((cur.dt || Date.now() / 1000) * 1000).toISOString(),
    source: "openweathermap",
    location: { name: json.timezone, lat: json.lat, lon: json.lon },
    current: {
      tempC: cur.temp,
      feelsLikeC: cur.feels_like,
      humidityPct: cur.humidity,
      dewPointC: cur.dew_point ?? computeDewPointC(cur.temp, cur.humidity),
      pressureHpa: cur.pressure,
      windKmh: cur.wind_speed != null ? cur.wind_speed * 3.6 : null,
      windGustKmh: cur.wind_gust != null ? cur.wind_gust * 3.6 : null,
      windDirDeg: cur.wind_deg,
      uvIndex: cur.uvi,
      cloudPct: cur.clouds,
      visibilityKm: cur.visibility != null ? cur.visibility / 1000 : null,
      precipMm: (cur.rain && cur.rain["1h"]) || (cur.snow && cur.snow["1h"]) || 0,
      soilTempC: null,
      rainRateMmh: (cur.rain && cur.rain["1h"]) || 0,
      condition: w.main || "unknown",
      icon: OWM_ICON_MAP[w.icon] || "cloudy",
      isDay: w.icon ? w.icon.endsWith("d") : true,
      sunrise: cur.sunrise ? new Date(cur.sunrise * 1000).toISOString() : null,
      sunset: cur.sunset ? new Date(cur.sunset * 1000).toISOString() : null,
    },
    hourly: (json.hourly || []).map((h) => {
      const hw = (h.weather && h.weather[0]) || {};
      return {
        time: new Date(h.dt * 1000).toISOString(),
        tempC: h.temp,
        precipMm: (h.rain && h.rain["1h"]) || (h.snow && h.snow["1h"]) || 0,
        precipProbPct: h.pop != null ? Math.round(h.pop * 100) : null,
        windKmh: h.wind_speed != null ? h.wind_speed * 3.6 : null,
        windDirDeg: h.wind_deg,
        condition: hw.main || "unknown",
        icon: OWM_ICON_MAP[hw.icon] || "cloudy",
      };
    }),
    daily: (json.daily || []).map((d) => {
      const dw = (d.weather && d.weather[0]) || {};
      return {
        date: new Date(d.dt * 1000).toISOString(),
        tempMinC: d.temp && d.temp.min,
        tempMaxC: d.temp && d.temp.max,
        precipMm: (d.rain || 0) + (d.snow || 0),
        precipProbPct: d.pop != null ? Math.round(d.pop * 100) : null,
        windKmh: d.wind_speed != null ? d.wind_speed * 3.6 : null,
        windDirDeg: d.wind_deg,
        condition: dw.main || "unknown",
        icon: OWM_ICON_MAP[dw.icon] || "cloudy",
        sunrise: d.sunrise ? new Date(d.sunrise * 1000).toISOString() : null,
        sunset: d.sunset ? new Date(d.sunset * 1000).toISOString() : null,
      };
    }),
    alerts: (json.alerts || []).map((a) => ({ level: "warning", label: a.event, reason: a.description })),
  };
}

const WMO_ICON_MAP = {
  0: "clear", 1: "mostly-clear", 2: "partly-cloudy", 3: "overcast",
  45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle",
  56: "sleet", 57: "sleet",
  61: "rain", 63: "rain", 65: "rain",
  66: "sleet", 67: "sleet",
  71: "snow", 73: "snow", 75: "snow", 77: "snow",
  80: "rain", 81: "rain", 82: "rain",
  85: "snow", 86: "snow",
  95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
};

function wmoIcon(code, isDay) {
  const base = WMO_ICON_MAP[code] || "cloudy";
  if (base === "clear") return isDay ? "clear-day" : "clear-night";
  if (base === "mostly-clear" || base === "partly-cloudy") {
    return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  }
  return base;
}

/** Normalize an Open-Meteo `/v1/forecast` response (current+hourly+daily requested). */
function fromOpenMeteo(json) {
  const cur = json.current || {};
  const hourly = json.hourly || {};
  const daily = json.daily || {};
  const hourlyRows = (hourly.time || []).map((t, i) => ({
    time: new Date(t).toISOString(),
    tempC: hourly.temperature_2m ? hourly.temperature_2m[i] : null,
    precipMm: hourly.precipitation ? hourly.precipitation[i] : 0,
    precipProbPct: hourly.precipitation_probability ? hourly.precipitation_probability[i] : null,
    windKmh: hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null,
    windDirDeg: hourly.wind_direction_10m ? hourly.wind_direction_10m[i] : null,
    condition: hourly.weather_code ? String(hourly.weather_code[i]) : "unknown",
    icon: hourly.weather_code ? wmoIcon(hourly.weather_code[i], hourly.is_day ? hourly.is_day[i] === 1 : true) : "cloudy",
  }));
  const dailyRows = (daily.time || []).map((t, i) => ({
    date: new Date(t).toISOString(),
    tempMinC: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
    tempMaxC: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
    precipMm: daily.precipitation_sum ? daily.precipitation_sum[i] : 0,
    precipProbPct: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
    windKmh: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[i] : null,
    windDirDeg: daily.wind_direction_10m_dominant ? daily.wind_direction_10m_dominant[i] : null,
    condition: daily.weather_code ? String(daily.weather_code[i]) : "unknown",
    icon: daily.weather_code ? wmoIcon(daily.weather_code[i], true) : "cloudy",
    sunrise: daily.sunrise ? new Date(daily.sunrise[i]).toISOString() : null,
    sunset: daily.sunset ? new Date(daily.sunset[i]).toISOString() : null,
  }));
  const isDay = cur.is_day != null ? cur.is_day === 1 : true;
  return {
    updatedAt: new Date().toISOString(),
    source: "openmeteo",
    location: { name: null, lat: json.latitude, lon: json.longitude },
    current: {
      tempC: cur.temperature_2m,
      feelsLikeC: cur.apparent_temperature,
      humidityPct: cur.relative_humidity_2m,
      dewPointC: computeDewPointC(cur.temperature_2m, cur.relative_humidity_2m),
      pressureHpa: cur.surface_pressure ?? cur.pressure_msl,
      windKmh: cur.wind_speed_10m,
      windGustKmh: cur.wind_gusts_10m,
      windDirDeg: cur.wind_direction_10m,
      uvIndex: hourly.uv_index ? hourly.uv_index[0] : null,
      cloudPct: cur.cloud_cover,
      visibilityKm: null,
      precipMm: cur.precipitation,
      soilTempC: cur.soil_temperature_0cm,
      rainRateMmh: cur.rain,
      condition: cur.weather_code != null ? String(cur.weather_code) : "unknown",
      icon: cur.weather_code != null ? wmoIcon(cur.weather_code, isDay) : "cloudy",
      isDay,
      sunrise: dailyRows[0] ? dailyRows[0].sunrise : null,
      sunset: dailyRows[0] ? dailyRows[0].sunset : null,
    },
    hourly: hourlyRows,
    daily: dailyRows,
    alerts: [],
  };
}

const HA_CONDITION_ICON = {
  "clear-night": "clear-night", sunny: "clear-day", cloudy: "cloudy",
  partlycloudy: "partly-cloudy-day", rainy: "rain", pouring: "rain",
  snowy: "snow", "snowy-rainy": "sleet", fog: "fog", windy: "cloudy",
  "windy-variant": "cloudy", lightning: "thunderstorm", "lightning-rainy": "thunderstorm",
  hail: "sleet", exceptional: "cloudy",
};

/**
 * Normalize a Home Assistant `weather.*` entity + its forecast list into
 * canonical shape. `entity` is the entity's {state, attributes}; `forecast`
 * is the array returned by `weather.get_forecasts` (hourly or daily type).
 * `extra` optionally overlays supplemental readings (soilTempC, uvIndex,
 * rainRateMmh, ...) from sensors the base weather entity doesn't report.
 */
function fromHaWeather(entity, { hourlyForecast = [], dailyForecast = [], extra = {} } = {}) {
  const a = entity.attributes || {};
  const isDay = entity.state !== "clear-night" && entity.state !== "cloudy-night";

  const tempUnit = HA_TEMP_UNIT_MAP[a.temperature_unit];
  const pressureUnit = HA_PRESSURE_UNIT_MAP[a.pressure_unit];
  const speedUnit = HA_SPEED_UNIT_MAP[a.wind_speed_unit];
  const visibilityUnit = HA_LENGTH_LARGE_UNIT_MAP[a.visibility_unit];
  const precipUnit = HA_LENGTH_SMALL_UNIT_MAP[a.precipitation_unit];

  const tempC = toBaseHa(a.temperature, "temperature", tempUnit);
  const feelsLikeC = toBaseHa(a.apparent_temperature, "temperature", tempUnit) ?? tempC;
  const dewPointC = toBaseHa(a.dew_point, "temperature", tempUnit) ?? computeDewPointC(tempC, a.humidity);

  const current = {
    tempC,
    feelsLikeC,
    humidityPct: a.humidity,
    dewPointC,
    pressureHpa: toBaseHa(a.pressure, "pressure", pressureUnit),
    windKmh: toBaseHa(a.wind_speed, "speed", speedUnit),
    windGustKmh: toBaseHa(a.wind_gust_speed, "speed", speedUnit),
    windDirDeg: a.wind_bearing,
    uvIndex: a.uv_index,
    cloudPct: a.cloud_coverage,
    visibilityKm: toBaseHa(a.visibility, "lengthLarge", visibilityUnit),
    precipMm: toBaseHa(a.precipitation, "lengthSmall", precipUnit),
    soilTempC: null,
    rainRateMmh: null,
    condition: entity.state,
    icon: HA_CONDITION_ICON[entity.state] || "cloudy",
    isDay,
    sunrise: null,
    sunset: null,
  };
  for (const [k, v] of Object.entries(extra)) {
    if (v !== null && v !== undefined) current[k] = v;
  }
  return {
    updatedAt: new Date().toISOString(),
    source: "homeassistant",
    location: { name: a.friendly_name || null, lat: null, lon: null },
    current,
    hourly: hourlyForecast.map((f) => ({
      time: f.datetime,
      tempC: toBaseHa(f.temperature, "temperature", tempUnit),
      precipMm: toBaseHa(f.precipitation, "lengthSmall", precipUnit) || 0,
      precipProbPct: f.precipitation_probability ?? null,
      windKmh: toBaseHa(f.wind_speed, "speed", speedUnit),
      windDirDeg: f.wind_bearing,
      condition: f.condition,
      icon: HA_CONDITION_ICON[f.condition] || "cloudy",
    })),
    daily: dailyForecast.map((f) => ({
      date: f.datetime,
      tempMinC: toBaseHa(f.templow ?? f.temperature, "temperature", tempUnit),
      tempMaxC: toBaseHa(f.temperature, "temperature", tempUnit),
      precipMm: toBaseHa(f.precipitation, "lengthSmall", precipUnit) || 0,
      precipProbPct: f.precipitation_probability ?? null,
      windKmh: toBaseHa(f.wind_speed, "speed", speedUnit),
      windDirDeg: f.wind_bearing,
      condition: f.condition,
      icon: HA_CONDITION_ICON[f.condition] || "cloudy",
      sunrise: null,
      sunset: null,
    })),
    alerts: [],
  };
}

const __exports = { computeDewPointC, fromOpenWeatherMap, fromOpenMeteo, fromHaWeather, wmoIcon };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.state = __exports;
}
})();
