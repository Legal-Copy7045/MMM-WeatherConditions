"""Sensors for the Weather Conditions integration.

The `_status` sensor carries the full canonical weather state as attributes
(current/hourly/daily/alerts/soilForecast) — this is what MM's ha_source.js
mode reads over the websocket to feed the module without ever touching a
weather API directly.
"""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import WeatherConditionsCoordinator


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: WeatherConditionsCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            WeatherConditionsStatusSensor(coordinator, entry),
            WeatherConditionsDewPointSensor(coordinator, entry),
            WeatherConditionsAlertsSensor(coordinator, entry),
        ]
    )


class _BaseEntity(CoordinatorEntity):
    def __init__(self, coordinator: WeatherConditionsCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="MMM-WeatherConditions",
        )


class WeatherConditionsStatusSensor(_BaseEntity, SensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Status"
    _attr_icon = "mdi:weather-partly-cloudy"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_status"

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        return (data.get("current") or {}).get("condition")

    @property
    def extra_state_attributes(self):
        return self.coordinator.data or {}


class WeatherConditionsDewPointSensor(_BaseEntity, SensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Dew point"
    _attr_native_unit_of_measurement = "°C"
    _attr_device_class = "temperature"
    _attr_state_class = "measurement"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_dew_point"

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        return (data.get("current") or {}).get("dewPointC")


class WeatherConditionsAlertsSensor(_BaseEntity, SensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Active alerts"
    _attr_icon = "mdi:alert-outline"
    _attr_state_class = "measurement"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_alerts"

    @property
    def native_value(self):
        data = self.coordinator.data or {}
        return len(data.get("alerts") or [])

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data or {}
        return {"alerts": data.get("alerts") or []}
