import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_INPUTS } from "../js/config.js";
import { evaluateModel } from "../js/model.js";

const EPSILON = 0.0001;

function closeTo(actual, expected, message, tolerance = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function hasWarning(result, code) {
  return result.warnings.some((warning) => warning.code === code);
}

test("default office scenario matches acceptance numbers", () => {
  const result = evaluateModel(DEFAULT_INPUTS);

  assert.equal(result.service.served, 40);
  assert.equal(result.service.unserved, 0);
  closeTo(result.service.serviceRate, 1, "service rate");
  closeTo(result.service.utilization, 0.8, "utilization");
  closeTo(result.service.peakLoad, 56, "peak load");
  closeTo(result.energy.pile, 560, "pile energy");
  closeTo(result.energy.car, 515.2, "car energy");
  closeTo(result.energy.loss, 44.8, "charging loss");
  closeTo(result.energy.pv, 336, "PV energy");
  closeTo(result.energy.grid, 224, "grid energy");
  closeTo(result.carbon.total, 140, "total carbon");
  closeTo(result.carbon.baseline, 324.8, "baseline carbon");
  closeTo(result.carbon.reductionRate, 0.56897, "reduction rate", 0.00001);
  closeTo(result.carbon.intensity * 1000, 250, "carbon intensity");
  closeTo(result.score.carbon, 56.897, "carbon score", 0.001);
  closeTo(result.score.pv, 60, "PV score");
  closeTo(result.score.total, 57.828, "total score", 0.001);
  assert.equal(Math.round(result.score.total), 58);
  assert.equal(result.score.label, "一般");
  assert.equal(result.score.valid, true);
});

test("80% PV scenario matches carbon and score acceptance numbers", () => {
  const result = evaluateModel({ ...DEFAULT_INPUTS, pvShare: 0.8 });

  closeTo(result.energy.pv, 448, "PV energy");
  closeTo(result.energy.grid, 112, "grid energy");
  closeTo(result.carbon.total, 78.4, "total carbon");
  closeTo(result.carbon.reductionRate, 0.75862, "reduction rate", 0.00001);
  closeTo(result.score.carbon, 75.862, "carbon score", 0.001);
  closeTo(result.score.total, 77.103, "total score", 0.001);
  assert.equal(Math.round(result.score.total), 77);
  assert.equal(result.score.label, "良好");
});

test("80 vehicles scenario exposes service bottleneck", () => {
  const result = evaluateModel({ ...DEFAULT_INPUTS, vehicles: 80 });

  assert.equal(result.service.served, 50);
  assert.equal(result.service.unserved, 30);
  closeTo(result.service.serviceRate, 0.625, "service rate");
  closeTo(result.energy.unmet, 420, "unmet energy");
  closeTo(result.energy.pile, 700, "pile energy");
  closeTo(result.energy.pv, 420, "PV energy");
  closeTo(result.energy.grid, 280, "grid energy");
  closeTo(result.carbon.total, 175, "total carbon");
  closeTo(result.carbon.baseline, 406, "baseline carbon");
  closeTo(result.carbon.reductionRate, 0.56897, "reduction rate", 0.00001);
  assert.equal(Math.round(result.score.total), 58);
  closeTo(result.service.peakLoad, 70, "peak load");
  assert.equal(result.service.queuePeak, 30);
  assert.equal(hasWarning(result, "SERVICE_BOTTLENECK"), true);
});

test("zero PV share has zero carbon performance score", () => {
  const result = evaluateModel({ ...DEFAULT_INPUTS, pvShare: 0 });

  closeTo(result.carbon.total, result.carbon.baseline, "total equals baseline");
  closeTo(result.score.carbon, 0, "carbon score");
  closeTo(result.score.total, 0, "total score");
});

test("100% PV with zero PV factor reaches 100 points", () => {
  const result = evaluateModel({
    ...DEFAULT_INPUTS,
    pvShare: 1,
    pvFactor: 0,
  });

  closeTo(result.carbon.total, 0, "total carbon");
  closeTo(result.carbon.reductionRate, 1, "reduction rate");
  closeTo(result.score.carbon, 100, "carbon score");
  closeTo(result.score.total, 100, "total score");
  assert.equal(result.score.label, "优秀");
});

test("energy remains conserved across both allocation boundaries", () => {
  const result = evaluateModel({ ...DEFAULT_INPUTS, vehicles: 83 });

  closeTo(result.energy.pv + result.energy.grid, result.energy.pile, "PV plus grid");
  closeTo(result.energy.car + result.energy.loss, result.energy.pile, "car plus loss");
});

test("service rate and utilization stay within 0 to 1", () => {
  const cases = [
    DEFAULT_INPUTS,
    { ...DEFAULT_INPUTS, vehicles: 0 },
    { ...DEFAULT_INPUTS, chargers: 0 },
    { ...DEFAULT_INPUTS, vehicles: 500, chargers: 1 },
  ];

  for (const input of cases) {
    const result = evaluateModel(input);
    assert.ok(result.service.serviceRate >= 0 && result.service.serviceRate <= 1);
    assert.ok(result.service.utilization >= 0 && result.service.utilization <= 1);
  }
});

test("zero vehicles and zero chargers produce finite safe results", () => {
  const noVehicles = evaluateModel({ ...DEFAULT_INPUTS, vehicles: 0 });
  const noChargers = evaluateModel({ ...DEFAULT_INPUTS, chargers: 0 });

  for (const result of [noVehicles, noChargers]) {
    assert.equal(result.score.total, null);
    assert.equal(result.score.valid, false);
    for (const series of Object.values(result.series)) {
      assert.ok(series.every(Number.isFinite));
    }
    const numericValues = JSON.stringify(result).match(/NaN|Infinity/g);
    assert.equal(numericValues, null);
  }

  assert.equal(hasWarning(noVehicles, "NO_VEHICLES"), true);
  assert.equal(hasWarning(noChargers, "NO_CHARGERS"), true);
  assert.equal(noChargers.service.unserved, 40);
  closeTo(noChargers.energy.unmet, 560, "unmet energy without chargers");
});

test("nighttime high PV share triggers low availability warning without changing assumptions", () => {
  const result = evaluateModel({
    ...DEFAULT_INPUTS,
    windowStart: 20,
    windowEnd: 24,
    pvShare: 0.8,
  });

  assert.equal(hasWarning(result, "PV_LOW_AVAILABILITY"), true);
  assert.equal(result.score.pvFeasibility, "low");
  closeTo(result.input.pvShare, 0.8, "input PV share");
  closeTo(result.energy.pv, result.energy.pile * 0.8, "assumed PV energy");
  closeTo(result.energy.grid, result.energy.pile * 0.2, "assumed grid energy");
});

test("higher PV share never lowers carbon or total score", () => {
  let previousCarbon = -1;
  let previousTotal = -1;

  for (const pvShare of [0, 0.2, 0.5, 0.6, 0.8, 1]) {
    const result = evaluateModel({ ...DEFAULT_INPUTS, pvShare });
    assert.ok(result.score.carbon >= previousCarbon);
    assert.ok(result.score.total >= previousTotal);
    previousCarbon = result.score.carbon;
    previousTotal = result.score.total;
  }
});

test("invalid window returns an explicit validation warning and zeroed chart series", () => {
  const result = evaluateModel({
    ...DEFAULT_INPUTS,
    windowStart: 18,
    windowEnd: 8,
  });

  assert.equal(result.score.total, null);
  assert.equal(hasWarning(result, "INVALID_WINDOW"), true);
  assert.equal(result.service.served, 0);
  assert.ok(result.series.load.every((value) => value === 0));
  assert.ok(
    [...result.series.load, ...result.series.pvPower, ...result.series.gridPower].every(
      Number.isFinite,
    ),
  );
});

test("long session warning applies at the boundary", () => {
  const result = evaluateModel({
    ...DEFAULT_INPUTS,
    duration: 2,
    windowStart: 8,
    windowEnd: 10,
  });
  assert.equal(hasWarning(result, "LONG_SESSION"), true);
});
