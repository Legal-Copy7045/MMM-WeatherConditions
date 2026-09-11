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
        "hourly": [hourly_row(f) for f in hourly_forecast],
        "daily": [daily_row(f) for f in daily_forecast],
        "alerts": [],
    }
