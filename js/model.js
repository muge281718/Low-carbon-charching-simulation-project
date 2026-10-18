import {
  DEFAULT_INPUTS,
  MODEL_VERSION,
  PV_AVAILABILITY,
  SCORE_BANDS,
  SCORE_WEIGHTS,
  WARNING_THRESHOLDS,
} from "./config.js";

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

export function evaluateModel(rawInput = {}) {
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

export default evaluateModel;
