(function () {
/**
 * Chart.js config builders for the hourly/daily/soil charts — shared by the
 * MM module and the Lovelace card. Returns plain Chart.js config objects;
 * callers do `new Chart(ctx, config)` themselves (each host owns its own
 * canvas + Chart instance lifecycle).
 */

const deps = (() => {
  if (typeof module === "object" && module.exports) {
    return { units: require("./units"), windscale: require("./windscale") };
  }
  return { units: window.WeatherCore.units, windscale: window.WeatherCore.windscale };
})();
const { units, windscale } = deps;

function baseChartOptions() {
  const tickFont = { size: 9 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: 0 },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#c7cede", font: tickFont }, grid: { color: "#2a3247" } },
      temp: { position: "left", ticks: { color: "#f4c542", font: tickFont }, grid: { color: "#2a3247" } },
      precip: { position: "right", beginAtZero: true, suggestedMax: 5, ticks: { color: "#5aa7ff", font: tickFont }, grid: { display: false } },
    },
  };
}

function defaultFmt(iso, opts, locale) {
  try {
    return new Date(iso).toLocaleString(locale || undefined, opts);
  } catch (e) {
    return String(iso);
  }
}

/** rows: hourly or daily canonical rows. timeField: "time" | "date". isDaily adds a low-temp line. */
function lineBarChartConfig(rows, config, timeField, isDaily, fmt = defaultFmt) {
  const series = (isDaily ? config.dailySeries : config.hourlySeries) || {};
  const tempUnit = config.units.temperature.list[0];
  const precipUnit = config.units.precipitation.list[0];
  const labels = rows.map((r) =>
    fmt(r[timeField], isDaily ? { weekday: "short" } : { hour: "numeric" }, config.locale)
  );
  const datasets = [];

  if (series.temperature !== false) {
    const field = isDaily ? "tempMaxC" : "tempC";
    datasets.push({
      type: "line",
      label: "Temperature",
      yAxisID: "temp",
      data: rows.map((r) => units.fromBase("temperature", r[field], tempUnit)),
      borderColor: "#f4c542",
      pointBackgroundColor: rows.map((r) => windscale.colorForKmh(r.windKmh)),
      pointRadius: 3,
      tension: 0.3,
    });
    if (isDaily) {
      datasets.push({
        type: "line",
        label: "Low",
        yAxisID: "temp",
        data: rows.map((r) => units.fromBase("temperature", r.tempMinC, tempUnit)),
        borderColor: "#8bd346",
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.3,
      });
    }
  }
  if (series.precipitation !== false) {
    datasets.push({
      type: "bar",
      label: "Precipitation",
      yAxisID: "precip",
      data: rows.map((r) => units.fromBase("lengthSmall", r.precipMm, precipUnit)),
      backgroundColor: "#5aa7ffaa",
    });
  }

  return { data: { labels, datasets }, options: baseChartOptions() };
}

function hourlyChartConfig(state, config, fmt) {
  const step = Math.max(1, config.hourlyStepHours || 1);
  const rows = (state.hourly || []).filter((_, i) => i % step === 0).slice(0, config.hourlyPoints || 5);
  return lineBarChartConfig(rows, config, "time", false, fmt);
}

function dailyChartConfig(state, config, fmt) {
  const rows = (state.daily || []).slice(0, config.dailyDays || 5);
  return lineBarChartConfig(rows, config, "date", true, fmt);
}

function soilChartConfig(state, config, fmt = defaultFmt) {
  const hours = (config.soilForecastDays || 3) * 24;
  const rows = (state.soilForecast || []).slice(0, hours);
  const tempUnit = config.units.temperature.list[0];
  return {
    type: "line",
    data: {
      labels: rows.map((r) => fmt(r.time, { weekday: "short", hour: "numeric" }, config.locale)),
      datasets: [
        {
          label: "Soil temp",
          data: rows.map((r) => units.fromBase("temperature", r.tempC, tempUnit)),
          borderColor: "#8bd346",
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: baseChartOptions(),
  };
}

const __exports = { baseChartOptions, lineBarChartConfig, hourlyChartConfig, dailyChartConfig, soilChartConfig };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.charts = __exports;
}
})();
