/**
 * Unit conversion + formatting. Pure functions, no DOM — shared by the MM
 * module, the Lovelace card, and (via the Python port) the HA integration.
 */

const BFT_UPPER_KMH = [1, 5.5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, Infinity];

function kmhToBeaufort(kmh) {
  if (kmh === null || kmh === undefined) return null;
  for (let b = 0; b < BFT_UPPER_KMH.length; b++) {
    if (kmh < BFT_UPPER_KMH[b]) return b;
  }
  return 12;
}

function beaufortToKmh(bft) {
  if (bft === null || bft === undefined) return null;
  const lower = bft === 0 ? 0 : BFT_UPPER_KMH[bft - 1];
  const upper = BFT_UPPER_KMH[bft] === Infinity ? lower + 15 : BFT_UPPER_KMH[bft];
  return (lower + upper) / 2;
}

const KIND = {
  temperature: {
    base: "C",
    units: {
      C: { label: "°C", from: (c) => c, to: (c) => c },
      F: { label: "°F", from: (c) => (c * 9) / 5 + 32, to: (f) => ((f - 32) * 5) / 9 },
      K: { label: "K", from: (c) => c + 273.15, to: (k) => k - 273.15 },
    },
    decimals: 0,
  },
  pressure: {
    base: "hPa",
    units: {
      hPa: { label: "hPa", from: (h) => h, to: (h) => h },
      inHg: { label: "inHg", from: (h) => h * 0.0295299831, to: (i) => i / 0.0295299831 },
      mmHg: { label: "mmHg", from: (h) => h * 0.750062, to: (m) => m / 0.750062 },
      kPa: { label: "kPa", from: (h) => h / 10, to: (k) => k * 10 },
    },
    decimals: { hPa: 0, mmHg: 0, inHg: 2, kPa: 1 },
  },
  speed: {
    base: "kmh",
    units: {
      kmh: { label: "km/h", from: (k) => k, to: (k) => k },
      mph: { label: "mph", from: (k) => k * 0.621371, to: (m) => m / 0.621371 },
      ms: { label: "m/s", from: (k) => k / 3.6, to: (m) => m * 3.6 },
      kn: { label: "kn", from: (k) => k * 0.539957, to: (n) => n / 0.539957 },
      bft: { label: "Bft", from: kmhToBeaufort, to: beaufortToKmh },
    },
    decimals: { kmh: 0, mph: 0, ms: 1, kn: 0, bft: 0 },
  },
  lengthSmall: {
    base: "mm",
    units: {
      mm: { label: "mm", from: (m) => m, to: (m) => m },
      in: { label: "in", from: (m) => m / 25.4, to: (i) => i * 25.4 },
      cm: { label: "cm", from: (m) => m / 10, to: (c) => c * 10 },
    },
    decimals: { mm: 1, cm: 1, in: 2 },
  },
  lengthLarge: {
    base: "km",
    units: {
      km: { label: "km", from: (k) => k, to: (k) => k },
      mi: { label: "mi", from: (k) => k * 0.621371, to: (m) => m / 0.621371 },
    },
    decimals: 0,
  },
};

function kindOf(name) {
  const kind = KIND[name];
  if (!kind) throw new Error(`Unknown unit kind: ${name}`);
  return kind;
}

/** Convert a value expressed in the kind's base unit into `unit`. */
function fromBase(kindName, baseValue, unit) {
  if (baseValue === null || baseValue === undefined) return null;
  const kind = kindOf(kindName);
  const spec = kind.units[unit];
  if (!spec) throw new Error(`Unknown unit "${unit}" for ${kindName}`);
  return spec.from(baseValue);
}

/** Convert a value expressed in `unit` back into the kind's base unit. */
function toBase(kindName, value, unit) {
  if (value === null || value === undefined) return null;
  const kind = kindOf(kindName);
  const spec = kind.units[unit];
  if (!spec) throw new Error(`Unknown unit "${unit}" for ${kindName}`);
  return spec.to(value);
}

function decimalsFor(kindName, unit) {
  const kind = kindOf(kindName);
  if (typeof kind.decimals === "number") return kind.decimals;
  return kind.decimals[unit] ?? 0;
}

function labelFor(kindName, unit) {
  const kind = kindOf(kindName);
  const spec = kind.units[unit];
  return spec ? spec.label : unit;
}

/** Format a base-unit value directly into a display string in `unit`. */
function format(kindName, baseValue, unit) {
  const v = fromBase(kindName, baseValue, unit);
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  const d = decimalsFor(kindName, unit);
  const label = labelFor(kindName, unit);
  const sep = label.startsWith("°") ? "" : " ";
  return `${v.toFixed(d)}${sep}${label}`;
}

const __exports = {
  KIND,
  kindOf,
  fromBase,
  toBase,
  decimalsFor,
  labelFor,
  format,
  kmhToBeaufort,
  beaufortToKmh,
};
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.units = __exports;
}
