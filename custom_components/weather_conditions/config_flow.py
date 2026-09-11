"""Config flow for Weather Conditions."""

from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_FROST_BELOW_C,
    CONF_HEAT_ABOVE_C,
    CONF_OWM_API_KEY,
    CONF_OWM_LATITUDE,
    CONF_OWM_LONGITUDE,
    CONF_RAIN_RATE_ENTITY,
    CONF_SOIL_FORECAST_ENTITIES,
    CONF_SOIL_TEMP_ENTITY,
    CONF_SOURCE,
    CONF_UV_AT_OR_ABOVE,
    CONF_UV_INDEX_ENTITY,
    CONF_WEATHER_ENTITY,
    CONF_WIND_ABOVE_KMH,
    DEFAULT_FROST_BELOW_C,
    DEFAULT_HEAT_ABOVE_C,
    DEFAULT_UV_AT_OR_ABOVE,
    DEFAULT_WIND_ABOVE_KMH,
    DOMAIN,
    SOURCE_OPENWEATHERMAP,
    SOURCE_WEATHER_ENTITY,
)


class WeatherConditionsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Two setup paths: wrap an existing weather.* entity, or poll
    OpenWeather One Call 3.0 directly (guaranteed full feature set,
    independent of which weather.* entities HA happens to have)."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        return self.async_show_menu(
            step_id="user",
            menu_options=["weather_entity", "openweathermap"],
        )

    async def async_step_weather_entity(self, user_input=None):
        errors = {}
        if user_input is not None:
            entity_id = user_input[CONF_WEATHER_ENTITY]
            await self.async_set_unique_id(entity_id)
            self._abort_if_unique_id_configured()
            data = {CONF_SOURCE: SOURCE_WEATHER_ENTITY, **user_input}
            return self.async_create_entry(title=f"Weather Conditions ({entity_id})", data=data)

        schema = vol.Schema(
            {
                vol.Required(CONF_WEATHER_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="weather")
                ),
            }
        )
        return self.async_show_form(step_id="weather_entity", data_schema=schema, errors=errors)

    async def async_step_openweathermap(self, user_input=None):
        errors = {}
        if user_input is not None:
            lat = user_input.get(CONF_OWM_LATITUDE) or self.hass.config.latitude
            lon = user_input.get(CONF_OWM_LONGITUDE) or self.hass.config.longitude
            await self.async_set_unique_id(f"{SOURCE_OPENWEATHERMAP}_{lat}_{lon}")
            self._abort_if_unique_id_configured()
            data = {
                CONF_SOURCE: SOURCE_OPENWEATHERMAP,
                CONF_OWM_API_KEY: user_input[CONF_OWM_API_KEY],
                CONF_OWM_LATITUDE: lat,
                CONF_OWM_LONGITUDE: lon,
            }
            return self.async_create_entry(title="Weather Conditions (OpenWeatherMap)", data=data)

        schema = vol.Schema(
            {
                vol.Required(CONF_OWM_API_KEY): str,
                vol.Optional(CONF_OWM_LATITUDE, default=self.hass.config.latitude): vol.Coerce(float),
                vol.Optional(CONF_OWM_LONGITUDE, default=self.hass.config.longitude): vol.Coerce(float),
            }
        )
        return self.async_show_form(step_id="openweathermap", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return WeatherConditionsOptionsFlow(config_entry)


class WeatherConditionsOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        opts = self.config_entry.options
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_SOIL_TEMP_ENTITY, default=opts.get(CONF_SOIL_TEMP_ENTITY, "")
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
                vol.Optional(
                    CONF_UV_INDEX_ENTITY, default=opts.get(CONF_UV_INDEX_ENTITY, "")
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
                vol.Optional(
                    CONF_RAIN_RATE_ENTITY, default=opts.get(CONF_RAIN_RATE_ENTITY, "")
                ): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
                vol.Optional(
                    CONF_SOIL_FORECAST_ENTITIES,
                    default=opts.get(CONF_SOIL_FORECAST_ENTITIES, ""),
                ): selector.TextSelector(
                    selector.TextSelectorConfig(multiline=True)
                ),
                vol.Optional(
                    CONF_FROST_BELOW_C, default=opts.get(CONF_FROST_BELOW_C, DEFAULT_FROST_BELOW_C)
                ): vol.Coerce(float),
                vol.Optional(
                    CONF_HEAT_ABOVE_C, default=opts.get(CONF_HEAT_ABOVE_C, DEFAULT_HEAT_ABOVE_C)
                ): vol.Coerce(float),
                vol.Optional(
                    CONF_WIND_ABOVE_KMH, default=opts.get(CONF_WIND_ABOVE_KMH, DEFAULT_WIND_ABOVE_KMH)
                ): vol.Coerce(float),
                vol.Optional(
                    CONF_UV_AT_OR_ABOVE, default=opts.get(CONF_UV_AT_OR_ABOVE, DEFAULT_UV_AT_OR_ABOVE)
                ): vol.Coerce(float),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
