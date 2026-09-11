"""Python-side tests for core/*.py — mirrors test/*.test.js for the JS ports."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core import conditions, soilforecast, state, units, windscale  # noqa: E402


class UnitsTest(unittest.TestCase):
    def test_temperature_c_to_f(self):
        self.assertEqual(units.from_base("temperature", 0, "F"), 32)
        self.assertEqual(units.from_base("temperature", 100, "F"), 212)

    def test_speed_knots_roundtrip(self):
        kn = units.from_base("speed", 100, "kn")
        self.assertAlmostEqual(kn, 53.9957, places=2)
        kmh = units.to_base("speed", kn, "kn")
        self.assertAlmostEqual(kmh, 100, places=2)

    def test_beaufort(self):
        self.assertEqual(units.kmh_to_beaufort(0), 0)
        self.assertEqual(units.kmh_to_beaufort(50), 7)

    def test_format_null(self):
        self.assertEqual(units.format_value("temperature", None, "C"), "--")


class WindscaleTest(unittest.TestCase):
    def test_calm_is_first_stop(self):
        self.assertEqual(windscale.color_for_kmh(0), windscale.STOPS[0][1])

    def test_deterministic(self):
        self.assertEqual(windscale.color_for_kmh(42), windscale.color_for_kmh(42))


class SoilForecastTest(unittest.TestCase):
    def test_parse_bracketed_csv(self):
        self.assertEqual(soilforecast.parse_day_bucket_array("[9.1, 9.0, 8.8]"), [9.1, 9.0, 8.8])

    def test_parse_empty(self):
        self.assertEqual(soilforecast.parse_day_bucket_array("unknown"), [])
        self.assertEqual(soilforecast.parse_day_bucket_array(None), [])


class StateTest(unittest.TestCase):
    def test_from_ha_weather_overlays_extra(self):
        s = state.from_ha_weather("sunny", {"temperature": 21, "humidity": 40}, extra={"soilTempC": 9.4})
        self.assertEqual(s["current"]["tempC"], 21)
        self.assertEqual(s["current"]["soilTempC"], 9.4)
        self.assertEqual(s["current"]["icon"], "clear-day")

    def test_dew_point_sane(self):
        dp = state.compute_dew_point_c(25, 80)
        self.assertTrue(19 < dp < 22)


class ConditionsTest(unittest.TestCase):
    def test_no_alerts_mild_day(self):
        alerts = conditions.derive_alerts({"current": {"tempC": 18, "windGustKmh": 15, "uvIndex": 3}})
        self.assertEqual(alerts, [])

    def test_frost_and_wind_and_uv(self):
        alerts = conditions.derive_alerts({"current": {"tempC": -1, "windGustKmh": 75, "uvIndex": 9}})
        labels = [a["label"] for a in alerts]
        self.assertIn("Frost risk", labels)
        self.assertIn("High wind", labels)
        self.assertIn("High UV", labels)


if __name__ == "__main__":
    unittest.main()
