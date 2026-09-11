"""Vendored from core/soilforecast.py by scripts/sync-core.js — do not edit directly."""

from __future__ import annotations

from datetime import datetime, timedelta


def parse_day_bucket_array(raw):
    if raw is None:
        return []
    cleaned = str(raw).strip()
    if cleaned.startswith("["):
        cleaned = cleaned[1:]
    if cleaned.endswith("]"):
        cleaned = cleaned[:-1]
    if not cleaned.strip():
        return []
    out = []
    for part in cleaned.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(float(part))
        except ValueError:
            continue
    return out


def build_soil_forecast(day_values, start_of_day=None, hours_per_day=24):
    start = start_of_day or datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    points = []
    for day_index, values in enumerate(day_values):
        for hour_index, temp_c in enumerate(values):
            ts = start + timedelta(hours=day_index * hours_per_day + hour_index)
            points.append({"time": ts.isoformat(), "tempC": temp_c})
    return points
