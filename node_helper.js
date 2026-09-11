/* Backend for mode "direct": fetches the configured weather source, caches
 * the normalized state to disk, and falls back to the last good cache on
 * request failure so a flaky connection doesn't blank the module. */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

const state = require("./core/state");
const conditions = require("./core/conditions");
const { fetchOpenMeteo } = require("./core/sources/openmeteo");
const { fetchOpenWeatherMap } = require("./core/sources/openweathermap");

const CACHE_FILE = path.join(__dirname, ".weather-cache.json");

module.exports = NodeHelper.create({
  start() {
    this._timers = {};
  },

  socketNotificationReceived(notification, config) {
    if (notification === "WC_CONFIG" || notification === "WC_FETCH") {
      this.fetchAndSend(config);
    }
  },

  async fetchAndSend(config) {
    try {
      const raw =
        config.source === "openweathermap"
          ? await fetchOpenWeatherMap({ lat: config.lat, lon: config.lon, apiKey: config.apiKey })
          : await fetchOpenMeteo({ lat: config.lat, lon: config.lon });

      const normalized =
        config.source === "openweathermap" ? state.fromOpenWeatherMap(raw) : state.fromOpenMeteo(raw);

      normalized.alerts = conditions.deriveAlerts(normalized, config.alerts || {});
      normalized.soilForecast = normalized.soilForecast || [];
      normalized.stale = false;

      this.writeCache(normalized);
      this.sendSocketNotification("WC_DATA", normalized);
    } catch (err) {
      const cached = this.readCache();
      if (cached) {
        cached.stale = true;
        this.sendSocketNotification("WC_DATA", cached);
      }
      this.sendSocketNotification("WC_ERROR", `${err.message} (${cached ? "serving cached data" : "no cache available"})`);
    }
  },

  writeCache(data) {
    try {
      const tmp = `${CACHE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, CACHE_FILE);
    } catch (err) {
      // Non-fatal — caching is a nicety, not a requirement.
    }
  },

  readCache() {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    } catch (err) {
      return null;
    }
  },
});
