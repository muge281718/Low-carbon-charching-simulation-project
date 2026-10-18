import {
  DEFAULT_INPUTS,
  INPUT_RANGES,
  MODEL_VERSION,
  PRESETS,
} from "./config.js";
import { renderCharts, renderEmptyCharts } from "./charts.js";
import { evaluateModel } from "./model.js";
import {
  clearFieldErrors,
  renderInvalidState,
  renderResults,
  setFieldError,
} from "./ui.js";

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
