import { Simulation, Weather } from "../../types";

/**
 * Helper to clamp a value to [0, 1]
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Triangular membership function for fuzzy sets.
 *
 * @param x - The input value
 * @param a - Left support (0 before this)
 * @param b - Peak (1 at this)
 * @param c - Right support (0 after this)
 * @returns Membership value in [0, 1]
 */
function tri(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

export interface FuzzyRisks {
  /** 0–1: How dry is the garden? Higher = more dryness risk */
  drynessRisk: number;
  /** 0–1: How wet/flooded is the garden? Higher = more flood risk */
  floodRisk: number;
}

/**
 * FuzzyClimateEvaluator
 *
 * Uses simple fuzzy logic to interpret current weather, soil metrics, and forecast
 * into two actionable risk scores: drynessRisk and floodRisk.
 *
 * Rules are based on common sense observations:
 * - Hot, sunny, dry air → high dryness risk
 * - Many dry plants + no rain forecast → high dryness risk
 * - Many wet plants or heavy rain → flood risk
 * - Cool, low sun, high humidity → low evaporation → flood risk
 */
export class FuzzyClimateEvaluator {
  /**
   * Evaluate current conditions and return fuzzy risk scores.
   *
   * @param metrics - Current simulation metrics (percentTooDry, percentTooWet, etc.)
   * @param weather - Current weather state (temperature, humidity, sun, rain)
   * @param forecast - Array of predicted rain intensities for the next N ticks
   * @returns FuzzyRisks with drynessRisk and floodRisk in [0, 1]
   */
  evaluate(
    metrics: Simulation.Metrics,
    weather: Weather.State,
    forecast: number[]
  ): FuzzyRisks {
    // Normalize inputs to [0, 1] ranges
    const tempNorm = clamp01(weather.temperature / 40); // assume 0–40°C
    const humNorm = clamp01(weather.humidity); // already 0–1
    const sunNorm = clamp01(weather.sunIntensity); // 0–1
    const rainNow = clamp01(weather.rainIntensity); // 0–1

    // Approximate "rain in near future" as max of forecast values
    const forecastRainSoon = clamp01(
      Math.max(0, ...forecast.map(clamp01))
    );

    // --- Fuzzy membership functions ---

    // Temperature sets
    const tempHigh = tri(tempNorm, 0.5, 0.8, 1.0);
    const tempLow = tri(tempNorm, 0.0, 0.2, 0.4);
    const tempMed = tri(tempNorm, 0.3, 0.5, 0.7);

    // Humidity sets (low humidity = high (1 - humNorm))
    const humLow = tri(1 - humNorm, 0.3, 0.7, 1.0);
    const humHigh = tri(humNorm, 0.5, 0.8, 1.0);

    // Sun sets
    const sunHigh = tri(sunNorm, 0.5, 0.8, 1.0);
    const sunLow = tri(sunNorm, 0.0, 0.2, 0.4);
    const sunMed = tri(sunNorm, 0.3, 0.5, 0.7);

    // Rain sets
    const rainNowHigh = tri(rainNow, 0.3, 0.7, 1.0);
    const rainSoonHigh = tri(forecastRainSoon, 0.3, 0.7, 1.0);

    // Soil moisture sets (convert from 0-100 to 0-1 range)
    const percentTooDry = clamp01(metrics.percentTooDry / 100);
    const percentTooWet = clamp01(metrics.percentTooWet / 100);

    // --- Fuzzy rules for drynessRisk ---

    // Rule 1: Hot + sunny + dry air => very high dryness risk
    const ruleDry1 = Math.min(tempHigh, sunHigh, humLow);

    // Rule 2: Many dry plants already + no rain now or soon
    const noRainSoon = clamp01(1 - Math.max(rainNowHigh, rainSoonHigh));
    const ruleDry2 = Math.min(percentTooDry, noRainSoon);

    // Rule 3: Moderate risk when temp and sun are both medium
    const ruleDry3 = Math.min(tempMed, sunMed);

    let drynessRisk = Math.max(ruleDry1, ruleDry2, ruleDry3);

    // --- Fuzzy rules for floodRisk ---

    // Rule 1: Many wet plants already OR current rain is heavy
    const ruleFlood1 = Math.max(percentTooWet, rainNowHigh);

    // Rule 2: Rain coming soon AND garden is already somewhat wet
    const alreadyWet = tri(percentTooWet, 0.1, 0.3, 0.8);
    const ruleFlood2 = Math.min(alreadyWet, rainSoonHigh);

    // Rule 3: Cool + low sun + high humidity => low evaporation => water accumulates
    const ruleFlood3 = Math.min(tempLow, sunLow, humHigh);

    let floodRisk = Math.max(ruleFlood1, ruleFlood2, ruleFlood3);

    // Final clamping to ensure [0, 1]
    drynessRisk = clamp01(drynessRisk);
    floodRisk = clamp01(floodRisk);

    return { drynessRisk, floodRisk };
  }
}
