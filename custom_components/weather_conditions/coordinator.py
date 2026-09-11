"""DataUpdateCoordinator for the Weather Conditions integration."""

from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    CONF_FROST_BELOW_C,
    CONF_HEAT_ABOVE_C,
    CONF_SOIL_FORECAST_ENTITIES,
    CONF_UV_AT_OR_ABOVE,
    CONF_WEATHER_ENTITY,
    CONF_WIND_ABOVE_KMH,
    DEFAULT_FROST_BELOW_C,
    DEFAULT_HEAT_ABOVE_C,
    DEFAULT_SCAN_INTERVAL_SECONDS,
    DEFAULT_UV_AT_OR_ABOVE,
    DEFAULT_WIND_ABOVE_KMH,
    EXTRA_SENSOR_KEYS,
)
from .core import conditions as core_conditions
from .core import soilforecast as core_soilforecast
from .core import state as core_state

_LOGGER = logging.getLogger(__name__)


def _parse_entity_list(raw) -> list[str]:
    """Split a newline/comma-separated entity_id list, ordered day 0 first."""
    if not raw:
        return []
    parts = [p.strip() for line in str(raw).splitlines() for p in line.split(",")]
    return [p for p in parts if p]


class WeatherConditionsCoordinator(DataUpdateCoordinator):
    """Polls the configured weather.* entity + supplemental sensors."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name="weather_conditions",
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL_SECONDS),
        )
        self.entry = entry
        self._last_good: dict | None = None

    def _opts(self):
        return {**self.entry.data, **self.entry.options}

    async def _async_update_data(self) -> dict:
        opts = self._opts()
        entity_id = opts.get(CONF_WEATHER_ENTITY)
        if not entity_id:
            raise UpdateFailed("No weather entity configured")

        entity = self.hass.states.get(entity_id)
        if entity is None:
            if self._last_good is not None:
                _LOGGER.warning("%s unavailable, using last good data", entity_id)
                return self._last_good
            raise UpdateFailed(f"Entity {entity_id} not found")

        hourly, daily = [], []
        try:
            resp = await self.hass.services.async_call(
                "weather",
                "get_forecasts",
                {"entity_id": entity_id, "type": "hourly"},
                blocking=True,
                return_response=True,
            )
            hourly = (resp or {}).get(entity_id, {}).get("forecast", [])
        except (HomeAssistantError, TypeError) as err:
            _LOGGER.debug("hourly forecast unavailable for %s: %s", entity_id, err)
        try:
            resp = await self.hass.services.async_call(
                "weather",
                "get_forecasts",
                {"entity_id": entity_id, "type": "daily"},
                blocking=True,
                return_response=True,
            )
            daily = (resp or {}).get(entity_id, {}).get("forecast", [])
        except (HomeAssistantError, TypeError) as err:
            _LOGGER.debug("daily forecast unavailable for %s: %s", entity_id, err)

        extra = {}
        for conf_key, state_key in EXTRA_SENSOR_KEYS.items():
            sensor_id = opts.get(conf_key)
            if not sensor_id:
                continue
            sensor_state = self.hass.states.get(sensor_id)
            if sensor_state is None or sensor_state.state in ("unknown", "unavailable"):
                continue
            try:
                extra[state_key] = float(sensor_state.state)
            except (TypeError, ValueError):
                _LOGGER.debug("supplemental sensor %s has non-numeric state", sensor_id)

        weather_state = core_state.from_ha_weather(
            entity.state, entity.attributes, hourly, daily, extra
        )

        soil_entities = _parse_entity_list(opts.get(CONF_SOIL_FORECAST_ENTITIES))
        if soil_entities:
            day_values = []
            for entity_id_day in soil_entities:
                day_state = self.hass.states.get(entity_id_day)
                day_values.append(
                    core_soilforecast.parse_day_bucket_array(day_state.state if day_state else None)
                )
            weather_state["soilForecast"] = core_soilforecast.build_soil_forecast(day_values)
        else:
            weather_state["soilForecast"] = []

        weather_state["alerts"] = core_conditions.derive_alerts(
            weather_state,
            {
                "frost": {"below_c": opts.get(CONF_FROST_BELOW_C, DEFAULT_FROST_BELOW_C)},
                "heat": {"above_c": opts.get(CONF_HEAT_ABOVE_C, DEFAULT_HEAT_ABOVE_C)},
                "wind": {"above_kmh": opts.get(CONF_WIND_ABOVE_KMH, DEFAULT_WIND_ABOVE_KMH)},
                "uv": {"at_or_above": opts.get(CONF_UV_AT_OR_ABOVE, DEFAULT_UV_AT_OR_ABOVE)},
            },
        )
        self._last_good = weather_state
        return weather_state
