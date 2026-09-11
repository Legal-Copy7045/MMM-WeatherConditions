/**
 * OpenWeather One Call 3.0 source — optional, needs a free OWM API key
 * (One Call 3.0 must be enabled on the account, card required by OWM even
 * on the free 1,000 calls/day tier). Not the default for either mode.
 */

function buildUrl({ lat, lon, apiKey, units = "metric", lang = "en" }) {
  const params = new URLSearchParams({
    lat, lon, appid: apiKey, units, lang,
    exclude: "minutely",
  });
  return `https://api.openweathermap.org/data/3.0/onecall?${params.toString()}`;
}

async function fetchOpenWeatherMap({ lat, lon, apiKey, units, lang }, fetchImpl = fetch) {
  const res = await fetchImpl(buildUrl({ lat, lon, apiKey, units, lang }));
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

module.exports = { buildUrl, fetchOpenWeatherMap };
