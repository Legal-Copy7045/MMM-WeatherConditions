"""Vendored from core/conditions.py by scripts/sync-core.js — do not edit directly."""

from __future__ import annotations

CHECK_DEFAULTS = {
    "frost": {"enabled": True, "below_c": 0},
    "heat": {"enabled": True, "above_c": 32},
    "wind": {"enabled": True, "above_kmh": 60},
    "uv": {"enabled": True, "at_or_above": 8},
}


def derive_alerts(state, opts=None):
    opts = opts or {}
    cfg = {k: {**v, **opts.get(k, {})} for k, v in CHECK_DEFAULTS.items()}
    cur = (state or {}).get("current", {}) or {}
    out = list((state or {}).get("alerts", []) or [])

    temp_c = cur.get("tempC")
    if cfg["frost"]["enabled"] and temp_c is not None and temp_c <= cfg["frost"]["below_c"]:
        out.append({"level": "warning", "label": "Frost risk", "reason": f"Temperature {temp_c:.1f}°C"})
    if cfg["heat"]["enabled"] and temp_c is not None and temp_c >= cfg["heat"]["above_c"]:
        out.append({"level": "warning", "label": "Heat warning", "reason": f"Temperature {temp_c:.1f}°C"})

    gust = cur.get("windGustKmh")
    if cfg["wind"]["enabled"] and gust is not None and gust >= cfg["wind"]["above_kmh"]:
        out.append({"level": "warning", "label": "High wind", "reason": f"Gusts {gust:.0f} km/h"})

    uv = cur.get("uvIndex")
    if cfg["uv"]["enabled"] and uv is not None and uv >= cfg["uv"]["at_or_above"]:
        out.append({"level": "warning", "label": "High UV", "reason": f"UV index {uv}"})

    return out
