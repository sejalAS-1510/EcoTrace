/**
 * Carbon Footprint Calculator Utilities
 * Contains validation, calculations, categories, and action planner logic.
 */

/**
 * Maximum allowable value for numeric input fields to prevent overflow.
 * @type {number}
 */
export const MAX_VALUE = 1_000_000;

/**
 * Emission factors (in kg CO2e) and calendar constants.
 * @type {Readonly<{carKgPerKm: number, publicKgPerKm: number, electricityKgPerKwh: number, wasteKgPerKg: number, meatMealKgPerMeal: number, weeksPerMonth: number}>}
 */
export const EMISSION_FACTORS = Object.freeze({
  carKgPerKm: 0.21,
  publicKgPerKm: 0.08,
  electricityKgPerKwh: 0.417,
  wasteKgPerKg: 0.57,
  meatMealKgPerMeal: 2.5,
  weeksPerMonth: 4.345,
});

/**
 * List of expected numeric field names from the calculator form.
 * @type {ReadonlyArray<string>}
 */
export const NUMERIC_FIELDS = Object.freeze([
  "carKmPerWeek",
  "publicKmPerWeek",
  "electricityKwhPerMonth",
  "wasteKgPerWeek",
  "meatMealsPerWeek",
]);

/**
 * Benchmarks for comparison (in kg CO2e / month)
 * @type {Readonly<{GLOBAL_TARGET: number, WORLD_AVERAGE: number, US_AVERAGE: number}>}
 */
export const BENCHMARKS = Object.freeze({
  GLOBAL_TARGET: 150,     // UN climate target per person
  WORLD_AVERAGE: 400,     // Global average per person
  US_AVERAGE: 1300,       // High emitting countries average
});

/**
 * Rounds a number to two decimal places.
 * @param {number} value
 * @returns {number}
 */
export function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Validates form inputs for numeric correctness and bounds.
 * @param {Record<string, string|number>} input - Raw values from the form.
 * @returns {{valid: boolean, errors?: Record<string, string>, value?: Record<string, number>}}
 */
export function validateInput(input) {
  const errors = {};
  const value = {};

  for (const field of NUMERIC_FIELDS) {
    const raw = input[field];
    
    // Check for empty inputs and map to 0 or flag as required
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      errors[field] = "This field is required. Enter 0 if not applicable.";
      continue;
    }

    const numericValue = Number(raw);

    if (!Number.isFinite(numericValue)) {
      errors[field] = "A valid number is required.";
      continue;
    }

    if (numericValue < 0) {
      errors[field] = "Value must be non-negative.";
      continue;
    }

    if (numericValue > MAX_VALUE) {
      errors[field] = `Value must be lower than ${MAX_VALUE.toLocaleString()}.`;
      continue;
    }

    value[field] = numericValue;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value };
}

/**
 * Calculates carbon footprint components and total emissions.
 * @param {Record<string, number>} validatedInput
 * @returns {{totalKgCo2ePerMonth: number, components: Record<string, number>}}
 */
export function calculateFootprint(validatedInput) {
  const car = (validatedInput.carKmPerWeek || 0) * EMISSION_FACTORS.carKgPerKm * EMISSION_FACTORS.weeksPerMonth;
  const publicTransport =
    (validatedInput.publicKmPerWeek || 0) * EMISSION_FACTORS.publicKgPerKm * EMISSION_FACTORS.weeksPerMonth;
  const electricity = (validatedInput.electricityKwhPerMonth || 0) * EMISSION_FACTORS.electricityKgPerKwh;
  const waste = (validatedInput.wasteKgPerWeek || 0) * EMISSION_FACTORS.wasteKgPerKg * EMISSION_FACTORS.weeksPerMonth;
  const food = (validatedInput.meatMealsPerWeek || 0) * EMISSION_FACTORS.meatMealKgPerMeal * EMISSION_FACTORS.weeksPerMonth;

  const components = {
    car: roundToTwo(car),
    publicTransport: roundToTwo(publicTransport),
    electricity: roundToTwo(electricity),
    waste: roundToTwo(waste),
    food: roundToTwo(food),
  };

  const totalKgCo2ePerMonth = roundToTwo(
    components.car + components.publicTransport + components.electricity + components.waste + components.food
  );

  return {
    totalKgCo2ePerMonth,
    components,
  };
}

/**
 * Categorizes a footprint total into Low, Moderate, or High.
 * @param {number} totalKgCo2ePerMonth
 * @returns {string}
 */
export function categorizeFootprint(totalKgCo2ePerMonth) {
  if (totalKgCo2ePerMonth < 300) {
    return "Low";
  }

  if (totalKgCo2ePerMonth < 700) {
    return "Moderate";
  }

  return "High";
}

/**
 * Legacy support for top 2 reduction tips (returns plain text array).
 * @param {Record<string, number>} components
 * @returns {string[]}
 */
export function getReductionTips(components) {
  const sortedSources = Object.entries(components)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([key]) => key);

  const tipsBySource = {
    car: "Prefer cycling, carpooling, or one work-from-home day each week.",
    publicTransport: "Combine routes and avoid unnecessary long commutes where possible.",
    electricity: "Switch to LED lighting and unplug idle devices to reduce electricity use.",
    waste: "Compost organic waste and reduce single-use packaging.",
    food: "Try replacing a few meat-based meals with plant-based alternatives.",
  };

  return sortedSources.map((source) => tipsBySource[source]);
}

/**
 * Rich recommendation engine for the Interactive Planner.
 * Estimates custom monthly carbon savings based on user's exact inputs.
 * @param {Record<string, number>} components - Calculated footprint components.
 * @param {Record<string, number>} inputs - User's validated raw inputs.
 * @returns {Array<{id: string, title: string, description: string, savings: number, category: string, icon: string}>}
 */
export function getTipsDetails(components, inputs) {
  const carSavings = roundToTwo(components.car * 0.20); // 20% reduction from carpooling/telecommuting
  const publicSavings = roundToTwo(components.publicTransport * 0.15); // 15% transit route optimization
  const electricitySavings = roundToTwo(components.electricity * 0.15); // 15% LED and device standby savings
  const wasteSavings = roundToTwo(components.waste * 0.30); // 30% composting and package reduction
  
  const meatMeals = inputs.meatMealsPerWeek || 0;
  const foodSavings = roundToTwo(
    Math.min(3, meatMeals) * EMISSION_FACTORS.meatMealKgPerMeal * EMISSION_FACTORS.weeksPerMonth
  ); // Replacing up to 3 meat meals per week

  const allTips = [
    {
      id: "car",
      title: "Telecommute or Carpool",
      description: "Swap driving for cycling, carpooling, or work from home 1 day/week. Saves 20% of driving emissions.",
      savings: carSavings,
      category: "Transport",
      icon: "car",
    },
    {
      id: "publicTransport",
      title: "Optimize Travel Routes",
      description: "Combine routes, walk short distances, or switch to rail when possible. Saves 15% of transit emissions.",
      savings: publicSavings,
      category: "Transport",
      icon: "bus",
    },
    {
      id: "electricity",
      title: "Energy-Saving Lights & Habits",
      description: "Switch to LED bulbs, wash clothes in cold water, and unplug idle electronics. Saves 15% of energy emissions.",
      savings: electricitySavings,
      category: "Home",
      icon: "lightning",
    },
    {
      id: "waste",
      title: "Compost & Zero-Waste Goals",
      description: "Compost food scraps, recycle metal/glass, and buy bulk to reduce packaging. Saves 30% of waste emissions.",
      savings: wasteSavings,
      category: "Waste",
      icon: "trash",
    },
    {
      id: "food",
      title: "Eat More Plant-Based Meals",
      description: "Swap 3 meat-based meals per week with vegetarian or vegan alternatives. Saves up to 2.5 kg CO₂e per meal.",
      savings: foodSavings,
      category: "Food",
      icon: "food",
    },
  ];

  // Return tips sorted by their potential savings (descending) to show highest impact first
  return allTips.sort((a, b) => b.savings - a.savings);
}
