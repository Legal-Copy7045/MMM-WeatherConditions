"""Vendored from core/windscale.py by scripts/sync-core.js — do not edit directly."""

from __future__ import annotations

from .units import kmh_to_beaufort

STOPS = [
    (0, "#dfe7ff"),
    (2, "#7fa8ff"),
    (4, "#37c2b0"),
    (5, "#8bd346"),
    (7, "#f4c542"),
    (9, "#f2733c"),
    (12, "#e0479e"),
]


def _clamp(v, lo, hi):
    return min(hi, max(lo, v))


def _hex_to_rgb(hexstr):
    n = int(hexstr[1:], 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def _rgb_to_hex(rgb):
    return "#" + "".join(f"{_clamp(round(c), 0, 255):02x}" for c in rgb)


def color_for_bft(bft):
    b = _clamp(bft or 0, 0, 12)
    for (a_bft, a_color), (z_bft, z_color) in zip(STOPS, STOPS[1:]):
        if a_bft <= b <= z_bft:
            t = 0 if z_bft == a_bft else (b - a_bft) / (z_bft - a_bft)
            ar, ag, ab = _hex_to_rgb(a_color)
            zr, zg, zb = _hex_to_rgb(z_color)
            return _rgb_to_hex((ar + (zr - ar) * t, ag + (zg - ag) * t, ab + (zb - ab) * t))
    return STOPS[-1][1]


def color_for_kmh(kmh):
    return color_for_bft(kmh_to_beaufort(kmh))
