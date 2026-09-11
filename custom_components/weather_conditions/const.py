"""Constants for the Weather Conditions integration."""

DOMAIN = "weather_conditions"
PLATFORMS = ["sensor"]

# Two mutually exclusive sources: wrap an existing HA weather.* entity (its
# forecast support varies wildly by integration -- confirmed the hard way:
# HA's own OpenWeatherMap entity doesn't support get_forecasts at all), or
# poll OpenWeather One Call 3.0 directly ourselves for a guaranteed-complete
# feature set (current + hourly + daily + alerts + minutely + UV + moon),
# the same data MM's own "direct" mode B uses.
CONF_SOURCE = "source"
SOURCE_WEATHER_ENTITY = "weather_entity"
SOURCE_OPENWEATHERMAP = "openweathermap"

CONF_WEATHER_ENTITY = "weather_entity"
CONF_OWM_API_KEY = "owm_api_key"
CONF_OWM_LATITUDE = "owm_latitude"
CONF_OWM_LONGITUDE = "owm_longitude"

CONF_FROST_BELOW_C = "frost_below_c"
CONF_HEAT_ABOVE_C = "heat_above_c"
CONF_WIND_ABOVE_KMH = "wind_above_kmh"
CONF_UV_AT_OR_ABOVE = "uv_at_or_above"

# Optional supplemental sensors that overlay onto the base weather.* entity —
# useful because most weather integrations don't report these at all (soil
# temperature) or only sometimes do (UV, rain rate). Any existing HA sensor
# entity works: a weather station (Ecowitt/Ambient/Govee), an irrigation
# probe, a template sensor, etc.
CONF_SOIL_TEMP_ENTITY = "soil_temperature_entity"
CONF_UV_INDEX_ENTITY = "uv_index_entity"
CONF_RAIN_RATE_ENTITY = "rain_rate_entity"
EXTRA_SENSOR_KEYS = {
    CONF_SOIL_TEMP_ENTITY: "soilTempC",
    CONF_UV_INDEX_ENTITY: "uvIndex",
    CONF_RAIN_RATE_ENTITY: "rainRateMmh",
}

# Multi-day soil-temperature forecast: a set of "day-bucket" sensors, each
# holding a bracketed CSV of hourly values for that day (day 0 = today), e.g.
# sensor.soil_temperature_week_day_0 = "[9.1, 9.0, 8.8, ...]". Configured as
# a newline- or comma-separated ordered list, day 0 first.
CONF_SOIL_FORECAST_ENTITIES = "soil_forecast_entities"

DEFAULT_FROST_BELOW_C = 0
DEFAULT_HEAT_ABOVE_C = 32
DEFAULT_WIND_ABOVE_KMH = 60
DEFAULT_UV_AT_OR_ABOVE = 8

DEFAULT_SCAN_INTERVAL_SECONDS = 300
