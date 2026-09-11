/** Weather alerts: source-provided (e.g. OWM severe alerts) + derived thresholds. */

const CHECK_DEFAULTS = {
  frost: { enabled: true, belowC: 0 },
  heat: { enabled: true, aboveC: 32 },
  wind: { enabled: true, aboveKmh: 60 },
  uv: { enabled: true, atOrAbove: 8 },
};

function deriveAlerts(state, opts = {}) {
  const cfg = {
    frost: { ...CHECK_DEFAULTS.frost, ...(opts.frost || {}) },
    heat: { ...CHECK_DEFAULTS.heat, ...(opts.heat || {}) },
    wind: { ...CHECK_DEFAULTS.wind, ...(opts.wind || {}) },
    uv: { ...CHECK_DEFAULTS.uv, ...(opts.uv || {}) },
  };
  const cur = (state && state.current) || {};
  const out = [...((state && state.alerts) || [])];

  if (cfg.frost.enabled && cur.tempC != null && cur.tempC <= cfg.frost.belowC) {
    out.push({ level: "warning", label: "Frost risk", reason: `Temperature ${cur.tempC.toFixed(1)}°C` });
  }
  if (cfg.heat.enabled && cur.tempC != null && cur.tempC >= cfg.heat.aboveC) {
    out.push({ level: "warning", label: "Heat warning", reason: `Temperature ${cur.tempC.toFixed(1)}°C` });
  }
  if (cfg.wind.enabled && cur.windGustKmh != null && cur.windGustKmh >= cfg.wind.aboveKmh) {
    out.push({ level: "warning", label: "High wind", reason: `Gusts ${cur.windGustKmh.toFixed(0)} km/h` });
  }
  if (cfg.uv.enabled && cur.uvIndex != null && cur.uvIndex >= cfg.uv.atOrAbove) {
    out.push({ level: "warning", label: "High UV", reason: `UV index ${cur.uvIndex}` });
  }
  return out;
}

const __exports = { CHECK_DEFAULTS, deriveAlerts };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.conditions = __exports;
}
