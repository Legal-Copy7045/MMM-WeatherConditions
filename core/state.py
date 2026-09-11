"""Canonical weather state + normalizers. Python port of state.js — keep in sync.

Used by the HA integration to normalize its own weather.* entity into the
same shape node_helper.js / ha_source.js expect on the MM side.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

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


def compute_dew_point_c(temp_c, humidity_pct):
    if temp_c is None or humidity_pct is None or humidity_pct <= 0:
        return None
    a, b = 17.62, 243.12
    gamma = (a * temp_c) / (b + temp_c) + math.log(humidity_pct / 100)
    return (b * gamma) / (a - gamma)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


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
    temp_c = a.get("temperature")
    humidity = a.get("humidity")

    def hourly_row(f):
        cond = f.get("condition")
        return {
            "time": f.get("datetime"),
            "tempC": f.get("temperature"),
            "precipMm": f.get("precipitation") or 0,
            "precipProbPct": f.get("precipitation_probability"),
            "windKmh": f.get("wind_speed"),
            "windDirDeg": f.get("wind_bearing"),
            "condition": cond,
            "icon": HA_CONDITION_ICON.get(cond, "cloudy"),
        }

    def daily_row(f):
        cond = f.get("condition")
        return {
            "date": f.get("datetime"),
            "tempMinC": f.get("templow", f.get("temperature")),
            "tempMaxC": f.get("temperature"),
            "precipMm": f.get("precipitation") or 0,
            "precipProbPct": f.get("precipitation_probability"),
            "windKmh": f.get("wind_speed"),
            "windDirDeg": f.get("wind_bearing"),
            "condition": cond,
            "icon": HA_CONDITION_ICON.get(cond, "cloudy"),
            "sunrise": None,
            "sunset": None,
        }

    current = {
        "tempC": temp_c,
        "feelsLikeC": a.get("apparent_temperature", temp_c),
        "humidityPct": humidity,
        "dewPointC": a.get("dew_point", compute_dew_point_c(temp_c, humidity)),
        "pressureHpa": a.get("pressure"),
        "windKmh": a.get("wind_speed"),
        "windGustKmh": a.get("wind_gust_speed"),
        "windDirDeg": a.get("wind_bearing"),
        "uvIndex": a.get("uv_index"),
        "cloudPct": a.get("cloud_coverage"),
        "visibilityKm": a.get("visibility"),
        "precipMm": None,
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
