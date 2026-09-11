/**
 * Unit-cycling values: a single value (temperature, pressure, wind, ...)
 * that rotates through a configured list of units, cross-fading between
 * them — e.g. 18°C <-> 64°F, or 1018 hPa <-> 30.06 inHg.
 *
 * DOM-based but framework-agnostic (plain elements, no shadow-DOM
 * assumptions), so the same module runs unmodified in the MM module's
 * document and in the Lovelace card's shadow root — pass that root as
 * `rootEl`.
 */

const units =
  typeof module === "object" && module.exports ? require("./units") : window.WeatherCore.units;

/** Build the markup for one cycling value. Call again on every data refresh
 *  (it re-lays-out the unit list) — use updateUnitCycleValue for cheap ticks. */
function unitCycleHtml(elId, kindName, baseValue, unitList) {
  const items = unitList
    .map((u, i) => {
      const active = i === 0 ? " is-active" : "";
      return `<span class="wc-uc-item${active}" data-unit="${u}">${units.format(kindName, baseValue, u)}</span>`;
    })
    .join("");
  return `<span class="wc-unit-cycle" id="${elId}" data-kind="${kindName}" data-units="${unitList.join(",")}">${items}</span>`;
}

/** Cheap refresh: update text of every unit span without touching rotation state. */
function updateUnitCycleValue(rootEl, elId, baseValue) {
  const wrap = rootEl.querySelector(`#${CSS.escape(elId)}`);
  if (!wrap) return;
  const kindName = wrap.dataset.kind;
  wrap.querySelectorAll(".wc-uc-item").forEach((span) => {
    span.textContent = units.format(kindName, baseValue, span.dataset.unit);
  });
}

/** Start (or restart) the rotation timers for every `.wc-unit-cycle` under rootEl. */
function startUnitCycling(rootEl, { cycleMs = 6000, fadeMs = 600 } = {}) {
  rootEl.querySelectorAll(".wc-unit-cycle").forEach((wrap) => {
    if (wrap._wcTimer) clearInterval(wrap._wcTimer);
    wrap.style.setProperty("--wc-fade-ms", `${fadeMs}ms`);
    const items = Array.from(wrap.querySelectorAll(".wc-uc-item"));
    if (items.length < 2) return;
    let idx = items.findIndex((el) => el.classList.contains("is-active"));
    if (idx < 0) idx = 0;
    wrap._wcTimer = setInterval(() => {
      items[idx].classList.remove("is-active");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("is-active");
    }, cycleMs);
  });
}

function stopUnitCycling(rootEl) {
  rootEl.querySelectorAll(".wc-unit-cycle").forEach((wrap) => {
    if (wrap._wcTimer) {
      clearInterval(wrap._wcTimer);
      wrap._wcTimer = null;
    }
  });
}

const CSS_TEXT = `
.wc-unit-cycle { position: relative; display: inline-block; min-width: 3.6em; height: 1.2em; vertical-align: bottom; }
.wc-uc-item { position: absolute; left: 0; top: 0; white-space: nowrap; opacity: 0; transition: opacity var(--wc-fade-ms, 600ms) ease-in-out; }
.wc-uc-item.is-active { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .wc-uc-item { transition: none; } }
`;

const __exports = { unitCycleHtml, updateUnitCycleValue, startUnitCycling, stopUnitCycling, CSS_TEXT };
if (typeof module === "object" && module.exports) {
  module.exports = __exports;
} else {
  window.WeatherCore = window.WeatherCore || {};
  window.WeatherCore.unitcycle = __exports;
}
