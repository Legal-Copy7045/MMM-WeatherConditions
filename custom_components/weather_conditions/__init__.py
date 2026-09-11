"""The Weather Conditions integration."""

from __future__ import annotations

import logging
import os

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS
from .coordinator import WeatherConditionsCoordinator

_LOGGER = logging.getLogger(__name__)

_CARD_URL = f"/{DOMAIN}_static/weather-conditions-card.js"
_FRONTEND_REGISTERED = False


async def _async_register_frontend(hass: HomeAssistant) -> None:
    global _FRONTEND_REGISTERED  # noqa: PLW0603
    if _FRONTEND_REGISTERED:
        return
    www_dir = os.path.join(os.path.dirname(__file__), "www")
    card_path = os.path.join(www_dir, "weather-conditions-card.js")
    exists = await hass.async_add_executor_job(os.path.exists, card_path)
    if not exists:
        _LOGGER.warning(
            "weather-conditions-card.js not found — run `npm run build:card` in the repo before releasing"
        )
        return
    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}_static", www_dir, cache_headers=False)]
    )
    add_extra_js_url(hass, _CARD_URL)
    _FRONTEND_REGISTERED = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _async_register_frontend(hass)

    coordinator = WeatherConditionsCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unloaded
