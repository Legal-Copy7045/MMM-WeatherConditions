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

/**
 * Draws the precip amount ("0.5 mm") above each non-zero precipitation bar,
 * matching the labelled bars in the reference module's hourly/daily charts.
 * A plain Chart.js plugin (afterDatasetsDraw hook) rather than pulling in
 * chartjs-plugin-datalabels, to keep the dependency footprint small.
 */
function precipLabelsPlugin(precipUnit, decimals) {
  return {
    id: "wcPrecipLabels",
    afterDatasetsDraw(chart) {
      const dsIndex = chart.data.datasets.findIndex((d) => d.label === "Precipitation");
      if (dsIndex === -1) return;
      const meta = chart.getDatasetMeta(dsIndex);
      if (!meta || meta.hidden) return;
      const values = chart.data.datasets[dsIndex].data;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#c7cede";
      ctx.textAlign = "center";
      meta.data.forEach((bar, i) => {
        const v = values[i];
        if (!v) return;
        ctx.fillText(`${v.toFixed(decimals)} ${precipUnit}`, bar.x, bar.y - 4);
      });
      ctx.restore();
    },
  };
}

/**
 * Draws each point's value ("19°") above (or below, via `dy`) the line in
 * the given colour, matching the reference module's labelled temperature
 * lines (high in orange above, low in green below, near the precip bars).
 */
function pointLabelsPlugin(datasetLabel, { color, unit, decimals, dy = -6 }) {
  return {
    id: `wcPointLabels_${datasetLabel}`,
    afterDatasetsDraw(chart) {
      const dsIndex = chart.data.datasets.findIndex((d) => d.label === datasetLabel);
      if (dsIndex === -1) return;
      const meta = chart.getDatasetMeta(dsIndex);
      if (!meta || meta.hidden) return;
      const values = chart.data.datasets[dsIndex].data;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      meta.data.forEach((point, i) => {
        const v = values[i];
        if (v == null) return;
        ctx.fillText(`${v.toFixed(decimals)}${unit}`, point.x, point.y + dy);
      });
      ctx.restore();
    },
  };
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
  const plugins = [];
  const tempLabel = units.labelFor("temperature", tempUnit);
  const tempDecimals = units.decimalsFor("temperature", tempUnit);

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
    plugins.push(pointLabelsPlugin("Temperature", { color: "#f4c542", unit: tempLabel, decimals: tempDecimals, dy: -8 }));
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
      plugins.push(pointLabelsPlugin("Low", { color: "#8bd346", unit: tempLabel, decimals: tempDecimals, dy: 12 }));
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
    plugins.push(precipLabelsPlugin(units.labelFor("lengthSmall", precipUnit), units.decimalsFor("lengthSmall", precipUnit)));
  }

  return { data: { labels, datasets }, options: baseChartOptions(), plugins };
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
  const hours = (config.soilForecastDays || 5) * 24;
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

/** Dense, label-free area chart for the next-hour precipitation nowcast. */
function minutelyChartConfig(state) {
  const rows = state.minutely || [];
  return {
    type: "line",
    data: {
      labels: rows.map(() => ""),
      datasets: [
        {
          data: rows.map((r) => r.precipMmh || 0),
          borderColor: "#5aa7ff",
          backgroundColor: "#5aa7ff44",
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: 0 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true, suggestedMax: 2 },
      },
    },
  };
}

const __exports = {
  baseChartOptions,
  lineBarChartConfig,
  hourlyChartConfig,
  dailyChartConfig,
  soilChartConfig,
  minutelyChartConfig,
};
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.charts = __exports;
}
})();
