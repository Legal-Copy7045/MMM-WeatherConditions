# MMM-WeatherConditions

A current-conditions weather module for [MagicMirror²](https://magicmirror.builders/), built the same way as [MMM-KiaAccess](https://github.com/Legal-Copy7045/MMM-KiaAccess): one shared core engine driving a **Home Assistant integration**, the **MagicMirror module**, and a matching **Lovelace card**, so the mirror and the dashboard always show the same thing.

Layout is inspired by a WIP MagicMirror weather module shared on r/MagicMirror (current-conditions card + hourly/daily Chart.js charts, wind-speed colour legend, sunrise/sunset arc), adapted with:

- **Unit cycling** — any value (temperature, pressure, wind, ...) can rotate through a list of units, cross-fading between them, e.g. 18°C ⇄ 64°F or 1018 hPa ⇄ 30.06 inHg.
- No header clock (MagicMirror already has a clock module for that).
- Knots, m/s, mph, km/h, and Beaufort as wind-unit options.
- Optional soil-temperature current reading + a multi-day soil-temperature forecast chart, for garden/irrigation setups.

## What you get

### Home Assistant (recommended)

Install via HACS (custom repository, category **Integration**), add the integration, and pick one of two sources:

- **An existing `weather.*` entity** — Met.no (bundled with HA, no signup) or any other weather integration you already have. **Forecast support varies by integration** — confirmed the hard way that HA's own OpenWeatherMap integration entity doesn't support `weather.get_forecasts` at all, so hourly/daily stay empty with it. If that happens, check **Developer Tools → Actions → weather.get_forecasts** against your entity, or switch to a different one (Met.no reliably supports it).
- **OpenWeatherMap One Call 3.0, polled directly** — sidesteps the above entirely: a guaranteed-complete feature set (current, hourly 48h, daily 8-day, government alerts, next-hour precipitation nowcast, UV, moon phase/rise/set, and a plain-English daily summary) regardless of what HA's own weather integrations happen to support. Needs a free API key from [openweathermap.org](https://openweathermap.org/api/one-call-3) with One Call 3.0 enabled — OWM requires a card on file even for the free 1,000-calls/day tier, but the default 5-minute poll only uses ~288 calls/day. Latitude/longitude default to your HA instance's configured location.

Either way, the integration republishes a normalized `sensor.<name>_status` with the full payload as attributes, plus `_dew_point` and `_active_alerts` sensors, and installs the **`weather-conditions-card`** Lovelace card automatically.

Optional extras (Configure → Options), available regardless of which source you picked:
- Supplemental sensors that overlay onto the base weather entity: **soil temperature**, **UV index**, **rain rate** — useful since most weather integrations don't report these (or don't report UV) at all.
- A **soil-temperature forecast**: point it at a set of "day-bucket" sensors (day 0, day 1, ...), each holding a bracketed CSV of ~24 hourly values for that day — the same shape some soil-temperature forecast sources publish and that an `apexcharts-card` `data_generator` can chart. The integration turns that into a proper multi-day hourly series. If you don't also have a separate current-reading sensor for **soil temperature**, leave that field blank — the current-conditions "Soil temp" stat falls back to day 0's bucket at the current hour automatically.
- Alert thresholds: frost, heat, high wind, high UV.

### MagicMirror, fed by Home Assistant (mode C)

`mode: "homeassistant"` in the module config — reads the integration's `_status` sensor straight from the mirror's browser over HA's **WebSocket API** (same approach as MMM-KiaAccess's `ha_source.js`), not a REST poll. No `cors_allowed_origins` configuration needed on the HA side — browsers don't apply CORS to a WebSocket handshake the way they do to `fetch()`. Just a reachable HA URL and a long-lived access token.

### MagicMirror, standalone (mode B)

`mode: "direct"` — no Home Assistant needed. Defaults to **Open-Meteo** (free, no API key). OpenWeather One Call 3.0 is also supported as a source if you want its data instead — that one needs a free API key from openweathermap.org (card on file required, even on the free tier). Responses are cached to disk between updates and the module falls back to the last good data on a failed request.

## Current-conditions card

Icon + temperature + condition, feels-like, today's plain-English summary (OWM only), humidity with dew point, pressure, wind speed with a coloured direction arrow and gusts, UV index with its descriptor (low/moderate/high/very high/extreme), tonight's moon phase, a sunrise→sunset arc with a marker for the sun's current position, and the wind-speed colour legend — the same colour scale colours the arrows in the hourly/daily charts, so one colour means the same wind speed everywhere.

**Next Hour** (OWM only, needs `minutely` data): a glanceable callout — "Rain starting in 12 min", "Rain ending in 8 min", "Rain for the next hour", or "No rain expected in the next hour" — above a dense, label-free area chart of the next 60 minutes' precipitation rate.

Hourly and daily charts (Chart.js) show a temperature line labelled with its value at each point (points coloured by wind speed; the daily chart adds a dashed low-temperature line, labelled separately), precipitation bars labelled with their amount (e.g. "0.5 mm") when non-zero, and a wind arrow + icon above each point. Every card, and every series within the hourly/daily charts, can be switched on or off independently (`cards`, `hourlySeries`, `dailySeries`).

The Daily Forecast card's chart alternates on a timer (`dailyGraphSwitchMs`, default 10s) between that day-by-day temperature+precip view and a multi-day soil-temperature chart (`soilForecastDays`, default 5), when `cards.soilForecast` is on and soil data is configured in the HA integration — the card's title swaps between "Daily Forecast" and "Soil Temp — N-Day" to match. There's no separate soil card anymore; it lives inside this toggle.

Condition, moon-phase, wind, and sunrise/sunset icons come from [weather-icons](https://github.com/erikflowers/weather-icons) (SIL OFL-1.1 font + MIT CSS), vendored at build time — no hand-drawn SVGs.

The module is 375px wide by default, sized to match a sports-scoreboard-style module alongside it — there's no config option for width, edit the `.wc-weather-conditions` rule in `MMM-WeatherConditions.css` to change it.

**Unit cycling now applies to the charts too**, not just the current-conditions card. Chart.js canvases can't take part in the CSS crossfade the header values use, so instead the hourly/daily/soil charts periodically rebuild themselves against the next configured temperature unit — a hard swap on the same `cycleMs` interval, rather than a fade.

## Unit cycling

```js
units: {
  temperature: { list: ["C", "F"], cycleMs: 6000, fadeMs: 600 },
  pressure:    { list: ["hPa", "inHg"], cycleMs: 6000, fadeMs: 600 },
  wind:        { list: ["kmh", "kn"], cycleMs: 8000, fadeMs: 700 },
  precipitation: { list: ["mm"] },
  visibility:    { list: ["km"] },
}
```

A single-entry `list` just displays that unit with no cycling. `cycleMs` is how long each unit is shown; `fadeMs` is the cross-fade duration. Wind's unit list also accepts `"bft"` for Beaufort force.

## Installation

### Home Assistant integration

```bash
cd config/custom_components
git clone https://github.com/Legal-Copy7045/MMM-WeatherConditions.git weather_conditions_repo
cp -r weather_conditions_repo/custom_components/weather_conditions ./weather_conditions
rm -rf weather_conditions_repo
```

Or add `https://github.com/Legal-Copy7045/MMM-WeatherConditions` as a HACS custom repository (category: Integration). Then **Settings → Devices & Services → Add Integration → Weather Conditions**.

### MagicMirror module

```bash
cd ~/MagicMirror/modules
git clone https://github.com/Legal-Copy7045/MMM-WeatherConditions.git
cd MMM-WeatherConditions
npm install
npm run sync   # vendors Chart.js + the Python core into the HA integration (only needed if you're developing, not for a plain MM-only install)
```

Add a config block from [`examples/config.js`](examples/config.js) to `config/config.js`.

## Development

Shared logic lives in `core/` — JS files are loaded directly by the MM module and bundled into the Lovelace card; the `.py` files are the source of truth for the HA integration. **Run `npm run sync` after editing anything in `core/`** — it vendors the Python files into `custom_components/weather_conditions/core/`, vendors Chart.js into `vendor/`, and rebuilds the Lovelace card bundle at `custom_components/weather_conditions/www/weather-conditions-card.js`. CI fails on drift.

```bash
npm test                      # JS unit tests (node:test)
python -m unittest discover -s test -p "test_*.py"   # Python unit tests
```

## Known limitations (HA mode)

- **If you pick the "existing weather entity" source, hourly/daily forecasts depend entirely on that entity supporting HA's `get_forecasts` action.** Not all weather integrations do — HA's own `OpenWeatherMap` integration entity, for example, only exposes current conditions, no forecast at all. `Met.no` (HA's bundled default) and many others do. If the hourly/daily cards aren't showing anything, check **Developer Tools → Actions → weather.get_forecasts** against your chosen entity, pick a different one, or switch the integration's source to **OpenWeatherMap polled directly**, which sidesteps this entirely.
- **The sunrise/sunset arc only appears when the source provides sun times.** OpenWeatherMap (both mode B and the integration's direct-poll source) and Open-Meteo both do; wrapping an existing HA `weather.*` entity generally doesn't expose sunrise/sunset as an attribute at all, and `sun.sun`'s `next_rising`/`next_setting` only ever point at the *next* occurrence (not necessarily today's pair), so that path can't reliably derive an arc yet. The card just omits the arc gracefully rather than showing something wrong.

## Still on the list

- Locale-driven date/time + UI text translation (bundled languages), independent of MagicMirror's global language setting.
- A full contract-test harness running fixtures through both the JS and Python engines (as MMM-KiaAccess does), rather than hand-written unit tests on each side.
- OpenWeather severe-weather alerts UI beyond the plain alert list (the data already flows through `alerts[]`).
- Computing the sunrise/sunset arc directly from lat/lon for HA mode (a small solar-position calculation), instead of depending on the source to provide it.

## License

MIT
