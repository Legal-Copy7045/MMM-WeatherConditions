/* global Module, Log, config, WeatherCore, Chart, HaWeatherSource */
"use strict";

Module.register("MMM-WeatherConditions", {
  defaults: {
    // "direct"       (mode B) — this module fetches the weather API itself via node_helper.
    // "homeassistant" (mode C) — fed by the Weather Conditions HA integration over its websocket.
    mode: "direct",
    source: "openmeteo", // "openmeteo" | "openweathermap" (mode: "direct" only)
    apiKey: null,
    lat: null,
    lon: null,
    updateInterval: 10 * 60 * 1000,
    animationSpeed: 1000,
    locale: null, // defaults to MM's global config.language

    homeassistant: {
      url: null, // e.g. "http://homeassistant.local:8123"
      token: null, // long-lived access token
      statusEntity: null, // e.g. "sensor.weather_conditions_status"
    },

    // Each cycling value rotates through `list`, cross-fading every cycleMs.
    // A single-entry list just displays that unit, no cycling.
    units: {
      temperature: { list: ["C", "F"], cycleMs: 6000, fadeMs: 600 },
      pressure: { list: ["hPa"], cycleMs: 6000, fadeMs: 600 },
      wind: { list: ["kmh"], cycleMs: 6000, fadeMs: 600 },
      precipitation: { list: ["mm"], cycleMs: 6000, fadeMs: 600 },
      visibility: { list: ["km"], cycleMs: 6000, fadeMs: 600 },
    },

    cards: {
      current: true,
      minutely: true,
      hourly: true,
      daily: true,
      soilForecast: true,
    },

    hourlySeries: { temperature: true, precipitation: true, wind: true },
    hourlyPoints: 5,
    hourlyStepHours: 4,

    dailySeries: { temperature: true, precipitation: true, wind: true },
    dailyDays: 5,

    soilForecastDays: 3,

    // Overrides merged onto core/conditions.js CHECK_DEFAULTS.
    alerts: {},
  },

  getStyles() {
    return ["MMM-WeatherConditions.css"];
  },

  getScripts() {
    // MM only auto-prefixes bare filenames with no subdirectory — anything
    // with a "/" (like "core/units.js") needs this.file() or it resolves
    // relative to the server root instead of this module's folder.
    const scripts = [
      this.file("vendor/chart.umd.min.js"),
      this.file("core/units.js"),
      this.file("core/windscale.js"),
      this.file("core/visuals.js"),
      this.file("core/unitcycle.js"),
      this.file("core/render.js"),
      this.file("core/charts.js"),
      this.file("core/state.js"),
      this.file("core/conditions.js"),
      this.file("core/soilforecast.js"),
    ];
    if (this.config.mode === "homeassistant") scripts.push(this.file("ha_source.js"));
    return scripts;
  },

  start() {
    this.config = { ...this.defaults, ...this.config };
    this.config.units = { ...this.defaults.units, ...(this.config.units || {}) };
    this.config.cards = { ...this.defaults.cards, ...(this.config.cards || {}) };
    if (!this.config.locale) this.config.locale = config.language || "en";

    this.weatherState = null;
    this.loaded = false;

    if (this.config.mode !== "homeassistant") {
      this.sendSocketNotification("WC_CONFIG", this.config);
      this.scheduleUpdate();
    }
  },

  scheduleUpdate() {
    setInterval(() => {
      this.sendSocketNotification("WC_FETCH", this.config);
    }, this.config.updateInterval);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "WC_DATA") {
      this.applyState(payload);
    } else if (notification === "WC_ERROR") {
      Log.error("MMM-WeatherConditions:", payload);
    }
  },

  notificationReceived(notification) {
    if (notification === "DOM_OBJECTS_CREATED" && this.config.mode === "homeassistant") {
      this._haSource = new HaWeatherSource(this.config.homeassistant, (state) => this.applyState(state));
      this._haSource.connect();
    }
  },

  applyState(state) {
    this.weatherState = state;
    this.loaded = true;
    this.updateDom(this.config.animationSpeed);
  },

  fmt(iso, opts, locale) {
    try {
      return new Date(iso).toLocaleString(locale || undefined, opts);
    } catch (e) {
      return String(iso);
    }
  },

  getDom() {
    const wrapper = document.createElement("div");

    if (!this.loaded) {
      wrapper.innerHTML = `<div class="wc-loading wc-dimmed">Loading weather&#8230;</div>`;
      return wrapper;
    }

    // core/render.js owns the markup; MM and the Lovelace card share it verbatim.
    wrapper.innerHTML = WeatherCore.render.weatherHtml(this.weatherState, this.config, this.fmt);

    // Query relative to `wrapper` itself (its children exist the instant
    // innerHTML is set, whether or not MM has inserted `wrapper` into the
    // visible document yet) rather than document.getElementById/
    // querySelectorAll -- a setTimeout(0) here previously raced against
    // MM's own DOM-swap timing and regularly found nothing, silently
    // skipping every chart AND the unit-cycling timers with no error.
    // Chart.js's responsive sizing still works once `wrapper` is actually
    // attached (its ResizeObserver picks up the real size then).
    this.renderCharts(wrapper, this.weatherState);
    this.startCycling(wrapper);

    return wrapper;
  },

  startCycling(root) {
    const groups = ["temperature", "pressure", "wind", "precipitation", "visibility"];
    groups.forEach((kind) => {
      const cfg = this.config.units[kind] || {};
      root.querySelectorAll(`.wc-unit-cycle[data-kind="${WeatherCore.render.unitKindFor(kind)}"]`).forEach((el) => {
        if (el._wcTimer) clearInterval(el._wcTimer);
        el.style.setProperty("--wc-fade-ms", `${cfg.fadeMs || 600}ms`);
        const items = Array.from(el.querySelectorAll(".wc-uc-item"));
        if (items.length < 2) return;
        let idx = 0;
        el._wcTimer = setInterval(() => {
          items[idx].classList.remove("is-active");
          idx = (idx + 1) % items.length;
          items[idx].classList.add("is-active");
        }, cfg.cycleMs || 6000);
      });
    });
  },

  renderCharts(root, s) {
    const cards = this.config.cards;
    if (cards.minutely !== false && s.minutely && s.minutely.length) {
      const canvas = root.querySelector("#wc-minutely-chart");
      if (canvas) {
        this._destroyChart("_minutelyChart");
        const cfg = WeatherCore.charts.minutelyChartConfig(s);
        this._minutelyChart = new Chart(canvas.getContext("2d"), cfg);
      }
    }
    if (cards.hourly && s.hourly && s.hourly.length) {
      const canvas = root.querySelector("#wc-hourly-chart");
      if (canvas) {
        this._destroyChart("_hourlyChart");
        const cfg = WeatherCore.charts.hourlyChartConfig(s, this.config, this.fmt);
        this._hourlyChart = new Chart(canvas.getContext("2d"), cfg);
      }
    }
    if (cards.daily && s.daily && s.daily.length) {
      const canvas = root.querySelector("#wc-daily-chart");
      if (canvas) {
        this._destroyChart("_dailyChart");
        const cfg = WeatherCore.charts.dailyChartConfig(s, this.config, this.fmt);
        this._dailyChart = new Chart(canvas.getContext("2d"), cfg);
      }
    }
    if (cards.soilForecast && s.soilForecast && s.soilForecast.length) {
      const canvas = root.querySelector("#wc-soil-chart");
      if (canvas) {
        this._destroyChart("_soilChart");
        const cfg = WeatherCore.charts.soilChartConfig(s, this.config, this.fmt);
        this._soilChart = new Chart(canvas.getContext("2d"), cfg);
      }
    }
  },

  _destroyChart(ref) {
    if (this[ref]) {
      this[ref].destroy();
      this[ref] = null;
    }
  },
});
