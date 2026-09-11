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

    soilForecastDays: 5,
    // How often the Daily Forecast card's chart flips between the day-by-day
    // temperature+precip view and the soil-temperature view (only relevant
    // when cards.soilForecast is on and soil data is configured in HA).
    dailyGraphSwitchMs: 10000,

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
    this.startChartCycling(wrapper, this.weatherState);
    this.startDailyViewToggle(wrapper, this.weatherState);

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

  /** The DOM-based crossfade (startCycling) only works on plain HTML text --
   *  Chart.js canvases can't participate in a CSS opacity transition, so the
   *  charts instead periodically rebuild themselves against the next unit
   *  in the list (a hard swap, not a fade, but the same "cycle through
   *  configured units" behavior applied to the graphs too). */
  startChartCycling(root, s) {
    if (this._chartCycleTimer) clearInterval(this._chartCycleTimer);
    const list = (this.config.units.temperature || {}).list || [];
    if (list.length < 2) return;
    const ms = this.config.units.temperature.cycleMs || 6000;
    this._chartCycleTimer = setInterval(() => {
      this._chartUnitIdx = ((this._chartUnitIdx || 0) + 1) % list.length;
      this.renderCharts(root, s);
    }, ms);
  },

  /** Returns this.config with the temperature unit list rotated so the
   *  currently-active cycle unit is first -- chart config builders always
   *  read units.temperature.list[0], so this is how the charts pick up
   *  whichever unit startChartCycling has rotated to. */
  _cycledConfig() {
    const list = (this.config.units.temperature || {}).list || [];
    if (list.length < 2) return this.config;
    const idx = (this._chartUnitIdx || 0) % list.length;
    const rotated = [list[idx], ...list.filter((_, i) => i !== idx)];
    return { ...this.config, units: { ...this.config.units, temperature: { ...this.config.units.temperature, list: rotated } } };
  },

  renderCharts(root, s) {
    const cards = this.config.cards;
    const cfg = this._cycledConfig();
    if (cards.minutely !== false && s.minutely && s.minutely.length) {
      const canvas = root.querySelector("#wc-minutely-chart");
      if (canvas) {
        this._destroyChart("_minutelyChart");
        this._minutelyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.minutelyChartConfig(s));
      }
    }
    if (cards.hourly && s.hourly && s.hourly.length) {
      const canvas = root.querySelector("#wc-hourly-chart");
      if (canvas) {
        this._destroyChart("_hourlyChart");
        this._hourlyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.hourlyChartConfig(s, cfg, this.fmt));
      }
    }
    if (cards.daily && s.daily && s.daily.length) {
      this._renderDailySection(root, s);
    }
  },

  /** Renders whichever of the Daily Forecast card's two views (temp+precip,
   *  or soil temperature) is currently active, per this._dailyShowSoil. */
  _renderDailySection(root, s) {
    const cfg = this._cycledConfig();
    const hasSoil = this.config.cards.soilForecast && s.soilForecast && s.soilForecast.length;
    const showSoil = !!(this._dailyShowSoil && hasSoil);

    const tempView = root.querySelector("#wc-daily-temp-view");
    const soilView = root.querySelector("#wc-daily-soil-view");
    const title = root.querySelector("#wc-daily-title");
    if (tempView) tempView.hidden = showSoil;
    if (soilView) soilView.hidden = !showSoil;
    if (title) title.textContent = showSoil ? `Soil Temp — ${this.config.soilForecastDays || 5}-Day` : "Daily Forecast";

    this._destroyChart("_dailyChart");
    this._destroyChart("_dailySoilChart");
    if (showSoil) {
      const canvas = root.querySelector("#wc-daily-soil-chart");
      if (canvas) this._dailySoilChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.soilChartConfig(s, cfg, this.fmt));
    } else {
      const canvas = root.querySelector("#wc-daily-chart");
      if (canvas) this._dailyChart = new Chart(canvas.getContext("2d"), WeatherCore.charts.dailyChartConfig(s, cfg, this.fmt));
    }
  },

  startDailyViewToggle(root, s) {
    if (this._dailyViewTimer) clearInterval(this._dailyViewTimer);
    const hasSoil = this.config.cards.soilForecast && s.soilForecast && s.soilForecast.length;
    if (!hasSoil) return;
    const ms = this.config.dailyGraphSwitchMs || 10000;
    this._dailyViewTimer = setInterval(() => {
      this._dailyShowSoil = !this._dailyShowSoil;
      this._renderDailySection(root, s);
    }, ms);
  },

  _destroyChart(ref) {
    if (this[ref]) {
      this[ref].destroy();
      this[ref] = null;
    }
  },
});
