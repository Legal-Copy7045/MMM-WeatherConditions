(function () {
/**
 * Icon-font rendering (erikflowers/weather-icons, vendored in vendor/ and
 * custom_components/weather_conditions/www/ by scripts/sync-core.js), the
 * sunrise/sunset arc, and wind direction arrows. Pure string-builders (no
 * DOM), shared by the MM module and the Lovelace card.
 */

const windscale =
  typeof module === "object" && module.exports ? require("./windscale") : window.WeatherCore.windscale;

let _uidSeq = 0;
function uid(prefix) {
  _uidSeq += 1;
  return `${prefix}${_uidSeq}`;
}

// condition key -> weather-icons class (day/night resolved by whichever key
// the caller passes in, e.g. "clear-day" / "clear-night").
const CONDITION_ICON_CLASS = {
  "clear-day": "wi-day-sunny",
  "clear-night": "wi-night-clear",
  "partly-cloudy-day": "wi-day-cloudy",
  "partly-cloudy-night": "wi-night-alt-cloudy",
  cloudy: "wi-cloudy",
  overcast: "wi-cloudy",
  fog: "wi-fog",
  "fog-day": "wi-day-fog",
  "fog-night": "wi-night-fog",
  drizzle: "wi-showers",
  "drizzle-day": "wi-day-showers",
  "drizzle-night": "wi-night-alt-showers",
  rain: "wi-rain",
  "rain-day": "wi-day-rain",
  "rain-night": "wi-night-alt-rain",
  "sleet-day": "wi-day-sleet",
  "sleet-night": "wi-night-alt-sleet",
  sleet: "wi-day-sleet",
  "snow-day": "wi-day-snow",
  "snow-night": "wi-night-alt-snow",
  snow: "wi-day-snow",
  "thunderstorm-day": "wi-day-thunderstorm",
  "thunderstorm-night": "wi-night-alt-thunderstorm",
  thunderstorm: "wi-day-thunderstorm",
  cloud: "wi-cloud",
};

/** Build a condition icon as a `<i class="wi ...">` glyph, sized in px. */
function conditionIconHtml(key, { size = 40, color } = {}) {
  const cls = CONDITION_ICON_CLASS[key] || "wi-cloud"; // weather-icons has no dedicated "unknown" glyph
  const style = `font-size:${size}px;${color ? `color:${color};` : ""}`;
  return `<i class="wi ${cls} wc-icon wc-icon-${key}" style="${style}"></i>`;
}

/** A wind-direction arrow, coloured by the shared wind-speed legend. */
function windArrowHtml(dirDeg, kmh, { size = 20 } = {}) {
  const color = windscale.colorForKmh(kmh);
  const rot = (dirDeg ?? 0) + 180; // meteorological "from" -> arrow points where it blows
  return `<i class="wi wi-wind-default wc-wind-arrow" style="font-size:${size}px;color:${color};display:inline-block;transform:rotate(${rot}deg)"></i>`;
}

/** The horizontal wind-speed legend bar shown under the current-conditions card. */
function windLegendHtml() {
  const l = windscale.legend();
  const ticks = l.ticks
    .map((t) => `<span class="wc-legend-tick" style="color:${t.color}">${t.label}</span>`)
    .join("");
  return `<div class="wc-wind-legend">
    <div class="wc-wind-legend-bar" style="background: linear-gradient(90deg, ${l.gradientCss})"></div>
    <div class="wc-wind-legend-ticks">${ticks}</div>
  </div>`;
}

const MOON_PHASE_LABELS = [
  { max: 0.03, label: "new moon" },
  { max: 0.22, label: "waxing crescent" },
  { max: 0.28, label: "first quarter" },
  { max: 0.47, label: "waxing gibbous" },
  { max: 0.53, label: "full moon" },
  { max: 0.72, label: "waning gibbous" },
  { max: 0.78, label: "last quarter" },
  { max: 0.97, label: "waning crescent" },
  { max: 1.01, label: "new moon" },
];

/** phase: 0 = new moon, 0.5 = full moon, 1 = next new moon (OWM's moon_phase convention). */
function moonPhaseLabel(phase) {
  if (phase == null) return "--";
  const p = ((phase % 1) + 1) % 1;
  const hit = MOON_PHASE_LABELS.find((s) => p <= s.max);
  return hit ? hit.label : "--";
}

// weather-icons ships 28 discrete moon-phase glyphs (wi-moon-new through a
// full waxing/waning cycle). Upstream's own class names have an inconsistent
// spelling: "waxing-cresent" (missing a 'c') vs the correctly-spelled
// "waning-crescent" -- preserved here exactly as-is since these are the
// literal CSS class names shipped in weather-icons.css.
const MOON_PHASE_CLASSES = [
  "wi-moon-new",
  "wi-moon-waxing-cresent-1",
  "wi-moon-waxing-cresent-2",
  "wi-moon-waxing-cresent-3",
  "wi-moon-waxing-cresent-4",
  "wi-moon-waxing-cresent-5",
  "wi-moon-waxing-cresent-6",
  "wi-moon-first-quarter",
  "wi-moon-waxing-gibbous-1",
  "wi-moon-waxing-gibbous-2",
  "wi-moon-waxing-gibbous-3",
  "wi-moon-waxing-gibbous-4",
  "wi-moon-waxing-gibbous-5",
  "wi-moon-waxing-gibbous-6",
  "wi-moon-full",
  "wi-moon-waning-gibbous-1",
  "wi-moon-waning-gibbous-2",
  "wi-moon-waning-gibbous-3",
  "wi-moon-waning-gibbous-4",
  "wi-moon-waning-gibbous-5",
  "wi-moon-waning-gibbous-6",
  "wi-moon-3rd-quarter",
  "wi-moon-waning-crescent-1",
  "wi-moon-waning-crescent-2",
  "wi-moon-waning-crescent-3",
  "wi-moon-waning-crescent-4",
  "wi-moon-waning-crescent-5",
  "wi-moon-waning-crescent-6",
];

/** Map OWM's 0..1 moon_phase fraction onto one of the 28 discrete phase glyphs. */
function moonPhaseClass(phase) {
  if (phase == null) return "wi-na";
  const p = ((phase % 1) + 1) % 1;
  const idx = Math.round(p * MOON_PHASE_CLASSES.length) % MOON_PHASE_CLASSES.length;
  return MOON_PHASE_CLASSES[idx];
}

function moonPhaseHtml(phase, { size = 24 } = {}) {
  if (phase == null) return "";
  return `<i class="wi ${moonPhaseClass(phase)} wc-moon-icon" style="font-size:${size}px"></i>`;
}

function uvDescriptor(index) {
  if (index == null) return { label: "--", color: "#8aa" };
  if (index < 3) return { label: "low", color: "#8bd346" };
  if (index < 6) return { label: "moderate", color: "#f4c542" };
  if (index < 8) return { label: "high", color: "#f2733c" };
  if (index < 11) return { label: "very high", color: "#e0479e" };
  return { label: "extreme", color: "#b23bd1" };
}

/**
 * Sunrise/sunset arc with a marker for the sun's current position along it.
 * The curve itself stays an inline SVG (a smooth bezier is awkward to fake
 * with icon glyphs), but the sunrise/sunset endpoint markers are now the
 * `wi-sunrise`/`wi-sunset` icon-font glyphs, absolutely positioned over the
 * SVG rather than drawn as SVG shapes. Returns an HTML string; empty if
 * sunrise/sunset are unknown.
 */
function sunArcHtml({ sunrise, sunset, now = new Date(), width = 260, height = 84, timeFmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }) {
  if (!sunrise || !sunset) return "";
  const t0 = new Date(sunrise).getTime();
  const t1 = new Date(sunset).getTime();
  const t = now.getTime();
  const frac = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const pad = 22;
  const x0 = pad;
  const x1 = width - pad;
  const yBase = height - 22;
  const yTop = 10;
  const midX = (x0 + x1) / 2;
  // Quadratic bezier: P(u) = (1-u)^2 P0 + 2(1-u)u C + u^2 P2
  const bezierPoint = (u) => {
    const mt = 1 - u;
    const x = mt * mt * x0 + 2 * mt * u * midX + u * u * x1;
    const y = mt * mt * yBase + 2 * mt * u * yTop + u * u * yBase;
    return { x, y };
  };
  const marker = bezierPoint(frac);
  const isUp = t >= t0 && t <= t1;
  const id = uid("sunarc");
  const iconSize = 16;
  const svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" class="wc-sunarc">
    <line x1="${x0}" y1="${yBase}" x2="${x1}" y2="${yBase}" stroke="#3a4258" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="M ${x0} ${yBase} Q ${midX} ${yTop} ${x1} ${yBase}" fill="none" stroke="#f4c542" stroke-width="2"/>
    ${isUp ? `<circle cx="${marker.x.toFixed(1)}" cy="${marker.y.toFixed(1)}" r="5" fill="#f4c542" id="${id}"/>` : ""}
    <text x="${x0}" y="${height - 4}" font-size="11" fill="#c7cede" text-anchor="start">${timeFmt(new Date(sunrise))}</text>
    <text x="${x1}" y="${height - 4}" font-size="11" fill="#c7cede" text-anchor="end">${timeFmt(new Date(sunset))}</text>
  </svg>`;
  return `<div class="wc-sunarc-inner" style="position:relative;width:100%;max-width:${width}px;margin:0 auto">
    ${svg}
    <i class="wi wi-sunrise" style="position:absolute;left:${x0 - iconSize / 2}px;top:${yBase - iconSize - 2}px;font-size:${iconSize}px;color:#f4c542"></i>
    <i class="wi wi-sunset" style="position:absolute;left:${x1 - iconSize / 2}px;top:${yBase - iconSize - 2}px;font-size:${iconSize}px;color:#8b93a8"></i>
  </div>`;
}

const __exports = {
  conditionIconHtml,
  windArrowHtml,
  windLegendHtml,
  uvDescriptor,
  sunArcHtml,
  moonPhaseLabel,
  moonPhaseHtml,
};
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.visuals = __exports;
}
})();
