(function () {
/**
 * SVG rendering: condition icons, the sunrise/sunset arc, and wind
 * direction arrows. Pure string-builders (no DOM), shared by the MM
 * module and the Lovelace card.
 */

const windscale =
  typeof module === "object" && module.exports ? require("./windscale") : window.WeatherCore.windscale;

let _uidSeq = 0;
function uid(prefix) {
  _uidSeq += 1;
  return `${prefix}${_uidSeq}`;
}

function sunGlyph(cx, cy, r, color = "#f4c542") {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x1 = cx + Math.cos(a) * (r + 3);
    const y1 = cy + Math.sin(a) * (r + 3);
    const x2 = cx + Math.cos(a) * (r + 7);
    const y2 = cy + Math.sin(a) * (r + 7);
    rays.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`);
  }
  return `<g>${rays.join("")}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/></g>`;
}

function moonGlyph(cx, cy, r, color = "#cfd8ea") {
  return `<path d="M ${cx - r * 0.4} ${cy - r} A ${r} ${r} 0 1 0 ${cx - r * 0.4} ${cy + r} A ${r * 0.75} ${r * 0.75} 0 1 1 ${cx - r * 0.4} ${cy - r} Z" fill="${color}"/>`;
}

function cloudGlyph(cx, cy, scale = 1, color = "#aab4c8") {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})"><path d="M -18 6 a 9 9 0 0 1 3 -17.6 a 12 12 0 0 1 22.6 -4 a 10 10 0 0 1 1.4 21.6 Z" fill="${color}"/></g>`;
}

function rainGlyph(cx, cy, color = "#5aa7ff") {
  const drops = [-10, 0, 10].map(
    (dx) => `<line x1="${cx + dx}" y1="${cy}" x2="${cx + dx - 3}" y2="${cy + 9}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`
  );
  return `<g>${drops.join("")}</g>`;
}

function snowGlyph(cx, cy, color = "#d8e6ff") {
  const flakes = [-10, 0, 10].map((dx) => `<circle cx="${cx + dx}" cy="${cy + 5}" r="1.8" fill="${color}"/>`);
  return `<g>${flakes.join("")}</g>`;
}

function boltGlyph(cx, cy, color = "#f4c542") {
  return `<path d="M ${cx - 2} ${cy - 2} L ${cx - 8} ${cy + 8} L ${cx - 1} ${cy + 8} L ${cx - 5} ${cy + 16} L ${cx + 9} ${cy + 3} L ${cx + 1} ${cy + 3} Z" fill="${color}"/>`;
}

function fogGlyph(cx, cy, color = "#b7c0d1") {
  const lines = [-2, 4, 10].map(
    (dy) => `<line x1="${cx - 14}" y1="${cy + dy}" x2="${cx + 14}" y2="${cy + dy}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`
  );
  return `<g>${lines.join("")}</g>`;
}

/** Build a self-contained condition icon as an inline SVG string. */
function iconSvg(key, { size = 40 } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  const parts = [];
  const hasCloud = /cloud|overcast|drizzle|rain|sleet|snow|thunderstorm|fog/.test(key);
  const skyR = size * 0.18;
  if (key === "clear-day") parts.push(sunGlyph(cx, cy, skyR));
  else if (key === "clear-night") parts.push(moonGlyph(cx, cy, skyR));
  else if (key === "partly-cloudy-day") {
    parts.push(sunGlyph(cx - size * 0.14, cy - size * 0.12, skyR * 0.85));
    parts.push(cloudGlyph(cx + size * 0.08, cy + size * 0.08, size / 42));
  } else if (key === "partly-cloudy-night") {
    parts.push(moonGlyph(cx - size * 0.14, cy - size * 0.12, skyR * 0.85));
    parts.push(cloudGlyph(cx + size * 0.08, cy + size * 0.08, size / 42));
  } else if (hasCloud) {
    parts.push(cloudGlyph(cx, cy - size * 0.06, size / 38));
  }
  if (key === "fog") parts.push(fogGlyph(cx, cy + size * 0.2));
  if (key === "drizzle" || key === "rain") parts.push(rainGlyph(cx, cy + size * 0.16));
  if (key === "sleet") {
    parts.push(rainGlyph(cx - 5, cy + size * 0.16));
    parts.push(snowGlyph(cx + 5, cy + size * 0.2));
  }
  if (key === "snow") parts.push(snowGlyph(cx, cy + size * 0.2));
  if (key === "thunderstorm") parts.push(boltGlyph(cx, cy + size * 0.12));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="wc-icon wc-icon-${key}">${parts.join("")}</svg>`;
}

/** A wind-direction arrow, coloured by the shared wind-speed legend. */
function windArrowSvg(dirDeg, kmh, { size = 20 } = {}) {
  const color = windscale.colorForKmh(kmh);
  const rot = (dirDeg ?? 0) + 180; // meteorological "from" -> arrow points where it blows
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="wc-wind-arrow" style="transform: rotate(${rot}deg)">
    <path d="M12 2 L18 14 L12 10.5 L6 14 Z" fill="${color}"/>
  </svg>`;
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
 * Returns an SVG string; hidden gracefully if sunrise/sunset are unknown.
 */
function sunArcSvg({ sunrise, sunset, now = new Date(), width = 260, height = 84, timeFmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }) {
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
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" class="wc-sunarc">
    <line x1="${x0}" y1="${yBase}" x2="${x1}" y2="${yBase}" stroke="#3a4258" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="M ${x0} ${yBase} Q ${midX} ${yTop} ${x1} ${yBase}" fill="none" stroke="#f4c542" stroke-width="2"/>
    ${isUp ? `<circle cx="${marker.x.toFixed(1)}" cy="${marker.y.toFixed(1)}" r="5" fill="#f4c542" id="${id}"/>` : ""}
    <text x="${x0}" y="${height - 4}" font-size="11" fill="#c7cede" text-anchor="start">${timeFmt(new Date(sunrise))}</text>
    <text x="${x1}" y="${height - 4}" font-size="11" fill="#c7cede" text-anchor="end">${timeFmt(new Date(sunset))}</text>
  </svg>`;
}

const __exports = { iconSvg, windArrowSvg, windLegendHtml, uvDescriptor, sunArcSvg };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.visuals = __exports;
}
})();
