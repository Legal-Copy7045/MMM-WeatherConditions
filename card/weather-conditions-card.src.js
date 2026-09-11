/* global customElements, HTMLElement, WeatherCore, Chart */
"use strict";

/**
 * Lovelace card for the Weather Conditions integration. Reads the `_status`
 * sensor's attributes directly from `hass` (already the canonical weather
 * state — see custom_components/weather_conditions/sensor.py) and renders
 * it with the exact same core/render.js + core/charts.js the MM module
 * uses, so the dashboard and the mirror stay visually identical.
 *
 * Bundled (with Chart.js + core/*.js) into one file by scripts/build-card.js
 * and registered as a Lovelace resource by the integration on setup.
 */
// Replaced with the contents of MMM-WeatherConditions.css by scripts/build-card.js
// (shadow DOM doesn't inherit page styles, so the card carries its own copy).
const CARD_CSS = `/*__WC_CSS__*/`;

class WeatherConditionsCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("weather-conditions-card: `entity` is required");
    this._config = {
      units: {
        temperature: { list: ["C", "F"], cycleMs: 6000, fadeMs: 600 },
        pressure: { list: ["hPa"], cycleMs: 6000, fadeMs: 600 },
        wind: { list: ["kmh"], cycleMs: 6000, fadeMs: 600 },
        precipitation: { list: ["mm"], cycleMs: 6000, fadeMs: 600 },
        visibility: { list: ["km"], cycleMs: 6000, fadeMs: 600 },
      },
      cards: { current: true, minutely: true, hourly: true, daily: true, soilForecast: true },
      hourlySeries: { temperature: true, precipitation: true, wind: true },
      hourlyPoints: 5,
      hourlyStepHours: 4,
      dailySeries: { temperature: true, precipitation: true, wind: true },
      dailyDays: 5,
      soilForecastDays: 5,
      dailyGraphSwitchMs: 10000,
      ...config,
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    const entity = hass.states[this._config.entity];
    if (!entity) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px">Entity ${this._config.entity} not found</div></ha-card>`;
      return;
    }
    const a = entity.attributes || {};
    const state = {
      current: a.current || {},
      minutely: a.minutely || [],
      hourly: a.hourly || [],
      daily: a.daily || [],
      alerts: a.alerts || [],
      soilForecast: a.soilForecast || [],
      stale: false,
    };
    const stateKey = JSON.stringify({ c: a.current, h: (a.hourly || []).length, d: (a.daily || []).length });
    if (stateKey === this._lastKey) return; // avoid re-render/chart-thrash on unrelated hass updates
    this._lastKey = stateKey;
    this._state = state;

    const cfg = { ...this._config, locale: this._config.locale || hass.locale?.language };
    this._cfg = cfg;
    this.shadowRoot.innerHTML = `<ha-card><style>${CARD_CSS}</style>${WeatherCore.render.weatherHtml(state, cfg, this._fmt)}</ha-card>`;

    // Chart canvases + unit-cycle elements just got (re)created — wire them up.
    requestAnimationFrame(() => {
      this._renderCharts(state, cfg);
      this._startCycling(cfg);
      this._startChartCycling(state);
      this._startDailyViewToggle(state);
    });
  }

  _fmt(iso, opts, locale) {
    try {
      return new Date(iso).toLocaleString(locale || undefined, opts);
    } catch (e) {
      return String(iso);
    }
  }

  /** Rotates cfg.units.temperature.list so the active cycle unit is first --
   *  chart config builders always read list[0], same trick as the MM module. */
  _cycledConfig(cfg) {
    const list = (cfg.units.temperature || {}).list || [];
    if (list.length < 2) return cfg;
    const idx = (this._chartUnitIdx || 0) % list.length;
    const rotated = [list[idx], ...list.filter((_, i) => i !== idx)];
    return { ...cfg, units: { ...cfg.units, temperature: { ...cfg.units.temperature, list: rotated } } };
  }

  _renderCharts(state, cfg) {
    const root = this.shadowRoot;
    const cycled = this._cycledConfig(cfg);
    if (cfg.cards.minutely !== false && state.minutely && state.minutely.length) {
      const canvas = root.getElementById("wc-minutely-chart");
      if (canvas) {
        if (this._minutelyChart) this._minutelyChart.destroy();
        this._minutelyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.minutelyChartConfig(state));
      }
    }
    if (cfg.cards.hourly && state.hourly.length) {
      const canvas = root.getElementById("wc-hourly-chart");
      if (canvas) {
        if (this._hourlyChart) this._hourlyChart.destroy();
        this._hourlyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.hourlyChartConfig(state, cycled, this._fmt));
      }
    }
    if (cfg.cards.daily && state.daily.length) {
      this._renderDailySection(state, cfg);
    }
  }

  /** Rebuilds whichever of the Daily Forecast card's two views (temp+precip,
   *  or soil temperature) is currently active, per this._dailyShowSoil. */
  _renderDailySection(state, cfg) {
    const root = this.shadowRoot;
    const cycled = this._cycledConfig(cfg);
    const hasSoil = cfg.cards.soilForecast && state.soilForecast && state.soilForecast.length;
    const showSoil = !!(this._dailyShowSoil && hasSoil);

    const tempView = root.getElementById("wc-daily-temp-view");
    const soilView = root.getElementById("wc-daily-soil-view");
    const title = root.getElementById("wc-daily-title");
    if (tempView) tempView.hidden = showSoil;
    if (soilView) soilView.hidden = !showSoil;
    if (title) title.textContent = showSoil ? `Soil Temp — ${cfg.soilForecastDays || 5}-Day` : "Daily Forecast";

    if (this._dailyChart) { this._dailyChart.destroy(); this._dailyChart = null; }
    if (this._dailySoilChart) { this._dailySoilChart.destroy(); this._dailySoilChart = null; }
    if (showSoil) {
      const canvas = root.getElementById("wc-daily-soil-chart");
      if (canvas) this._dailySoilChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.soilChartConfig(state, cycled, this._fmt));
    } else {
      const canvas = root.getElementById("wc-daily-chart");
      if (canvas) this._dailyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.dailyChartConfig(state, cycled, this._fmt));
    }
  }

  /** Chart.js canvases can't take part in the DOM-based crossfade _startCycling
   *  drives, so instead they periodically rebuild against the next configured
   *  temperature unit -- a hard swap, but the same "cycle through units"
   *  behavior the header values get, applied to the graphs too. */
  _startChartCycling(state) {
    if (this._chartCycleTimer) clearInterval(this._chartCycleTimer);
    const list = (this._cfg.units.temperature || {}).list || [];
    if (list.length < 2) return;
    const ms = this._cfg.units.temperature.cycleMs || 6000;
    this._chartCycleTimer = setInterval(() => {
      this._chartUnitIdx = ((this._chartUnitIdx || 0) + 1) % list.length;
      this._renderCharts(state, this._cfg);
    }, ms);
  }

  _startDailyViewToggle(state) {
    if (this._dailyViewTimer) clearInterval(this._dailyViewTimer);
    const hasSoil = this._cfg.cards.soilForecast && state.soilForecast && state.soilForecast.length;
    if (!hasSoil) return;
    const ms = this._cfg.dailyGraphSwitchMs || 10000;
    this._dailyViewTimer = setInterval(() => {
      this._dailyShowSoil = !this._dailyShowSoil;
      this._renderDailySection(state, this._cfg);
    }, ms);
  }

  _startCycling(cfg) {
    const root = this.shadowRoot;
    ["temperature", "pressure", "wind", "precipitation", "visibility"].forEach((kind) => {
      const kindCfg = cfg.units[kind] || {};
      root.querySelectorAll(`.wc-unit-cycle[data-kind="${WeatherCore.render.unitKindFor(kind)}"]`).forEach((el) => {
        if (el._wcTimer) clearInterval(el._wcTimer);
        el.style.setProperty("--wc-fade-ms", `${kindCfg.fadeMs || 600}ms`);
        const items = Array.from(el.querySelectorAll(".wc-uc-item"));
        if (items.length < 2) return;
        let idx = 0;
        el._wcTimer = setInterval(() => {
          items[idx].classList.remove("is-active");
          idx = (idx + 1) % items.length;
          items[idx].classList.add("is-active");
        }, kindCfg.cycleMs || 6000);
      });
    });
  }

  getCardSize() {
    return 6;
  }

  disconnectedCallback() {
    ["_minutelyChart", "_hourlyChart", "_dailyChart", "_dailySoilChart"].forEach((ref) => {
      if (this[ref]) this[ref].destroy();
    });
    [this._chartCycleTimer, this._dailyViewTimer].forEach((t) => t && clearInterval(t));
  }
}

customElements.define("weather-conditions-card", WeatherConditionsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weather-conditions-card",
  name: "Weather Conditions Card",
  description: "Current-conditions card with unit-cycling values and hourly/daily charts.",
});
