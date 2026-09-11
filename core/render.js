(function () {
/**
 * HTML-string builders for each card, shared by the MM module and the
 * Lovelace card so the layout only exists in one place. Pure functions:
 * no DOM lookups, no Chart.js — callers insert the markup then wire up
 * canvases/unit-cycling themselves (each host has a different DOM/shadow
 * root to attach to).
 */

const deps = (() => {
  if (typeof module === "object" && module.exports) {
    return {
      units: require("./units"),
      windscale: require("./windscale"),
      visuals: require("./visuals"),
      unitcycle: require("./unitcycle"),
    };
  }
  return {
    units: window.WeatherCore.units,
    windscale: window.WeatherCore.windscale,
    visuals: window.WeatherCore.visuals,
    unitcycle: window.WeatherCore.unitcycle,
  };
})();
const { units, visuals, unitcycle } = deps;

function unitKindFor(kind) {
  if (kind === "wind") return "speed";
  if (kind === "precipitation") return "lengthSmall";
  if (kind === "visibility") return "lengthLarge";
  return kind; // temperature, pressure
}

function cyclingValue(unitsConfig, id, kind, baseValue) {
  const cfg = unitsConfig[kind] || { list: ["C"] };
  return unitcycle.unitCycleHtml(id, unitKindFor(kind), baseValue, cfg.list);
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function defaultFmt(iso, opts, locale) {
  try {
    return new Date(iso).toLocaleString(locale || undefined, opts);
  } catch (e) {
    return String(iso);
  }
}

function currentCardHtml(state, config, fmt = defaultFmt) {
  const cur = state.current || {};
  const today = (state.daily || [])[0] || {};
  const icon = visuals.iconSvg(cur.icon, { size: 64 });
  const uv = visuals.uvDescriptor(cur.uvIndex);
  const uc = (id, kind, val) => cyclingValue(config.units, id, kind, val);

  return `
    <div class="wc-card wc-current">
      <div class="wc-current-main">
        <div class="wc-current-icon">${icon}</div>
        <div class="wc-current-temp">${uc("wc-temp-now", "temperature", cur.tempC)}</div>
        <div class="wc-current-cond">
          <div class="wc-cond-text">${escapeHtml(cur.condition || "")}</div>
          <div class="wc-feelslike wc-dimmed">Feels like ${uc("wc-temp-feels", "temperature", cur.feelsLikeC)}</div>
        </div>
      </div>
      ${today.summary ? `<div class="wc-summary wc-dimmed">${escapeHtml(today.summary)}</div>` : ""}
      <div class="wc-current-stats">
        <div class="wc-stat">
          <span class="wc-stat-label">Humidity</span>
          <span class="wc-stat-value">${cur.humidityPct != null ? Math.round(cur.humidityPct) + "%" : "--"}</span>
          <span class="wc-stat-sub wc-dimmed">Dew point ${uc("wc-dewpoint", "temperature", cur.dewPointC)}</span>
        </div>
        <div class="wc-stat">
          <span class="wc-stat-label">Pressure</span>
          <span class="wc-stat-value">${uc("wc-pressure", "pressure", cur.pressureHpa)}</span>
        </div>
        <div class="wc-stat">
          <span class="wc-stat-label">Wind</span>
          <span class="wc-stat-value">${visuals.windArrowSvg(cur.windDirDeg, cur.windKmh, { size: 16 })} ${uc("wc-wind", "wind", cur.windKmh)}</span>
          ${cur.windGustKmh != null ? `<span class="wc-stat-sub wc-dimmed">Gusts ${uc("wc-gust", "wind", cur.windGustKmh)}</span>` : ""}
        </div>
        <div class="wc-stat">
          <span class="wc-stat-label">UV Index</span>
          <span class="wc-stat-value" style="color:${uv.color}">${cur.uvIndex != null ? Math.round(cur.uvIndex) : "--"} (${uv.label})</span>
        </div>
        ${
          today.moonPhase != null
            ? `<div class="wc-stat"><span class="wc-stat-label">Moon</span><span class="wc-stat-value">${visuals.moonPhaseSvg(today.moonPhase, { size: 16 })} ${visuals.moonPhaseLabel(today.moonPhase)}</span></div>`
            : ""
        }
        ${
          cur.soilTempC != null
            ? `<div class="wc-stat"><span class="wc-stat-label">Soil temp</span><span class="wc-stat-value">${uc("wc-soiltemp", "temperature", cur.soilTempC)}</span></div>`
            : ""
        }
      </div>
      <div class="wc-sunarc-wrap">${visuals.sunArcSvg({ sunrise: cur.sunrise, sunset: cur.sunset })}</div>
      ${visuals.windLegendHtml()}
    </div>
  `;
}

function forecastHeadsHtml(rows, config, timeOpts, fmt) {
  return rows
    .map((r) => {
      const t = fmt(r.time || r.date, timeOpts, config.locale);
      return `<div class="wc-hcol">
        <div class="wc-hcol-time wc-dimmed">${t}</div>
        <div class="wc-hcol-icon">${visuals.iconSvg(r.icon, { size: 28 })}</div>
        <div class="wc-hcol-wind">${visuals.windArrowSvg(r.windDirDeg, r.windKmh, { size: 14 })} <span>${units.format("speed", r.windKmh, config.units.wind.list[0])}</span></div>
      </div>`;
    })
    .join("");
}

function hourlyCardHtml(state, config, fmt = defaultFmt) {
  const step = Math.max(1, config.hourlyStepHours || 1);
  const rows = (state.hourly || []).filter((_, i) => i % step === 0).slice(0, config.hourlyPoints || 5);
  const heads = forecastHeadsHtml(rows, config, { hour: "numeric" }, fmt);
  return `
    <div class="wc-card wc-hourly">
      <div class="wc-card-title">Hourly Forecast</div>
      <div class="wc-hourly-heads">${heads}</div>
      <div class="wc-chart-wrap"><canvas id="wc-hourly-chart" height="90"></canvas></div>
    </div>
  `;
}

/**
 * The Daily Forecast card alternates its chart between the day-by-day
 * temperature+precip view and a multi-day soil-temperature view (when soil
 * forecast data is configured) -- both sections are always in the markup;
 * the frontend toggles which is `hidden` and (re)instantiates whichever
 * chart is currently visible on a timer, same pattern as the unit cycling.
 */
function dailyCardHtml(state, config, fmt = defaultFmt) {
  const rows = (state.daily || []).slice(0, config.dailyDays || 5);
  const heads = forecastHeadsHtml(rows, config, { weekday: "short" }, fmt);
  const hasSoil = config.cards && config.cards.soilForecast && state.soilForecast && state.soilForecast.length;
  return `
    <div class="wc-card wc-daily">
      <div class="wc-card-title" id="wc-daily-title">Daily Forecast</div>
      <div id="wc-daily-temp-view">
        <div class="wc-hourly-heads">${heads}</div>
        <div class="wc-chart-wrap"><canvas id="wc-daily-chart" height="90"></canvas></div>
      </div>
      ${
        hasSoil
          ? `<div id="wc-daily-soil-view" hidden>
               <div class="wc-chart-wrap"><canvas id="wc-daily-soil-chart" height="90"></canvas></div>
             </div>`
          : ""
      }
    </div>
  `;
}

/**
 * A short glanceable line describing the next hour, derived from a
 * `minutely` nowcast series: "Rain starting in 12 min", "Rain ending in
 * 8 min", "Rain for the next hour", or "No rain expected in the next hour".
 */
function minutelyCalloutText(minutely, thresholdMmh = 0.1) {
  const rows = minutely || [];
  if (!rows.length) return "";
  const isWet = (r) => (r.precipMmh || 0) >= thresholdMmh;
  const rainingNow = isWet(rows[0]);
  const changeIdx = rows.findIndex((r, i) => i > 0 && isWet(r) !== rainingNow);
  if (rainingNow) {
    return changeIdx === -1 ? "Rain for the next hour" : `Rain ending in ${changeIdx} min`;
  }
  return changeIdx === -1 ? "No rain expected in the next hour" : `Rain starting in ${changeIdx} min`;
}

function minutelyCardHtml(state, config) {
  const callout = minutelyCalloutText(state.minutely);
  return `
    <div class="wc-card wc-minutely">
      <div class="wc-card-title">Next Hour</div>
      ${callout ? `<div class="wc-minutely-callout wc-dimmed">${escapeHtml(callout)}</div>` : ""}
      <div class="wc-chart-wrap wc-chart-wrap-mini"><canvas id="wc-minutely-chart" height="28"></canvas></div>
    </div>
  `;
}

/** Full module markup for a given state + config (skips cards config disables). */
function weatherHtml(state, config, fmt = defaultFmt) {
  const cards = config.cards || {};
  let html = `<div class="wc-weather-conditions">`;
  if (state.stale) html += `<div class="wc-stale-badge wc-dimmed">showing last known data</div>`;
  if (cards.current !== false) html += currentCardHtml(state, config, fmt);
  if (cards.minutely !== false && state.minutely && state.minutely.length) html += minutelyCardHtml(state, config);
  if (cards.hourly !== false && state.hourly && state.hourly.length) html += hourlyCardHtml(state, config, fmt);
  if (cards.daily !== false && state.daily && state.daily.length) html += dailyCardHtml(state, config, fmt);
  html += `</div>`;
  return html;
}

const __exports = {
  currentCardHtml,
  minutelyCardHtml,
  minutelyCalloutText,
  hourlyCardHtml,
  dailyCardHtml,
  weatherHtml,
  cyclingValue,
  unitKindFor,
  escapeHtml,
};
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.render = __exports;
}
})();
