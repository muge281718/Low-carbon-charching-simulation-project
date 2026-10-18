import { CHART_COLORS } from "./config.js";

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

export function renderCharts(result) {
  const containers = getContainers();
  if (!containers.bar || !containers.line) return;
  renderBarChart(containers.bar, result);
  renderLineChart(containers.line, result);
}

export function renderEmptyCharts(message) {
  const containers = getContainers();
  if (!containers.bar || !containers.line) return;
  makeEmptyState(containers.bar, message);
  makeEmptyState(containers.line, message);
}
