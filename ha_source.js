/* global fetch */
"use strict";

/**
 * Mode C: reads the Weather Conditions HA integration's `_status` sensor
 * directly from the browser (no node_helper round-trip) — its attributes
 * already ARE the canonical weather state (see custom_components/
 * weather_conditions/sensor.py), so this just polls and reshapes.
 *
 * Needs HA's REST API reachable from the mirror's browser with CORS allowed
 * for its origin, e.g. in configuration.yaml:
 *   http:
 *     cors_allowed_origins:
 *       - http://<mirror-ip>:8080
 */
class HaWeatherSource {
  constructor(config, onData) {
    this.config = config || {};
    this.onData = onData;
    this._timer = null;
  }

  connect() {
    this.poll();
    const interval = this.config.pollMs || 5 * 60 * 1000;
    this._timer = setInterval(() => this.poll(), interval);
  }

  disconnect() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async poll() {
    const { url, token, statusEntity } = this.config;
    if (!url || !token || !statusEntity) {
      console.error("MMM-WeatherConditions: homeassistant.url / token / statusEntity must all be set"); // eslint-disable-line no-console
      return;
    }
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/states/${statusEntity}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HA request failed: ${res.status}`);
      const body = await res.json();
      const a = body.attributes || {};
      this.onData({
        updatedAt: a.updatedAt,
        source: a.source || "homeassistant",
        location: a.location,
        current: a.current || {},
        hourly: a.hourly || [],
        daily: a.daily || [],
        alerts: a.alerts || [],
        soilForecast: a.soilForecast || [],
        stale: false,
      });
    } catch (err) {
      console.error("MMM-WeatherConditions: HA poll failed:", err.message); // eslint-disable-line no-console
    }
  }
}

if (typeof module === "object" && module.exports) {
  module.exports = HaWeatherSource;
} else {
  window.HaWeatherSource = HaWeatherSource;
}
