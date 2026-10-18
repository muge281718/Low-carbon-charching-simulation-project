export const MODEL_VERSION = "0.1.0";

export const DEFAULT_INPUTS = Object.freeze({
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

export const INPUT_RANGES = Object.freeze({
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

export const PRESETS = Object.freeze({
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

export const PV_AVAILABILITY = Object.freeze([
  0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1, 0.95, 0.85, 0.7,
  0.5, 0.3, 0.1, 0, 0, 0, 0, 0,
]);

export const SCORE_WEIGHTS = Object.freeze({
  carbon: 0.7,
  pv: 0.3,
});

export const SCORE_BANDS = Object.freeze([
  { min: 80, max: 100, band: "excellent", label: "优秀" },
  { min: 60, max: 79.999, band: "good", label: "良好" },
  { min: 40, max: 59.999, band: "fair", label: "一般" },
  { min: 0, max: 39.999, band: "high-carbon", label: "高碳" },
]);

export const WARNING_THRESHOLDS = Object.freeze({
  serviceRate: 0.9,
  highPvShare: 0.8,
  lowPvAvailability: 0.15,
  mediumPvAvailability: 0.45,
  gridShareMajority: 0.5,
});

export const CHART_COLORS = Object.freeze({
  load: "#246bfd",
  pv: "#36a269",
  grid: "#9aa5b5",
  gridFill: "rgba(143, 153, 169, 0.2)",
  axis: "#7b8493",
  gridLine: "#e6e9ee",
  text: "#162033",
});

export const UI_COLORS = Object.freeze({
  accent: "#246bfd",
  accentSoft: "#eaf0ff",
  pv: "#2f9e67",
  warning: "#b86f08",
  danger: "#c73b43",
});
