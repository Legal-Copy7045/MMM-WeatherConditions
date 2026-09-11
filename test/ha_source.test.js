const { test } = require("node:test");
const assert = require("node:assert/strict");

/** Minimal fake WebSocket driving the HA auth + get_states/subscribe_events handshake. */
class FakeWebSocket {
  constructor(url) {
    FakeWebSocket.instances.push(this);
    this.url = url;
    this.sent = [];
    this.onmessage = null;
    this.onclose = null;
    setTimeout(() => this._send({ type: "auth_required" }), 0);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
    const msg = JSON.parse(data);
    if (msg.type === "auth") {
      setTimeout(() => this._send({ type: "auth_ok" }), 0);
    } else if (msg.type === "get_states") {
      setTimeout(
        () =>
          this._send({
            id: msg.id,
            type: "result",
            success: true,
            result: [{ entity_id: "sensor.weather_conditions_status", attributes: { current: { tempC: 20 } } }],
          }),
        0
      );
    }
  }

  close() {
    if (this.onclose) this.onclose({ code: 1000 });
  }

  _send(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}
FakeWebSocket.instances = [];

global.WebSocket = FakeWebSocket;
global.window = global;
const HaWeatherSource = require("../ha_source");

test("authenticates then emits the get_states snapshot", async () => {
  const received = [];
  const src = new HaWeatherSource(
    { url: "http://ha.local:8123", token: "tok", statusEntity: "sensor.weather_conditions_status" },
    (state) => received.push(state)
  );
  src.connect();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(received.length, 1);
  assert.equal(received[0].current.tempC, 20);
  assert.equal(received[0].stale, false);

  const ws = FakeWebSocket.instances.at(-1);
  assert.equal(ws.url, "ws://ha.local:8123/api/websocket");
  assert.ok(ws.sent.some((m) => m.type === "auth" && m.access_token === "tok"));
  assert.ok(ws.sent.some((m) => m.type === "subscribe_events" && m.event_type === "state_changed"));
});

test("emits on a matching state_changed event", async () => {
  const received = [];
  const src = new HaWeatherSource(
    { url: "http://ha.local:8123", token: "tok", statusEntity: "sensor.weather_conditions_status" },
    (state) => received.push(state)
  );
  src.connect();
  await new Promise((r) => setTimeout(r, 20));

  const ws = FakeWebSocket.instances.at(-1);
  ws._send({
    type: "event",
    event: {
      event_type: "state_changed",
      data: {
        entity_id: "sensor.weather_conditions_status",
        new_state: { attributes: { current: { tempC: 25 } } },
      },
    },
  });

  assert.equal(received.at(-1).current.tempC, 25);
});

test("ignores state_changed events for other entities", async () => {
  const received = [];
  const src = new HaWeatherSource(
    { url: "http://ha.local:8123", token: "tok", statusEntity: "sensor.weather_conditions_status" },
    (state) => received.push(state)
  );
  src.connect();
  await new Promise((r) => setTimeout(r, 20));
  const countAfterSnapshot = received.length;

  const ws = FakeWebSocket.instances.at(-1);
  ws._send({
    type: "event",
    event: {
      event_type: "state_changed",
      data: { entity_id: "sensor.something_else", new_state: { attributes: {} } },
    },
  });

  assert.equal(received.length, countAfterSnapshot);
});
