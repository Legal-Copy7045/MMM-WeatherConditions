"""Vendored from core/state.py by scripts/sync-core.js — do not edit directly."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from . import units

HA_CONDITION_ICON = {
    "clear-night": "clear-night",
    "sunny": "clear-day",
    "cloudy": "cloudy",
    "partlycloudy": "partly-cloudy-day",
    "rainy": "rain",
    "pouring": "rain",
    "snowy": "snow",
    "snowy-rainy": "sleet",
    "fog": "fog",
    "windy": "cloudy",
    "windy-variant": "cloudy",
    "lightning": "thunderstorm",
    "lightning-rainy": "thunderstorm",
    "hail": "sleet",
    "exceptional": "cloudy",
}

# HA weather entities report values in whatever unit the entity itself uses
# (its own *_unit attribute) — NOT necessarily our canonical base unit. Map
# HA's unit strings to our unit codes so we can convert with core/units.py.
_TEMP_UNIT_MAP = {"°F": "F", "°C": "C", "K": "K"}
_PRESSURE_UNIT_MAP = {"hPa": "hPa", "mbar": "hPa", "inHg": "inHg", "mmHg": "mmHg", "kPa": "kPa"}
_SPEED_UNIT_MAP = {"mph": "mph", "km/h": "kmh", "kmh": "kmh", "m/s": "ms", "kn": "kn", "kt": "kn"}
_LENGTH_SMALL_UNIT_MAP = {"mm": "mm", "cm": "cm", "in": "in"}
_LENGTH_LARGE_UNIT_MAP = {"km": "km", "mi": "mi"}


def compute_dew_point_c(temp_c, humidity_pct):
    if temp_c is None or humidity_pct is None or humidity_pct <= 0:
        return None
    a, b = 17.62, 243.12
    gamma = (a * temp_c) / (b + temp_c) + math.log(humidity_pct / 100)
    return (b * gamma) / (a - gamma)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _to_base(value, kind, unit_code):
    """Convert `value` (in `unit_code`) to the kind's base unit. Passes
    through unchanged if the value or unit is missing/unrecognized."""
    if value is None or unit_code is None:
        return value
    try:
        return units.to_base(kind, float(value), unit_code)
    except (ValueError, TypeError, KeyError):
        return value


OWM_ICON_MAP = {
    "01d": "clear-day", "01n": "clear-night",
    "02d": "partly-cloudy-day", "02n": "partly-cloudy-night",
    "03d": "cloudy", "03n": "cloudy",
    "04d": "overcast", "04n": "overcast",
    "09d": "drizzle", "09n": "drizzle",
    "10d": "rain", "10n": "rain",
    "11d": "thunderstorm", "11n": "thunderstorm",
    "13d": "snow", "13n": "snow",
    "50d": "fog", "50n": "fog",
}


def _iso(unix_ts):
    if unix_ts is None:
        return None
    return datetime.fromtimestamp(unix_ts, tz=timezone.utc).isoformat()


def from_open_weather_map(payload):
    """Normalize an OpenWeather One Call 3.0 response (`/data/3.0/onecall`).
    Python port of state.js's fromOpenWeatherMap — keep in sync."""
    cur = payload.get("current") or {}
    cur_weather = ((cur.get("weather") or [{}])[0]) or {}
    cur_icon = cur_weather.get("icon")

    def hourly_row(h):
        hw = ((h.get("weather") or [{}])[0]) or {}
        rain = (h.get("rain") or {}).get("1h")
        snow = (h.get("snow") or {}).get("1h")
        pop = h.get("pop")
        return {
            "time": _iso(h.get("dt")),
            "tempC": h.get("temp"),
            "precipMm": rain or snow or 0,
            "precipProbPct": round(pop * 100) if pop is not None else None,
            "windKmh": h.get("wind_speed") * 3.6 if h.get("wind_speed") is not None else None,
            "windDirDeg": h.get("wind_deg"),
            "condition": hw.get("main", "unknown"),
            "icon": OWM_ICON_MAP.get(hw.get("icon"), "cloudy"),
        }

    def daily_row(d):
        dw = ((d.get("weather") or [{}])[0]) or {}
        t = d.get("temp") or {}
        pop = d.get("pop")
        return {
            "date": _iso(d.get("dt")),
            "tempMinC": t.get("min"),
            "tempMaxC": t.get("max"),
            "tempMornC": t.get("morn"),
            "tempDayC": t.get("day"),
            "tempEveC": t.get("eve"),
            "tempNightC": t.get("night"),
            "precipMm": (d.get("rain") or 0) + (d.get("snow") or 0),
            "precipProbPct": round(pop * 100) if pop is not None else None,
            "windKmh": d.get("wind_speed") * 3.6 if d.get("wind_speed") is not None else None,
            "windDirDeg": d.get("wind_deg"),
            "uvIndex": d.get("uvi"),
            "summary": d.get("summary"),
            "moonPhase": d.get("moon_phase"),
            "moonrise": _iso(d.get("moonrise")),
            "moonset": _iso(d.get("moonset")),
            "condition": dw.get("main", "unknown"),
            "icon": OWM_ICON_MAP.get(dw.get("icon"), "cloudy"),
            "sunrise": _iso(d.get("sunrise")),
            "sunset": _iso(d.get("sunset")),
        }

    rain_1h = (cur.get("rain") or {}).get("1h")
    snow_1h = (cur.get("snow") or {}).get("1h")

    return {
        "updatedAt": _iso(cur.get("dt")) or _now_iso(),
        "source": "openweathermap",
        "location": {"name": payload.get("timezone"), "lat": payload.get("lat"), "lon": payload.get("lon")},
        "current": {
            "tempC": cur.get("temp"),
            "feelsLikeC": cur.get("feels_like"),
            "humidityPct": cur.get("humidity"),
            "dewPointC": cur.get("dew_point")
            if cur.get("dew_point") is not None
            else compute_dew_point_c(cur.get("temp"), cur.get("humidity")),
            "pressureHpa": cur.get("pressure"),
            "windKmh": cur.get("wind_speed") * 3.6 if cur.get("wind_speed") is not None else None,
            "windGustKmh": cur.get("wind_gust") * 3.6 if cur.get("wind_gust") is not None else None,
            "windDirDeg": cur.get("wind_deg"),
            "uvIndex": cur.get("uvi"),
            "cloudPct": cur.get("clouds"),
            "visibilityKm": cur.get("visibility") / 1000 if cur.get("visibility") is not None else None,
            "precipMm": rain_1h or snow_1h or 0,
            "soilTempC": None,
            "rainRateMmh": rain_1h or 0,
            "condition": cur_weather.get("main", "unknown"),
            "icon": OWM_ICON_MAP.get(cur_icon, "cloudy"),
            "isDay": cur_icon.endswith("d") if cur_icon else True,
            "sunrise": _iso(cur.get("sunrise")),
            "sunset": _iso(cur.get("sunset")),
        },
        "minutely": [
            {"time": _iso(m.get("dt")), "precipMmh": m.get("precipitation") or 0}
            for m in (payload.get("minutely") or [])
        ],
        "hourly": [hourly_row(h) for h in (payload.get("hourly") or [])],
        "daily": [daily_row(d) for d in (payload.get("daily") or [])],
        "alerts": [
            {"level": "warning", "label": a.get("event"), "reason": a.get("description")}
            for a in (payload.get("alerts") or [])
        ],
    }


def from_ha_weather(entity_state, attributes, hourly_forecast=None, daily_forecast=None, extra=None):
    """entity_state: the weather.* entity's state string.
    attributes: its attributes dict.
    hourly_forecast / daily_forecast: lists from weather.get_forecasts (may be empty).
    extra: optional dict overlaying supplemental readings onto `current`
    (e.g. {"soilTempC": 9.4, "uvIndex": 3, "rainRateMmh": 0.0}) — from
    sensors the base weather entity doesn't report itself."""
    hourly_forecast = hourly_forecast or []
    daily_forecast = daily_forecast or []
    extra = extra or {}
    a = attributes or {}
    is_day = entity_state not in ("clear-night",)

    temp_unit = _TEMP_UNIT_MAP.get(a.get("temperature_unit"))
    pressure_unit = _PRESSURE_UNIT_MAP.get(a.get("pressure_unit"))
    speed_unit = _SPEED_UNIT_MAP.get(a.get("wind_speed_unit"))
    visibility_unit = _LENGTH_LARGE_UNIT_MAP.get(a.get("visibility_unit"))
    precip_unit = _LENGTH_SMALL_UNIT_MAP.get(a.get("precipitation_unit"))

    temp_c = _to_base(a.get("temperature"), "temperature", temp_unit)
    feels_like_c = _to_base(a.get("apparent_temperature"), "temperature", temp_unit)
    if feels_like_c is None:
        feels_like_c = temp_c
    dew_point_c = _to_base(a.get("dew_point"), "temperature", temp_unit)
    humidity = a.get("humidity")
    if dew_point_c is None:
        dew_point_c = compute_dew_point_c(temp_c, humidity)

    def hourly_row(f):
        cond = f.get("condition")
        return {
            "time": f.get("datetime"),
            "tempC": _to_base(f.get("temperature"), "temperature", temp_unit),
            "precipMm": _to_base(f.get("precipitation"), "lengthSmall", precip_unit) or 0,
            "precipProbPct": f.get("precipitation_probability"),
            "windKmh": _to_base(f.get("wind_speed"), "speed", speed_unit),
            "windDirDeg": f.get("wind_bearing"),
            "condition": cond,
            "icon": HA_CONDITION_ICON.get(cond, "cloudy"),
        }

    def daily_row(f):
        cond = f.get("condition")
        templow = f.get("templow", f.get("temperature"))
        return {
            "date": f.get("datetime"),
            "tempMinC": _to_base(templow, "temperature", temp_unit),
            "tempMaxC": _to_base(f.get("temperature"), "temperature", temp_unit),
            "precipMm": _to_base(f.get("precipitation"), "lengthSmall", precip_unit) or 0,
            "precipProbPct": f.get("precipitation_probability"),
            "windKmh": _to_base(f.get("wind_speed"), "speed", speed_unit),
            "windDirDeg": f.get("wind_bearing"),
            "condition": cond,
            "icon": HA_CONDITION_ICON.get(cond, "cloudy"),
            "sunrise": None,
            "sunset": None,
        }

    current = {
        "tempC": temp_c,
        "feelsLikeC": feels_like_c,
        "humidityPct": humidity,
        "dewPointC": dew_point_c,
        "pressureHpa": _to_base(a.get("pressure"), "pressure", pressure_unit),
        "windKmh": _to_base(a.get("wind_speed"), "speed", speed_unit),
        "windGustKmh": _to_base(a.get("wind_gust_speed"), "speed", speed_unit),
        "windDirDeg": a.get("wind_bearing"),
        "uvIndex": a.get("uv_index"),
        "cloudPct": a.get("cloud_coverage"),
        "visibilityKm": _to_base(a.get("visibility"), "lengthLarge", visibility_unit),
        "precipMm": _to_base(a.get("precipitation"), "lengthSmall", precip_unit),
        "soilTempC": None,
        "rainRateMmh": None,
        "condition": entity_state,
        "icon": HA_CONDITION_ICON.get(entity_state, "cloudy"),
        "isDay": is_day,
        "sunrise": None,
        "sunset": None,
    }
    # Supplemental sensors (soil temp, UV, rain rate) overlay the base entity —
    # they take priority since the base weather entity often lacks them.
    for key, value in extra.items():
        if value is not None:
            current[key] = value

    return {
        "updatedAt": _now_iso(),
        "source": "homeassistant",
        "location": {"name": a.get("friendly_name"), "lat": None, "lon": None},
        "current": current,
        "minutely": [],
        "hourly": [hourly_row(f) for f in hourly_forecast],
        "daily": [daily_row(f) for f in daily_forecast],
        "alerts": [],
    }
