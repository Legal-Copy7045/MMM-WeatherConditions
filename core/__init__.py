"""Shared core engine (units, state normalization, conditions, visuals data).

JS files here are loaded directly by the MM module and bundled into the
Lovelace card. The .py files are the source of truth for the HA integration;
`scripts/sync-core.js` vendors them into custom_components/weather_conditions/core/
after every edit — run `npm run sync`.
"""
