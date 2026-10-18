import {
  MODEL_VERSION,
  WARNING_THRESHOLDS,
} from "./config.js";

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

export function renderWarnings(result) {
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

export function renderResults(result) {
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

export function renderInvalidState(messages) {
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

export function setFieldError(fieldKey, message) {
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

export function clearFieldErrors() {
  for (const field of document.querySelectorAll(".parameter-control")) {
    setFieldError(field.dataset.field, "");
  }
}
