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
      cards: { current: true, hourly: true, daily: true, soilForecast: false },
      hourlySeries: { temperature: true, precipitation: true, wind: true },
      hourlyPoints: 7,
      hourlyStepHours: 4,
      dailySeries: { temperature: true, precipitation: true, wind: true },
      dailyDays: 8,
      soilForecastDays: 6,
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
      hourly: a.hourly || [],
      daily: a.daily || [],
      alerts: a.alerts || [],
      soilForecast: a.soilForecast || [],
      stale: false,
    };
    const stateKey = JSON.stringify({ c: a.current, h: (a.hourly || []).length, d: (a.daily || []).length });
    if (stateKey === this._lastKey) return; // avoid re-render/chart-thrash on unrelated hass updates
    this._lastKey = stateKey;

    const cfg = { ...this._config, locale: this._config.locale || hass.locale?.language };
    this.shadowRoot.innerHTML = `<ha-card><style>${CARD_CSS}</style>${WeatherCore.render.weatherHtml(state, cfg, this._fmt)}</ha-card>`;

    // Chart canvases + unit-cycle elements just got (re)created — wire them up.
    requestAnimationFrame(() => {
      this._renderCharts(state, cfg);
      this._startCycling(cfg);
    });
  }

  _fmt(iso, opts, locale) {
    try {
      return new Date(iso).toLocaleString(locale || undefined, opts);
    } catch (e) {
      return String(iso);
    }
  }

  _renderCharts(state, cfg) {
    const root = this.shadowRoot;
    if (cfg.cards.hourly && state.hourly.length) {
      const canvas = root.getElementById("wc-hourly-chart");
      if (canvas) {
        if (this._hourlyChart) this._hourlyChart.destroy();
        this._hourlyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.hourlyChartConfig(state, cfg, this._fmt));
      }
    }
    if (cfg.cards.daily && state.daily.length) {
      const canvas = root.getElementById("wc-daily-chart");
      if (canvas) {
        if (this._dailyChart) this._dailyChart.destroy();
        this._dailyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.dailyChartConfig(state, cfg, this._fmt));
      }
    }
    if (cfg.cards.soilForecast && state.soilForecast.length) {
      const canvas = root.getElementById("wc-soil-chart");
      if (canvas) {
        if (this._soilChart) this._soilChart.destroy();
        this._soilChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.soilChartConfig(state, cfg, this._fmt));
      }
    }
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
    ["_hourlyChart", "_dailyChart", "_soilChart"].forEach((ref) => {
      if (this[ref]) this[ref].destroy();
    });
  }
}

customElements.define("weather-conditions-card", WeatherConditionsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weather-conditions-card",
  name: "Weather Conditions Card",
  description: "Current-conditions card with unit-cycling values and hourly/daily charts.",
});
