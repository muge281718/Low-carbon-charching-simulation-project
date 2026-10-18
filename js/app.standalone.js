/*
 * Generated file for direct file:// use in Edge and other browsers.
 * Source of truth: js/config.js, js/model.js, js/charts.js, js/ui.js, js/app.js.
 * Rebuild with: node scripts/build-standalone.mjs
 */
(() => {
  "use strict";

  if (window.location.protocol !== "file:") return;

/* ---- js/config.js ---- */
const MODEL_VERSION = "0.1.0";

const DEFAULT_INPUTS = Object.freeze({
  vehicles: 40,
  chargers: 10,
  duration: 2,
  power: 7,
  windowStart: 8,
  windowEnd: 18,
  pvShare: 0.6,
  efficiency: 0.92,
  gridFactor: 0.58,
  pvFactor: 0.03,
});

const INPUT_RANGES = Object.freeze({
  vehicles: { min: 0, max: 500, step: 1, unit: "辆", displayScale: 1 },
  chargers: { min: 0, max: 100, step: 1, unit: "个", displayScale: 1 },
  duration: { min: 0.5, max: 8, step: 0.5, unit: "小时", displayScale: 1 },
  power: { min: 3.6, max: 120, step: 0.1, unit: "kW", displayScale: 1 },
  windowStart: { min: 0, max: 23, step: 1, unit: "时", displayScale: 1 },
  windowEnd: { min: 1, max: 24, step: 1, unit: "时", displayScale: 1 },
  pvShare: { min: 0, max: 1, step: 0.01, unit: "%", displayScale: 100 },
  efficiency: { min: 0.8, max: 1, step: 0.01, unit: "", displayScale: 1 },
  gridFactor: {
    min: 0,
    max: 1.5,
    step: 0.01,
    unit: "kgCO₂e/kWh",
    displayScale: 1,
  },
  pvFactor: {
    min: 0,
    max: 0.2,
    step: 0.001,
    unit: "kgCO₂e/kWh",
    displayScale: 1,
  },
});

const PRESETS = Object.freeze({
  office: Object.freeze({
    label: "写字楼",
    description: "日间通勤停车",
    values: Object.freeze({ ...DEFAULT_INPUTS }),
  }),
  mall: Object.freeze({
    label: "商场",
    description: "短时高频周转",
    values: Object.freeze({
      ...DEFAULT_INPUTS,
      vehicles: 80,
      chargers: 16,
      duration: 1.5,
      power: 11,
      windowStart: 10,
      windowEnd: 22,
      pvShare: 0.35,
    }),
  }),
  community: Object.freeze({
    label: "小区",
    description: "夜间长时间停放",
    values: Object.freeze({
      ...DEFAULT_INPUTS,
      vehicles: 30,
      chargers: 12,
      duration: 4,
      power: 7,
      windowStart: 18,
      windowEnd: 24,
      pvShare: 0.1,
    }),
  }),
});

const PV_AVAILABILITY = Object.freeze([
  0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1, 0.95, 0.85, 0.7,
  0.5, 0.3, 0.1, 0, 0, 0, 0, 0,
]);

const SCORE_WEIGHTS = Object.freeze({
  carbon: 0.7,
  pv: 0.3,
});

const SCORE_BANDS = Object.freeze([
  { min: 80, max: 100, band: "excellent", label: "优秀" },
  { min: 60, max: 79.999, band: "good", label: "良好" },
  { min: 40, max: 59.999, band: "fair", label: "一般" },
  { min: 0, max: 39.999, band: "high-carbon", label: "高碳" },
]);

const WARNING_THRESHOLDS = Object.freeze({
  serviceRate: 0.9,
  highPvShare: 0.8,
  lowPvAvailability: 0.15,
  mediumPvAvailability: 0.45,
  gridShareMajority: 0.5,
});

const CHART_COLORS = Object.freeze({
  load: "#246bfd",
  pv: "#36a269",
  grid: "#9aa5b5",
  gridFill: "rgba(143, 153, 169, 0.2)",
  axis: "#7b8493",
  gridLine: "#e6e9ee",
  text: "#162033",
});

const UI_COLORS = Object.freeze({
  accent: "#246bfd",
  accentSoft: "#eaf0ff",
  pv: "#2f9e67",
  warning: "#b86f08",
  danger: "#c73b43",
});

/* ---- js/model.js ---- */
const HOURS = Object.freeze(Array.from({ length: 24 }, (_, index) => index));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function serializeInput(input) {
  return {
    vehicles: finiteNumber(input.vehicles, DEFAULT_INPUTS.vehicles),
    chargers: finiteNumber(input.chargers, DEFAULT_INPUTS.chargers),
    duration: finiteNumber(input.duration, DEFAULT_INPUTS.duration),
    power: finiteNumber(input.power, DEFAULT_INPUTS.power),
    windowStart: finiteNumber(input.windowStart, DEFAULT_INPUTS.windowStart),
    windowEnd: finiteNumber(input.windowEnd, DEFAULT_INPUTS.windowEnd),
    pvShare: finiteNumber(input.pvShare, DEFAULT_INPUTS.pvShare),
    efficiency: finiteNumber(input.efficiency, DEFAULT_INPUTS.efficiency),
    gridFactor: finiteNumber(input.gridFactor, DEFAULT_INPUTS.gridFactor),
    pvFactor: finiteNumber(input.pvFactor, DEFAULT_INPUTS.pvFactor),
  };
}

function emptySeries() {
  return {
    hours: [...HOURS],
    load: HOURS.map(() => 0),
    pvPower: HOURS.map(() => 0),
    gridPower: HOURS.map(() => 0),
    queue: HOURS.map(() => 0),
  };
}

function emptyResult(input) {
  return {
    input,
    service: {
      served: 0,
      unserved: input.vehicles,
      serviceRate: 0,
      utilization: 0,
      peakLoad: 0,
      queuePeak: 0,
      arrivalRate: 0,
    },
    energy: {
      demand: 0,
      pile: 0,
      car: 0,
      loss: 0,
      pv: 0,
      grid: 0,
      unmet: 0,
    },
    carbon: {
      grid: 0,
      pv: 0,
      total: 0,
      baseline: 0,
      reduction: 0,
      reductionRate: 0,
      intensity: 0,
      perVehicle: 0,
      gridShare: 0,
    },
    score: {
      total: null,
      carbon: 0,
      pv: input.pvShare * 100,
      band: null,
      label: "待评估",
      valid: false,
      pvAvailability: 0,
      pvFeasibility: "low",
      driver: "carbon",
      carbonContribution: 0,
      pvContribution: 0,
    },
    series: emptySeries(),
    warnings: [],
    assumptions: {
      efficiency: input.efficiency,
      gridFactor: input.gridFactor,
      pvFactor: input.pvFactor,
      modelVersion: MODEL_VERSION,
    },
  };
}

function scoreBand(total) {
  return SCORE_BANDS.find(
    ({ min, max }) => total >= min && total <= max,
  ) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

function calculatePvAvailability(windowStart, windowEnd) {
  const duration = windowEnd - windowStart;
  if (duration <= 0) return 0;

  let weightedAvailability = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    const overlap = Math.max(
      0,
      Math.min(hour + 1, windowEnd) - Math.max(hour, windowStart),
    );
    weightedAvailability += overlap * PV_AVAILABILITY[hour];
  }
  return weightedAvailability / duration;
}

function pvFeasibility(availability) {
  if (availability < WARNING_THRESHOLDS.lowPvAvailability) return "low";
  if (availability <= WARNING_THRESHOLDS.mediumPvAvailability) return "medium";
  return "high";
}

function buildWarning(code, severity, message) {
  return { code, severity, message };
}

function warningForInvalidWindow(input) {
  return buildWarning(
    "INVALID_WINDOW",
    "error",
    `充电结束时刻 ${input.windowEnd}:00 必须晚于开始时刻 ${input.windowStart}:00；请修正时段后重新计算。`,
  );
}

function simulateSessions(input, chargingDuration) {
  const { vehicles, chargers, duration, power, windowStart, windowEnd } = input;
  const freeTimes = Array.from({ length: chargers }, () => windowStart);
  const sessions = [];
  const load = HOURS.map(() => 0);

  for (let index = 0; index < vehicles; index += 1) {
    const arrival = windowStart + (index * chargingDuration) / vehicles;
    let selectedCharger = 0;

    for (let chargerIndex = 1; chargerIndex < chargers; chargerIndex += 1) {
      if (freeTimes[chargerIndex] < freeTimes[selectedCharger]) {
        selectedCharger = chargerIndex;
      }
    }

    const start = Math.max(arrival, freeTimes[selectedCharger]);
    if (start < windowEnd) {
      const end = start + duration;
      freeTimes[selectedCharger] = end;
      sessions.push({ arrival, start, end, served: true });

      for (let hour = 0; hour < 24; hour += 1) {
        const overlap = Math.max(
          0,
          Math.min(end, hour + 1) - Math.max(start, hour),
        );
        load[hour] += overlap * power;
      }
    } else {
      sessions.push({ arrival, start: null, end: null, served: false });
    }
  }

  const queue = HOURS.map((hour) => {
    return sessions.reduce((count, session) => {
      const waiting =
        session.arrival <= hour &&
        (!session.served || session.start > hour);
      return count + (waiting ? 1 : 0);
    }, 0);
  });

  return { sessions, load, queue };
}

function evaluateModel(rawInput = {}) {
  const input = serializeInput({ ...DEFAULT_INPUTS, ...rawInput });
  const result = emptyResult(input);
  const chargingDuration = input.windowEnd - input.windowStart;
  const pvAvailability = calculatePvAvailability(
    input.windowStart,
    input.windowEnd,
  );

  result.score.pvAvailability = pvAvailability;
  result.score.pvFeasibility = pvFeasibility(pvAvailability);
  result.score.pv = clamp(input.pvShare, 0, 1) * 100;

  if (chargingDuration <= 0) {
    result.warnings.push(warningForInvalidWindow(input));
    return result;
  }

  if (input.vehicles === 0) {
    result.warnings.push(
      buildWarning(
        "NO_VEHICLES",
        "info",
        "没有需要充电的车辆，无法评估。",
      ),
    );
  }
  if (input.chargers === 0) {
    result.warnings.push(
      buildWarning(
        "NO_CHARGERS",
        "error",
        "当前没有可用充电桩，所有车辆无法服务。",
      ),
    );
  }

  if (input.vehicles > 0) {
    const simulation =
      input.chargers > 0
        ? simulateSessions(input, chargingDuration)
        : {
            sessions: Array.from({ length: input.vehicles }, (_, index) => ({
              arrival:
                input.windowStart +
                (index * chargingDuration) / input.vehicles,
              start: null,
              end: null,
              served: false,
            })),
            load: HOURS.map(() => 0),
            queue: HOURS.map((hour) => {
              return input.vehicles === 0
                ? 0
                : Math.min(
                    input.vehicles,
                    Math.max(
                      0,
                      Math.ceil(
                        ((hour - input.windowStart) * input.vehicles) /
                          chargingDuration,
                      ),
                    ),
                  );
            }),
          };
    const { sessions, load, queue } = simulation;
    const served = sessions.filter((session) => session.served).length;
    const unserved = input.vehicles - served;
    const pileEnergy = served * input.power * input.duration;
    const demandEnergy = input.vehicles * input.power * input.duration;
    const carEnergy = pileEnergy * input.efficiency;
    const pvEnergy = pileEnergy * input.pvShare;
    const gridEnergy = pileEnergy - pvEnergy;
    const gridCarbon = gridEnergy * input.gridFactor;
    const pvCarbon = pvEnergy * input.pvFactor;
    const totalCarbon = gridCarbon + pvCarbon;
    const baselineCarbon = pileEnergy * input.gridFactor;
    const reduction = baselineCarbon - totalCarbon;
    const reductionRate =
      baselineCarbon > 0 ? reduction / baselineCarbon : 0;
    const carbonScore =
      baselineCarbon > 0
        ? 100 * clamp(1 - totalCarbon / baselineCarbon, 0, 1)
        : 0;
    const pvScore = clamp(input.pvShare, 0, 1) * 100;
    const carbonContribution = SCORE_WEIGHTS.carbon * carbonScore;
    const pvContribution = SCORE_WEIGHTS.pv * pvScore;
    const totalScore = carbonContribution + pvContribution;
    const scoreIsValid =
      input.vehicles > 0 && input.chargers > 0 && pileEnergy > 0;
    const band = scoreBand(totalScore);

    result.service = {
      served,
      unserved,
      serviceRate: served / input.vehicles,
      utilization:
        input.chargers > 0
          ? clamp(
              (served * input.duration) /
                (input.chargers * chargingDuration),
              0,
              1,
            )
          : 0,
      peakLoad: Math.max(...load),
      queuePeak: Math.max(...queue),
      arrivalRate: input.vehicles / chargingDuration,
    };
    result.energy = {
      demand: demandEnergy,
      pile: pileEnergy,
      car: carEnergy,
      loss: pileEnergy - carEnergy,
      pv: pvEnergy,
      grid: gridEnergy,
      unmet: unserved * input.power * input.duration,
    };
    result.carbon = {
      grid: gridCarbon,
      pv: pvCarbon,
      total: totalCarbon,
      baseline: baselineCarbon,
      reduction,
      reductionRate,
      intensity: pileEnergy > 0 ? totalCarbon / pileEnergy : 0,
      perVehicle: served > 0 ? totalCarbon / served : 0,
      gridShare: totalCarbon > 0 ? gridCarbon / totalCarbon : 0,
    };
    result.score = {
      total: scoreIsValid ? totalScore : null,
      carbon: carbonScore,
      pv: pvScore,
      band: scoreIsValid ? band.band : null,
      label: scoreIsValid ? band.label : "待评估",
      valid: scoreIsValid,
      pvAvailability,
      pvFeasibility: pvFeasibility(pvAvailability),
      driver:
        carbonContribution >= pvContribution ? "carbon" : "pv",
      carbonContribution,
      pvContribution,
    };
    result.series = {
      hours: [...HOURS],
      load,
      pvPower: load.map((value) => value * input.pvShare),
      gridPower: load.map((value) => value * (1 - input.pvShare)),
      queue,
    };

  }

  if (
    input.vehicles > 0 &&
    result.service.serviceRate < WARNING_THRESHOLDS.serviceRate
  ) {
    result.warnings.push(
      buildWarning(
        "SERVICE_BOTTLENECK",
        "warning",
        `当前有 ${result.service.unserved} 辆车未服务，${result.energy.unmet.toFixed(
          1,
        )} kWh 需求未满足；建议增加桩数或延长充电时段。`,
      ),
    );
  }

  if (input.pvShare >= WARNING_THRESHOLDS.highPvShare) {
    result.warnings.push(
      buildWarning(
        "HIGH_PV_SHARE",
        "warning",
        "高比例光伏对储能和绿电匹配要求较高，请关注阴雨天与夜间保供能力。",
      ),
    );
  }

  if (input.duration >= chargingDuration) {
    result.warnings.push(
      buildWarning(
        "LONG_SESSION",
        "info",
        "单次充电时长不小于充电时段长度，当前时段最多只能完成一轮服务。",
      ),
    );
  }

  if (
    input.pvShare > WARNING_THRESHOLDS.gridShareMajority &&
    pvAvailability < WARNING_THRESHOLDS.lowPvAvailability
  ) {
    result.warnings.push(
      buildWarning(
        "PV_LOW_AVAILABILITY",
        "warning",
        "当前充电时段光伏可用性低；高比例光伏需要储能或绿电支持。结果仍按输入的假设比例计算。",
      ),
    );
  }

  return result;
}

/* ---- js/charts.js ---- */
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 318;
const MARGIN = Object.freeze({ top: 42, right: 16, bottom: 48, left: 56 });
const PLOT_WIDTH = VIEWBOX_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - MARGIN.top - MARGIN.bottom;
const HOUR_TICKS = Object.freeze([0, 3, 6, 9, 12, 15, 18, 21, 23]);

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function appendText(parent, text, x, y, attributes = {}) {
  const node = svgElement("text", { x, y, ...attributes });
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function niceScale(rawMaximum) {
  if (!Number.isFinite(rawMaximum) || rawMaximum <= 0) {
    return { maximum: 1, step: 0.25 };
  }

  const rawStep = rawMaximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceStep * magnitude;
  return {
    maximum: Math.ceil(rawMaximum / step) * step,
    step,
  };
}

function xForHour(hour) {
  return MARGIN.left + ((hour + 0.5) / 24) * PLOT_WIDTH;
}

function yForValue(value, maximum) {
  return MARGIN.top + PLOT_HEIGHT - (value / maximum) * PLOT_HEIGHT;
}

function formatValue(value) {
  return numberFormatter.format(Math.abs(value) < 0.05 ? 0 : value);
}

function drawAxes(svg, maximum, yTitle) {
  const scale = niceScale(maximum);
  const tickCount = Math.round(scale.maximum / scale.step);

  for (let index = 0; index <= tickCount; index += 1) {
    const value = index * scale.step;
    const y = yForValue(value, scale.maximum);
    svg.appendChild(
      svgElement("line", {
        class: "chart-gridline",
        x1: MARGIN.left,
        x2: MARGIN.left + PLOT_WIDTH,
        y1: y,
        y2: y,
      }),
    );
    appendText(svg, formatValue(value), MARGIN.left - 10, y + 3, {
      class: "chart-axis-label",
      "text-anchor": "end",
    });
  }

  svg.appendChild(
    svgElement("line", {
      class: "chart-axis-line",
      x1: MARGIN.left,
      x2: MARGIN.left + PLOT_WIDTH,
      y1: MARGIN.top + PLOT_HEIGHT,
      y2: MARGIN.top + PLOT_HEIGHT,
    }),
  );

  for (const hour of HOUR_TICKS) {
    appendText(svg, String(hour), xForHour(hour), MARGIN.top + PLOT_HEIGHT + 18, {
      class: "chart-axis-label",
      "text-anchor": "middle",
    });
  }

  appendText(svg, "时刻（时）", MARGIN.left + PLOT_WIDTH / 2, VIEWBOX_HEIGHT - 8, {
    class: "chart-axis-title",
    "text-anchor": "middle",
  });
  appendText(svg, yTitle, 14, MARGIN.top + PLOT_HEIGHT / 2, {
    class: "chart-axis-title",
    "text-anchor": "middle",
    transform: `rotate(-90 14 ${MARGIN.top + PLOT_HEIGHT / 2})`,
  });

  return scale;
}

function drawLegend(svg, items) {
  const itemWidths = items.map((item) => 86);
  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0);
  let x = MARGIN.left + PLOT_WIDTH - totalWidth;
  const y = 14;

  for (const item of items) {
    if (item.type === "area") {
      svg.appendChild(
        svgElement("rect", {
          x,
          y: y - 7,
          width: 13,
          height: 8,
          rx: 2,
          fill: item.color,
        }),
      );
    } else {
      svg.appendChild(
        svgElement("line", {
          x1: x,
          x2: x + 14,
          y1: y - 3,
          y2: y - 3,
          stroke: item.color,
          "stroke-width": 2,
          "stroke-linecap": "round",
        }),
      );
    }
    appendText(svg, item.label, x + 19, y, {
      class: "chart-legend-label",
    });
    x += itemWidths[items.indexOf(item)];
  }
}

function addTooltip(container) {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  container.appendChild(tooltip);
  return tooltip;
}

function tooltipRows(rows) {
  return rows
    .map(
      ({ label, value, unit, color }) => `
        <div class="tooltip-row">
          <span><i class="tooltip-swatch" style="background:${color}"></i>${label}</span>
          <span>${formatValue(value)} ${unit}</span>
        </div>
      `,
    )
    .join("");
}

function showTooltip({
  container,
  tooltip,
  svg,
  x,
  y,
  title,
  rows,
}) {
  const svgRect = svg.getBoundingClientRect();
  const scale = svgRect.width / VIEWBOX_WIDTH;
  const desiredLeft = x * scale;
  const desiredTop = Math.max(58, y * scale - 7);
  const boundedLeft = Math.min(
    Math.max(desiredLeft, 80),
    Math.max(80, svgRect.width - 80),
  );

  tooltip.innerHTML = `<strong>${title}</strong>${tooltipRows(rows)}`;
  tooltip.style.left = `${boundedLeft}px`;
  tooltip.style.top = `${desiredTop}px`;
  tooltip.classList.add("is-visible");
  tooltip.setAttribute("aria-hidden", "false");
}

function hideTooltip(tooltip) {
  tooltip.classList.remove("is-visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function attachHover({
  hit,
  svg,
  container,
  tooltip,
  x,
  y,
  title,
  rows,
}) {
  const show = () =>
    showTooltip({ container, tooltip, svg, x, y, title, rows });
  hit.addEventListener("pointerenter", show);
  hit.addEventListener("focus", show);
  hit.addEventListener("pointerleave", () => hideTooltip(tooltip));
  hit.addEventListener("blur", () => hideTooltip(tooltip));
}

function makeEmptyState(container, message) {
  container.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "chart-empty";

  const icon = document.createElement("span");
  icon.className = "chart-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "∿";

  const copy = document.createElement("span");
  copy.textContent = message;
  empty.append(icon, copy);
  container.appendChild(empty);
}

function renderBarChart(container, result) {
  const { series } = result;
  if (!series.load.some((value) => value > 0)) {
    makeEmptyState(container, "当前配置没有可评估的充电负荷");
    return;
  }

  container.replaceChildren();
  const svg = svgElement("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  const maxStack = Math.max(
    ...series.load.map(
      (_, hour) => series.pvPower[hour] + series.gridPower[hour],
    ),
  );
  const scale = drawAxes(svg, maxStack, "电量（kWh）");
  drawLegend(svg, [
    { label: "光伏供电", type: "line", color: CHART_COLORS.pv },
    { label: "电网购电", type: "line", color: CHART_COLORS.grid },
  ]);

  const slotWidth = PLOT_WIDTH / 24;
  const barWidth = Math.min(17, slotWidth * 0.62);
  const tooltip = addTooltip(container);
  const baseY = MARGIN.top + PLOT_HEIGHT;

  for (let hour = 0; hour < 24; hour += 1) {
    const pvValue = series.pvPower[hour];
    const gridValue = series.gridPower[hour];
    const loadValue = series.load[hour];
    const pvHeight =
      (pvValue / scale.maximum) * PLOT_HEIGHT;
    const gridHeight =
      (gridValue / scale.maximum) * PLOT_HEIGHT;
    const barX = MARGIN.left + hour * slotWidth + (slotWidth - barWidth) / 2;
    const topY = baseY - pvHeight - gridHeight;
    const group = svgElement("g", {
      class: "chart-bar-group",
    });

    const hit = svgElement("rect", {
      class: "chart-hit",
      x: MARGIN.left + hour * slotWidth,
      y: MARGIN.top,
      width: slotWidth,
      height: PLOT_HEIGHT,
      tabindex: "0",
      role: "button",
      "aria-label": `${hour} 时至 ${hour + 1} 时，负荷 ${formatValue(
        loadValue,
      )} 千瓦时，光伏 ${formatValue(pvValue)} 千瓦时，电网 ${formatValue(
        gridValue,
      )} 千瓦时`,
    });
    group.appendChild(hit);

    if (pvHeight > 0) {
      group.appendChild(
        svgElement("rect", {
          class: "chart-bar",
          x: barX,
          y: baseY - pvHeight,
          width: barWidth,
          height: Math.max(pvHeight, 0.6),
          rx: 2,
          fill: CHART_COLORS.pv,
        }),
      );
    }
    if (gridHeight > 0) {
      group.appendChild(
        svgElement("rect", {
          class: "chart-bar",
          x: barX,
          y: topY,
          width: barWidth,
          height: Math.max(gridHeight, 0.6),
          rx: 2,
          fill: CHART_COLORS.grid,
        }),
      );
    }

    svg.appendChild(group);
    attachHover({
      hit,
      svg,
      container,
      tooltip,
      x: xForHour(hour),
      y: topY,
      title: `${String(hour).padStart(2, "0")}:00–${String(
        hour + 1,
      ).padStart(2, "0")}:00`,
      rows: [
        {
          label: "负荷",
          value: loadValue,
          unit: "kWh",
          color: CHART_COLORS.load,
        },
        {
          label: "光伏电量",
          value: pvValue,
          unit: "kWh",
          color: CHART_COLORS.pv,
        },
        {
          label: "电网电量",
          value: gridValue,
          unit: "kWh",
          color: CHART_COLORS.grid,
        },
      ],
    });
  }

  container.appendChild(svg);
}

function linePath(values, maximum) {
  return values
    .map((value, hour) => {
      const x = xForHour(hour);
      const y = yForValue(value, maximum);
      return `${hour === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function gridAreaPath(load, pv, maximum) {
  const top = loadPath(load, maximum);
  const bottom = [...pv]
    .map((_, index) => 23 - index)
    .map((hour) => {
      const x = xForHour(hour);
      const y = yForValue(pv[hour], maximum);
      return `L ${x} ${y}`;
    })
    .join(" ");
  return `${top} ${bottom} Z`;
}

function loadPath(values, maximum) {
  return values
    .map((value, hour) => {
      const x = xForHour(hour);
      const y = yForValue(value, maximum);
      return `${hour === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function renderLineChart(container, result) {
  const { series } = result;
  if (!series.load.some((value) => value > 0)) {
    makeEmptyState(container, "当前配置没有可评估的充电负荷");
    return;
  }

  container.replaceChildren();
  const svg = svgElement("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  const scale = drawAxes(svg, Math.max(...series.load), "功率（kW）");
  drawLegend(svg, [
    { label: "充电负荷", type: "line", color: CHART_COLORS.load },
    { label: "光伏功率", type: "line", color: CHART_COLORS.pv },
    { label: "电网购电", type: "area", color: CHART_COLORS.gridFill },
  ]);
  svg.appendChild(
    svgElement("path", {
      class: "chart-grid-area",
      d: gridAreaPath(series.load, series.pvPower, scale.maximum),
    }),
  );
  svg.appendChild(
    svgElement("path", {
      class: "chart-line-pv",
      d: linePath(series.pvPower, scale.maximum),
    }),
  );
  svg.appendChild(
    svgElement("path", {
      class: "chart-line-load",
      d: linePath(series.load, scale.maximum),
    }),
  );

  const tooltip = addTooltip(container);
  const slotWidth = PLOT_WIDTH / 24;
  for (let hour = 0; hour < 24; hour += 1) {
    const x = xForHour(hour);
    const hit = svgElement("rect", {
      class: "chart-hit",
      x: MARGIN.left + hour * slotWidth,
      y: MARGIN.top,
      width: slotWidth,
      height: PLOT_HEIGHT,
      tabindex: "0",
      role: "button",
      "aria-label": `${hour} 时，负荷 ${formatValue(
        series.load[hour],
      )} 千瓦，光伏 ${formatValue(
        series.pvPower[hour],
      )} 千瓦，电网 ${formatValue(series.gridPower[hour])} 千瓦`,
    });
    const hoverLine = svgElement("line", {
      class: "chart-hover-line",
      x1: x,
      x2: x,
      y1: MARGIN.top,
      y2: MARGIN.top + PLOT_HEIGHT,
    });
    svg.append(hit, hoverLine);
    attachHover({
      hit,
      svg,
      container,
      tooltip,
      x,
      y: yForValue(series.load[hour], scale.maximum),
      title: `${String(hour).padStart(2, "0")}:00 时刻`,
      rows: [
        {
          label: "充电负荷",
          value: series.load[hour],
          unit: "kW",
          color: CHART_COLORS.load,
        },
        {
          label: "光伏功率",
          value: series.pvPower[hour],
          unit: "kW",
          color: CHART_COLORS.pv,
        },
        {
          label: "电网功率",
          value: series.gridPower[hour],
          unit: "kW",
          color: CHART_COLORS.grid,
        },
      ],
    });
  }

  container.appendChild(svg);
}

function getContainers() {
  return {
    bar: document.getElementById("bar-chart"),
    line: document.getElementById("line-chart"),
  };
}

function renderCharts(result) {
  const containers = getContainers();
  if (!containers.bar || !containers.line) return;
  renderBarChart(containers.bar, result);
  renderLineChart(containers.line, result);
}

function renderEmptyCharts(message) {
  const containers = getContainers();
  if (!containers.bar || !containers.line) return;
  makeEmptyState(containers.bar, message);
  makeEmptyState(containers.line, message);
}

/* ---- js/ui.js ---- */
const decimalFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const scoreFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function formatDecimal(value) {
  return decimalFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatScore(value) {
  return scoreFormatter.format(value);
}

function createStatusItem(code, severity, message) {
  const item = document.createElement("div");
  item.className = `status-item status-${severity}`;
  item.dataset.code = code;

  const icon = document.createElement("span");
  icon.className = "status-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent =
    severity === "error"
      ? "×"
      : severity === "warning"
        ? "!"
        : severity === "info"
          ? "i"
          : "✓";

  const copy = document.createElement("span");
  copy.className = "status-copy";
  copy.textContent = message;

  item.append(icon, copy);
  return item;
}

function renderWarnings(result) {
  const area = byId("warning-area");
  if (!area) return;
  area.replaceChildren();

  if (result.warnings.length === 0) {
    area.appendChild(
      createStatusItem(
        "CONFIGURATION_OK",
        "ok",
        "当前配置未触发模型警告。结果按输入的运行假设估算。",
      ),
    );
    return;
  }

  for (const warning of result.warnings) {
    area.appendChild(
      createStatusItem(warning.code, warning.severity, warning.message),
    );
  }
}

function updateScoreCard(result) {
  const { score, service } = result;
  const hasScore = score.valid && score.total !== null;
  setText("kpi-score", hasScore ? formatScore(score.total) : "—");
  setText("score-band", hasScore ? score.label : "待评估");
  setText(
    "score-breakdown",
    `碳绩效 ${formatDecimal(score.carbon)} / 光伏 ${formatDecimal(score.pv)}`,
  );

  const driverCopy =
    score.driver === "pv"
      ? "总分主要受光伏消纳牵引，提高光伏占比的边际贡献更明显。"
      : "总分主要受碳绩效牵引，剩余电网购电仍是主要改善空间。";
  setText("score-driver", hasScore ? driverCopy : "等待有效输入");

  const meter = byId("score-meter-fill");
  if (meter) {
    meter.style.width = hasScore
      ? `${Math.min(100, Math.max(0, score.total))}%`
      : "0%";
  }

  const serviceNote = byId("score-service-note");
  if (serviceNote) {
    const showNote =
      result.input.vehicles > 0 &&
      service.serviceRate < WARNING_THRESHOLDS.serviceRate;
    serviceNote.hidden = !showNote;
    serviceNote.textContent = showNote
      ? `低碳评分仅针对已服务车辆，当前有 ${service.unserved} 辆车未服务。`
      : "";
  }
}

function updateKpis(result) {
  const { energy, carbon, service } = result;
  setText("kpi-energy", formatDecimal(energy.pile));
  setText("kpi-carbon", formatDecimal(carbon.total));

  const reduction = byId("kpi-reduction");
  if (reduction) {
    if (carbon.baseline > 0) {
      const direction = carbon.reduction >= 0 ? "下降" : "上升";
      reduction.textContent = `${direction} ${formatDecimal(
        Math.abs(carbon.reductionRate) * 100,
      )}%`;
    } else {
      reduction.textContent = "暂无可比基准";
    }
  }

  setText("kpi-service", formatDecimal(service.serviceRate * 100));
  setText(
    "kpi-service-caption",
    `未服务 ${service.unserved} 辆`,
  );
  updateScoreCard(result);
}

function updateSecondaryMetrics(result) {
  const { energy, carbon, service } = result;
  setText("metric-pv", formatDecimal(energy.pv));
  setText("metric-grid", formatDecimal(energy.grid));
  setText("metric-intensity", formatDecimal(carbon.intensity * 1000));
  setText("metric-peak", formatDecimal(service.peakLoad));
  setText("metric-loss", formatDecimal(energy.loss));
  setText("metric-unmet", formatDecimal(energy.unmet));
}

function updateFeasibility(result) {
  const badge = byId("pv-feasibility");
  if (!badge) return;
  const labels = {
    low: "低",
    medium: "中",
    high: "高",
  };
  const level = result.score.pvFeasibility;
  badge.className = `feasibility-badge feasibility-${level}`;
  badge.textContent = `时段光伏可行性：${labels[level]}`;
  badge.title = `充电时段平均光伏可用性 ${formatDecimal(
    result.score.pvAvailability * 100,
  )}%`;
}

function buildConclusions(result) {
  const conclusions = [];
  const noVehicles = result.warnings.some(
    (warning) => warning.code === "NO_VEHICLES",
  );

  if (noVehicles) {
    conclusions.push("当前没有需要充电的车辆，请补充车辆规模后再进行评估。");
  } else if (
    result.service.serviceRate < WARNING_THRESHOLDS.serviceRate
  ) {
    conclusions.push(
      `桩数是当前瓶颈：${result.service.unserved} 辆车未服务，${formatDecimal(
        result.energy.unmet,
      )} kWh 需求未满足；优先增加桩数或延长充电时段。`,
    );
  } else if (
    result.carbon.gridShare > WARNING_THRESHOLDS.gridShareMajority
  ) {
    conclusions.push(
      `电网购电仍是主要碳源，占碳排的 ${formatDecimal(
        result.carbon.gridShare * 100,
      )}%；提高光伏比例或绿电采购的边际收益最大。`,
    );
  } else if (result.input.pvShare >= WARNING_THRESHOLDS.highPvShare) {
    conclusions.push(
      "光伏已覆盖大部分电量，下一步重点关注储能配置、阴雨天和夜间保供。",
    );
  } else {
    conclusions.push(
      "当前配置服务完整，可继续比较光伏比例和桩数的边际收益。",
    );
  }

  if (result.service.peakLoad > 0 && conclusions.length < 3) {
    conclusions.push(
      `峰值负荷为 ${formatDecimal(
        result.service.peakLoad,
      )} kW，请核对配电容量。`,
    );
  }

  if (
    result.score.pvFeasibility === "low" &&
    conclusions.length < 3
  ) {
    conclusions.push(
      "当前时段光伏可用性偏低，高比例光伏结论需要结合储能或绿电合同校验。",
    );
  }

  return conclusions.slice(0, 3);
}

function updateConclusions(result) {
  const list = byId("conclusion-list");
  if (!list) return;
  list.replaceChildren();

  for (const conclusion of buildConclusions(result)) {
    const item = document.createElement("li");
    item.textContent = conclusion;
    list.appendChild(item);
  }
}

function updateAssumptions(result) {
  setText("assumption-version", `v${result.assumptions.modelVersion}`);
  setText(
    "assumption-efficiency",
    result.assumptions.efficiency.toFixed(2),
  );
  setText(
    "assumption-grid-factor",
    `${result.assumptions.gridFactor.toFixed(2)} kgCO₂e/kWh`,
  );
  setText(
    "assumption-pv-factor",
    `${result.assumptions.pvFactor.toFixed(3)} kgCO₂e/kWh`,
  );
}

function renderResults(result) {
  renderWarnings(result);
  updateKpis(result);
  updateSecondaryMetrics(result);
  updateFeasibility(result);
  updateConclusions(result);
  updateAssumptions(result);
}

function setAllResultNumbersToDash() {
  const placeholders = [
    "kpi-energy",
    "kpi-carbon",
    "kpi-score",
    "kpi-service",
    "metric-pv",
    "metric-grid",
    "metric-intensity",
    "metric-peak",
    "metric-loss",
    "metric-unmet",
  ];
  for (const id of placeholders) setText(id, "—");

  setText("score-band", "待评估");
  setText("score-breakdown", "碳绩效 — / 光伏 —");
  setText("score-driver", "等待有效输入");
  setText("kpi-service-caption", "未服务 — 辆");
  setText("kpi-reduction", "等待有效输入");
  setText("assumption-efficiency", "—");
  setText("assumption-grid-factor", "—");
  setText("assumption-pv-factor", "—");

  const meter = byId("score-meter-fill");
  if (meter) meter.style.width = "0%";
  const serviceNote = byId("score-service-note");
  if (serviceNote) {
    serviceNote.hidden = true;
    serviceNote.textContent = "";
  }
}

function renderInvalidState(messages) {
  setAllResultNumbersToDash();

  const area = byId("warning-area");
  if (area) {
    area.replaceChildren();
    const summary = messages.join("；");
    area.appendChild(
      createStatusItem(
        "INVALID_INPUT",
        "error",
        `请修正输入后再计算。${summary ? ` ${summary}` : ""}`,
      ),
    );
  }

  const badge = byId("pv-feasibility");
  if (badge) {
    badge.className = "feasibility-badge feasibility-medium";
    badge.textContent = "时段光伏可行性：待评估";
    badge.removeAttribute("title");
  }

  const list = byId("conclusion-list");
  if (list) {
    list.replaceChildren();
    const item = document.createElement("li");
    item.className = "is-empty";
    item.textContent = "修正输入后将根据运行结果生成结论与建议。";
    list.appendChild(item);
  }

  setText("assumption-version", `v${MODEL_VERSION}`);
}

function setFieldError(fieldKey, message) {
  const field = document.querySelector(`[data-field="${fieldKey}"]`);
  if (!field) return;
  const error = field.querySelector(".field-error");
  const inputs = field.querySelectorAll("input");
  field.classList.toggle("has-error", Boolean(message));
  if (error) error.textContent = message;
  for (const input of inputs) {
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
}

function clearFieldErrors() {
  for (const field of document.querySelectorAll(".parameter-control")) {
    setFieldError(field.dataset.field, "");
  }
}

/* ---- js/app.js ---- */
const numberInputs = new Map(
  [...document.querySelectorAll(".number-input")].map((input) => [
    input.dataset.key,
    input,
  ]),
);
const rangeInputs = new Map(
  [...document.querySelectorAll(".range-input")].map((input) => [
    input.dataset.key,
    input,
  ]),
);
const form = document.getElementById("parameter-form");
const presetButtons = [...document.querySelectorAll(".preset-button")];

let currentResult = null;

function decimalPlaces(step) {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

function displayValue(key, modelValue) {
  const scale = INPUT_RANGES[key].displayScale;
  const step = INPUT_RANGES[key].step;
  return Number((modelValue * scale).toFixed(decimalPlaces(step)));
}

function displayRange(key) {
  const range = INPUT_RANGES[key];
  return {
    min: range.min * range.displayScale,
    max: range.max * range.displayScale,
    step: range.step * range.displayScale,
    unit: range.unit,
  };
}

function updateRangeFill(range) {
  const min = Number(range.min);
  const max = Number(range.max);
  const value = Number(range.value);
  const percent =
    max > min && Number.isFinite(value)
      ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
      : 0;
  range.style.setProperty("--range-fill", `${percent}%`);
}

function syncInputsFromObject(values, activePreset = null) {
  for (const [key, input] of numberInputs) {
    const value = displayValue(key, values[key]);
    input.value = String(value);
    const range = rangeInputs.get(key);
    if (range) {
      range.value = String(value);
      updateRangeFill(range);
    }
  }

  if (activePreset) {
    for (const button of presetButtons) {
      button.classList.toggle("is-active", button.dataset.preset === activePreset);
    }
  }
}

function syncRangeToNumber(range) {
  const number = numberInputs.get(range.dataset.key);
  if (number) number.value = range.value;
  updateRangeFill(range);
}

function syncNumberToRange(input) {
  const range = rangeInputs.get(input.dataset.key);
  if (!range || input.value.trim() === "") return;
  const value = Number(input.value);
  const min = Number(range.min);
  const max = Number(range.max);
  if (Number.isFinite(value) && value >= min && value <= max) {
    range.value = String(value);
    updateRangeFill(range);
  }
}

function readDisplayValues() {
  const values = {};
  for (const [key, input] of numberInputs) {
    values[key] =
      input.value.trim() === "" ? Number.NaN : Number(input.value);
  }
  return values;
}

function rangeError(key) {
  const range = displayRange(key);
  const unit = range.unit && range.unit !== "—" ? ` ${range.unit}` : "";
  return `请输入 ${range.min}–${range.max}${unit} 范围内的值`;
}

function validateValues(displayValues) {
  clearFieldErrors();
  const errors = [];
  const validKeys = new Set();

  for (const key of Object.keys(DEFAULT_INPUTS)) {
    const range = displayRange(key);
    const value = displayValues[key];
    if (
      !Number.isFinite(value) ||
      value < range.min ||
      value > range.max
    ) {
      const message = Number.isFinite(value)
        ? rangeError(key)
        : "请输入有效数字";
      setFieldError(key, message);
      errors.push(message);
    } else {
      validKeys.add(key);
    }
  }

  if (
    validKeys.has("windowStart") &&
    validKeys.has("windowEnd") &&
    displayValues.windowEnd <= displayValues.windowStart
  ) {
    const message = "结束时刻必须晚于开始时刻";
    setFieldError("windowStart", message);
    setFieldError("windowEnd", message);
    errors.push(message);
  }

  return [...new Set(errors)];
}

function toModelInput(displayValues) {
  return Object.fromEntries(
    Object.keys(DEFAULT_INPUTS).map((key) => [
      key,
      key === "pvShare"
        ? displayValues[key] / INPUT_RANGES[key].displayScale
        : displayValues[key],
    ]),
  );
}

function updateActivePreset(modelInput) {
  let matchedPreset = null;
  for (const [presetKey, preset] of Object.entries(PRESETS)) {
    const matches = Object.entries(preset.values).every(([key, value]) => {
      const step = INPUT_RANGES[key].step;
      return Math.abs(modelInput[key] - value) < step / 2;
    });
    if (matches) {
      matchedPreset = presetKey;
      break;
    }
  }

  for (const button of presetButtons) {
    button.classList.toggle(
      "is-active",
      button.dataset.preset === matchedPreset,
    );
  }
}

function showValidationState(errors) {
  currentResult = null;
  renderInvalidState(errors);
  renderEmptyCharts("请修正输入后查看图表");
}

function evaluateAndRender() {
  const displayValues = readDisplayValues();
  const errors = validateValues(displayValues);

  if (errors.length > 0) {
    showValidationState(errors);
    return;
  }

  const modelInput = toModelInput(displayValues);
  const result = evaluateModel(modelInput);
  currentResult = result;
  renderResults(result);
  renderCharts(result);
  updateActivePreset(modelInput);
}

function scheduleEvaluation() {
  evaluateAndRender();
}

function handleInputEvent(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  if (input.classList.contains("range-input")) {
    syncRangeToNumber(input);
  } else if (input.classList.contains("number-input")) {
    syncNumberToRange(input);
  } else {
    return;
  }

  scheduleEvaluation();
}

function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;
  syncInputsFromObject(preset.values, presetKey);
  evaluateAndRender();
}

function initialize() {
  document.getElementById("model-version").textContent = `v${MODEL_VERSION}`;
  document.getElementById("header-version").textContent = `v${MODEL_VERSION}`;

  form.addEventListener("input", handleInputEvent);
  form.addEventListener("submit", (event) => event.preventDefault());

  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset);
    });
  }

  document.getElementById("reset-button").addEventListener("click", () => {
    syncInputsFromObject(DEFAULT_INPUTS, "office");
    evaluateAndRender();
  });

  document.getElementById("print-button").addEventListener("click", () => {
    window.print();
  });

  syncInputsFromObject(DEFAULT_INPUTS, "office");
  evaluateAndRender();
}

initialize();
window.__PARKING_APP_READY__ = true;
})();
