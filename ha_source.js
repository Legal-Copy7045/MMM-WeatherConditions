/* global WebSocket */
"use strict";

/**
 * Mode C: reads the Weather Conditions HA integration's `_status` sensor
 * over HA's WebSocket API — its attributes already ARE the canonical
 * weather state (see custom_components/weather_conditions/sensor.py), so
 * this just connects, authenticates, and reshapes.
 *
 * WebSocket, not REST polling: browsers don't apply CORS to a WebSocket
 * handshake the way they do to fetch(), so — like MMM-KiaAccess's
 * ha_source.js — this needs no `cors_allowed_origins` configuration on
 * the HA side at all.
 */
class HaWeatherSource {
  constructor(config, onData) {
    this.config = config || {};
    this.onData = onData;
    this.ws = null;
    this.msgId = 1;
    this.reconnectDelay = 2000;
    this.closed = false;
    this._pendingGetStatesId = null;
  }

  connect() {
    this.closed = false;
    this._open();
  }

  disconnect() {
    this.closed = true;
    if (this.ws) this.ws.close();
  }

  _wsUrl() {
    const url = (this.config.url || "").replace(/\/$/, "");
    return url.replace(/^http/, "ws") + "/api/websocket";
  }

  _open() {
    const { url, token, statusEntity } = this.config;
    if (!url || !token || !statusEntity) {
      console.error("MMM-WeatherConditions: homeassistant.url / token / statusEntity must all be set"); // eslint-disable-line no-console
      return;
    }

    const connectedAt = Date.now();
    const ws = new WebSocket(this._wsUrl());
    this.ws = ws;

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }

      if (msg.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      } else if (msg.type === "auth_invalid") {
        console.error("MMM-WeatherConditions: HA auth failed:", msg.message); // eslint-disable-line no-console
        ws.close();
      } else if (msg.type === "auth_ok") {
        this.reconnectDelay = 2000;
        this._pendingGetStatesId = this.msgId++;
        ws.send(JSON.stringify({ id: this._pendingGetStatesId, type: "get_states" }));
        ws.send(JSON.stringify({ id: this.msgId++, type: "subscribe_events", event_type: "state_changed" }));
      } else if (msg.type === "result" && msg.id === this._pendingGetStatesId) {
        if (msg.success && Array.isArray(msg.result)) {
          const entity = msg.result.find((s) => s.entity_id === statusEntity);
          if (entity) this._emit(entity);
        }
      } else if (msg.type === "event" && msg.event && msg.event.event_type === "state_changed") {
        const data = msg.event.data;
        if (data && data.entity_id === statusEntity && data.new_state) {
          this._emit(data.new_state);
        }
      }
    };

    ws.onclose = (ev) => {
      if (this.closed) return;
      const heldSec = ((Date.now() - connectedAt) / 1000).toFixed(1);
      console.error(`MMM-WeatherConditions: HA websocket closed (code ${ev.code}), held ${heldSec}s — reconnecting`); // eslint-disable-line no-console
      setTimeout(() => this._open(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
    };
  }

  _emit(entity) {
    const a = entity.attributes || {};
    this.onData({
      updatedAt: a.updatedAt,
      source: a.source || "homeassistant",
      location: a.location,
      current: a.current || {},
      minutely: a.minutely || [],
      hourly: a.hourly || [],
      daily: a.daily || [],
      alerts: a.alerts || [],
      soilForecast: a.soilForecast || [],
      stale: false,
    });
  }
}

if (typeof module === "object" && module.exports) {
  module.exports = HaWeatherSource;
} else {
  window.HaWeatherSource = HaWeatherSource;
}
