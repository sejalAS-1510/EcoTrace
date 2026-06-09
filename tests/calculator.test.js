import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateFootprint,
  categorizeFootprint,
  getReductionTips,
  validateInput,
  getTipsDetails,
  MAX_VALUE,
  EMISSION_FACTORS,
} from "../src/calculator.js";

test("validateInput rejects non-numeric, negative, and oversized values", () => {
  const result = validateInput({
    carKmPerWeek: "-1",
    publicKmPerWeek: "abc",
    electricityKwhPerMonth: "100",
    wasteKgPerWeek: "3",
    meatMealsPerWeek: "5",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.carKmPerWeek, "Value must be non-negative.");
  assert.equal(result.errors.publicKmPerWeek, "A valid number is required.");
});

test("validateInput rejects empty or missing values", () => {
  const result = validateInput({
    carKmPerWeek: "",
    publicKmPerWeek: " ",
    electricityKwhPerMonth: null,
    wasteKgPerWeek: "3",
    meatMealsPerWeek: "5",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.carKmPerWeek, "This field is required. Enter 0 if not applicable.");
  assert.equal(result.errors.publicKmPerWeek, "This field is required. Enter 0 if not applicable.");
  assert.equal(result.errors.electricityKwhPerMonth, "This field is required. Enter 0 if not applicable.");
});

test("validateInput rejects values exceeding MAX_VALUE", () => {
  const result = validateInput({
    carKmPerWeek: MAX_VALUE + 1,
    publicKmPerWeek: "0",
    electricityKwhPerMonth: "0",
    wasteKgPerWeek: "0",
    meatMealsPerWeek: "0",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.carKmPerWeek.includes("Value must be lower than"));
});

test("calculateFootprint returns expected monthly total", () => {
  const validated = validateInput({
    carKmPerWeek: 30,
    publicKmPerWeek: 20,
    electricityKwhPerMonth: 120,
    wasteKgPerWeek: 4,
    meatMealsPerWeek: 7,
  });

  assert.equal(validated.valid, true);

  const result = calculateFootprint(validated.value);

  // Expected calculations:
  // car: 30 * 0.21 * 4.345 = 27.3735 -> rounded: 27.37
  // publicTransport: 20 * 0.08 * 4.345 = 6.952 -> rounded: 6.95
  // electricity: 120 * 0.417 = 50.04 -> rounded: 50.04
  // waste: 4 * 0.57 * 4.345 = 9.9066 -> rounded: 9.91
  // food: 7 * 2.5 * 4.345 = 76.0375 -> rounded: 76.04
  // Sum = 27.37 + 6.95 + 50.04 + 9.91 + 76.04 = 170.31
  assert.equal(result.totalKgCo2ePerMonth, 170.31);
  assert.deepEqual(Object.keys(result.components).sort(), [
    "car",
    "electricity",
    "food",
    "publicTransport",
    "waste",
  ]);
});

test("categorizeFootprint and getReductionTips are stable", () => {
  assert.equal(categorizeFootprint(299.99), "Low");
  assert.equal(categorizeFootprint(300), "Moderate");
  assert.equal(categorizeFootprint(699.9), "Moderate");
  assert.equal(categorizeFootprint(700), "High");

  const tips = getReductionTips({
    car: 90,
    publicTransport: 10,
    electricity: 80,
    waste: 20,
    food: 30,
  });

  assert.deepEqual(tips, [
    "Prefer cycling, carpooling, or one work-from-home day each week.",
    "Switch to LED lighting and unplug idle devices to reduce electricity use.",
  ]);
});

test("getTipsDetails calculates and sorts tips by savings correctly", () => {
  const inputs = {
    carKmPerWeek: 100,
    publicKmPerWeek: 50,
    electricityKwhPerMonth: 200,
    wasteKgPerWeek: 10,
    meatMealsPerWeek: 4,
  };

  const validated = validateInput(inputs);
  assert.equal(validated.valid, true);

  const footprint = calculateFootprint(validated.value);
  const tipsDetails = getTipsDetails(footprint.components, validated.value);

  // Tips should be ordered by savings (descending)
  for (let i = 0; i < tipsDetails.length - 1; i++) {
    assert.ok(tipsDetails[i].savings >= tipsDetails[i + 1].savings);
  }

  // Check individual savings calculations:
  // Food: Math.min(3, 4) * 2.5 * 4.345 = 3 * 2.5 * 4.345 = 32.5875 -> 32.59 kg
  const foodTip = tipsDetails.find((t) => t.id === "food");
  assert.equal(foodTip.savings, 32.59);

  // Car: 100 * 0.21 * 4.345 = 91.245. 20% of that is 18.249 -> 18.25 kg
  const carTip = tipsDetails.find((t) => t.id === "car");
  assert.equal(carTip.savings, 18.25);
});
