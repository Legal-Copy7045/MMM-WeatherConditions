# MMM-WeatherConditions

A current-conditions weather module for [MagicMirror²](https://magicmirror.builders/), built the same way as [MMM-KiaAccess](https://github.com/Legal-Copy7045/MMM-KiaAccess): one shared core engine driving a **Home Assistant integration**, the **MagicMirror module**, and a matching **Lovelace card**, so the mirror and the dashboard always show the same thing.

Layout is inspired by a WIP MagicMirror weather module shared on r/MagicMirror (current-conditions card + hourly/daily Chart.js charts, wind-speed colour legend, sunrise/sunset arc), adapted with:

- **Unit cycling** — any value (temperature, pressure, wind, ...) can rotate through a list of units, cross-fading between them, e.g. 18°C ⇄ 64°F or 1018 hPa ⇄ 30.06 inHg.
- No header clock (MagicMirror already has a clock module for that).
- Knots, m/s, mph, km/h, and Beaufort as wind-unit options.
- Optional soil-temperature current reading + a multi-day soil-temperature forecast chart, for garden/irrigation setups.

## What you get

### Home Assistant (recommended)

Install via HACS (custom repository, category **Integration**), add the integration, and point it at any existing `weather.*` entity (Met.no is bundled with HA and needs no key/signup). It republishes a normalized `sensor.<name>_status` with the full current/hourly/daily/alerts payload as attributes, plus `_dew_point` and `_active_alerts` sensors, and installs the **`weather-conditions-card`** Lovelace card automatically.

Optional extras (Configure → Options):
- Supplemental sensors that overlay onto the base weather entity: **soil temperature**, **UV index**, **rain rate** — useful since most weather integrations don't report these (or don't report UV) at all.
- A **soil-temperature forecast**: point it at a set of "day-bucket" sensors (day 0, day 1, ...), each holding a bracketed CSV of ~24 hourly values for that day — the same shape some soil-temperature forecast sources publish and that an `apexcharts-card` `data_generator` can chart. The integration turns that into a proper multi-day hourly series.
- Alert thresholds: frost, heat, high wind, high UV.

### MagicMirror, fed by Home Assistant (mode C)

`mode: "homeassistant"` in the module config — reads the integration's `_status` sensor straight from the mirror's browser (no separate weather API call, no node_helper polling). Needs HA's REST API reachable from the mirror with CORS allowed for its origin:

```yaml
# configuration.yaml
http:
  cors_allowed_origins:
    - http://<mirror-ip>:8080
```

### MagicMirror, standalone (mode B)

`mode: "direct"` — no Home Assistant needed. Defaults to **Open-Meteo** (free, no API key). OpenWeather One Call 3.0 is also supported as a source if you want its data instead — that one needs a free API key from openweathermap.org (card on file required, even on the free tier). Responses are cached to disk between updates and the module falls back to the last good data on a failed request.

## Current-conditions card

Icon + temperature + condition, feels-like, humidity with dew point, pressure, wind speed with a coloured direction arrow and gusts, UV index with its descriptor (low/moderate/high/very high/extreme), a sunrise→sunset arc with a marker for the sun's current position, and the wind-speed colour legend — the same colour scale colours the arrows in the hourly/daily charts, so one colour means the same wind speed everywhere.

Hourly and daily charts (Chart.js) show a temperature line (points coloured by wind speed), precipitation bars, and a wind arrow + icon above each point. Every card, and every series within the hourly/daily charts, can be switched on or off independently (`cards`, `hourlySeries`, `dailySeries`).

## Unit cycling

```js
units: {
  temperature: { list: ["C", "F"], cycleMs: 6000, fadeMs: 600 },
  pressure:    { list: ["hPa", "inHg"], cycleMs: 6000, fadeMs: 600 },
  wind:        { list: ["kmh", "mph", "kn"], cycleMs: 8000, fadeMs: 700 },
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

## Still on the list

- Locale-driven date/time + UI text translation (bundled languages), independent of MagicMirror's global language setting.
- Scaling/responsiveness tuning across screen sizes.
- A full contract-test harness running fixtures through both the JS and Python engines (as MMM-KiaAccess does), rather than hand-written unit tests on each side.
- OpenWeather severe-weather alerts UI beyond the plain alert list (the data already flows through `alerts[]`).

## License

MIT
