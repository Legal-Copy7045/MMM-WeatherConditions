"""Vendored from core/units.py by scripts/sync-core.js — do not edit directly."""

from __future__ import annotations

import math

BFT_UPPER_KMH = [1, 5.5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, math.inf]


def kmh_to_beaufort(kmh):
    if kmh is None:
        return None
    for b, upper in enumerate(BFT_UPPER_KMH):
        if kmh < upper:
            return b
    return 12


def beaufort_to_kmh(bft):
    if bft is None:
        return None
    lower = 0 if bft == 0 else BFT_UPPER_KMH[bft - 1]
    upper = lower + 15 if BFT_UPPER_KMH[bft] == math.inf else BFT_UPPER_KMH[bft]
    return (lower + upper) / 2


KIND = {
    "temperature": {
        "base": "C",
        "units": {
            "C": {"label": "°C", "from": lambda c: c, "to": lambda c: c},
            "F": {"label": "°F", "from": lambda c: c * 9 / 5 + 32, "to": lambda f: (f - 32) * 5 / 9},
            "K": {"label": "K", "from": lambda c: c + 273.15, "to": lambda k: k - 273.15},
        },
        "decimals": 0,
    },
    "pressure": {
        "base": "hPa",
        "units": {
            "hPa": {"label": "hPa", "from": lambda h: h, "to": lambda h: h},
            "inHg": {"label": "inHg", "from": lambda h: h * 0.0295299831, "to": lambda i: i / 0.0295299831},
            "mmHg": {"label": "mmHg", "from": lambda h: h * 0.750062, "to": lambda m: m / 0.750062},
            "kPa": {"label": "kPa", "from": lambda h: h / 10, "to": lambda k: k * 10},
        },
        "decimals": {"hPa": 0, "mmHg": 0, "inHg": 2, "kPa": 1},
    },
    "speed": {
        "base": "kmh",
        "units": {
            "kmh": {"label": "km/h", "from": lambda k: k, "to": lambda k: k},
            "mph": {"label": "mph", "from": lambda k: k * 0.621371, "to": lambda m: m / 0.621371},
            "ms": {"label": "m/s", "from": lambda k: k / 3.6, "to": lambda m: m * 3.6},
            "kn": {"label": "kn", "from": lambda k: k * 0.539957, "to": lambda n: n / 0.539957},
            "bft": {"label": "Bft", "from": kmh_to_beaufort, "to": beaufort_to_kmh},
        },
        "decimals": {"kmh": 0, "mph": 0, "ms": 1, "kn": 0, "bft": 0},
    },
    "lengthSmall": {
        "base": "mm",
        "units": {
            "mm": {"label": "mm", "from": lambda m: m, "to": lambda m: m},
            "in": {"label": "in", "from": lambda m: m / 25.4, "to": lambda i: i * 25.4},
            "cm": {"label": "cm", "from": lambda m: m / 10, "to": lambda c: c * 10},
        },
        "decimals": {"mm": 1, "cm": 1, "in": 2},
    },
    "lengthLarge": {
        "base": "km",
        "units": {
            "km": {"label": "km", "from": lambda k: k, "to": lambda k: k},
            "mi": {"label": "mi", "from": lambda k: k * 0.621371, "to": lambda m: m / 0.621371},
        },
        "decimals": 0,
    },
}


def _kind(name):
    kind = KIND.get(name)
    if kind is None:
        raise ValueError(f"Unknown unit kind: {name}")
    return kind


def from_base(kind_name, base_value, unit):
    if base_value is None:
        return None
    kind = _kind(kind_name)
    spec = kind["units"].get(unit)
    if spec is None:
        raise ValueError(f'Unknown unit "{unit}" for {kind_name}')
    return spec["from"](base_value)


def to_base(kind_name, value, unit):
    if value is None:
        return None
    kind = _kind(kind_name)
    spec = kind["units"].get(unit)
    if spec is None:
        raise ValueError(f'Unknown unit "{unit}" for {kind_name}')
    return spec["to"](value)


def decimals_for(kind_name, unit):
    kind = _kind(kind_name)
    d = kind["decimals"]
    if isinstance(d, int):
        return d
    return d.get(unit, 0)


def label_for(kind_name, unit):
    kind = _kind(kind_name)
    spec = kind["units"].get(unit)
    return spec["label"] if spec else unit


def format_value(kind_name, base_value, unit):
    v = from_base(kind_name, base_value, unit)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "--"
    d = decimals_for(kind_name, unit)
    label = label_for(kind_name, unit)
    sep = "" if label.startswith("°") else " "
    return f"{v:.{d}f}{sep}{label}"
