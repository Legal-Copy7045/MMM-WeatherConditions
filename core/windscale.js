(function () {
/**
 * Wind-speed colour legend, shared by the current-conditions arrow, the
 * hourly/daily chart arrows, and the chart's wind-speed line — so one
 * colour means the same wind speed everywhere in the module.
 *
 * Scale runs 0–9+ Beaufort across a fixed colour ramp (blue -> teal ->
 * green -> yellow -> orange -> magenta), matching the legend bar under
 * "Wind Speed" on the current-conditions card.
 */

const units =
  typeof module === "object" && module.exports ? require("./units") : window.WeatherCore.units;
const { kmhToBeaufort } = units;

const STOPS = [
  { bft: 0, color: "#dfe7ff" },
  { bft: 2, color: "#7fa8ff" },
  { bft: 4, color: "#37c2b0" },
  { bft: 5, color: "#8bd346" },
  { bft: 7, color: "#f4c542" },
  { bft: 9, color: "#f2733c" },
  { bft: 12, color: "#e0479e" },
];

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const c = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Colour for a Beaufort force (fractional allowed), interpolated across STOPS. */
function colorForBft(bft) {
  const b = clamp(bft ?? 0, 0, 12);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const z = STOPS[i + 1];
    if (b >= a.bft && b <= z.bft) {
      const t = z.bft === a.bft ? 0 : (b - a.bft) / (z.bft - a.bft);
      return rgbToHex(hexToRgb(a.color).map((c, idx) => lerp(c, hexToRgb(z.color)[idx], t)));
    }
  }
  return STOPS[STOPS.length - 1].color;
}

/** Colour for a wind speed given in km/h. */
function colorForKmh(kmh) {
  return colorForBft(kmhToBeaufort(kmh));
}

/** CSS linear-gradient stop list for the legend bar, and its tick labels. */
function legend() {
  return {
    gradientCss: STOPS.map((s) => `${s.color} ${(s.bft / 12) * 100}%`).join(", "),
    ticks: [0, 2, 4, 5, 7, 9].map((bft) => ({ bft, label: bft === 9 ? "9+" : String(bft), color: colorForBft(bft) })),
  };
}

const __exports = { colorForBft, colorForKmh, legend, STOPS };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.windscale = __exports;
}
})();
