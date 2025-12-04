/**
 * ControllerParams
 *
 * These parameters are evolved by a Genetic Algorithm offline.
 * The GA explores different weight combinations to find the best balance
 * between maintaining plant health, avoiding flooding, and minimizing water usage.
 */
export interface ControllerParams {
  // Cost weights (evolved by GA)
  /** Penalty per unit of dryness (0-1) in predicted future state */
  drynessWeight: number;
  /** Penalty per unit of flood risk (0-1) from fuzzy evaluator */
  floodWeight: number;
  /** Penalty for using water (cost of turning irrigation ON) */
  waterWeight: number;

  // Neural network prediction horizon
  /** How many ticks ahead the NN should "think" (e.g., 10, 20) */
  predictionHorizonTicks: number;

  // Fuzzy logic scaling / sensitivity
  /** Scales the drynessRisk into cost component (0-1) */
  fuzzyDrynessScale: number;
  /** Scales the floodRisk into cost component (0-1) */
  fuzzyFloodScale: number;

  // Hysteresis / stability constraints
  /** Minimum ticks between irrigation toggling to avoid flicker (e.g., 5, 10) */
  minTicksBetweenToggles: number;
  /** Maximum fraction of episode with irrigation ON (0-1); enforced as hard cap */
  maxDutyCycle: number;
}

/**
 * Default safe parameters for the SmartIrrigationController.
 * These are reasonable starting values; GA will optimize these further.
 */
export const DEFAULT_CONTROLLER_PARAMS: ControllerParams = {
  drynessWeight: 1.5,
  floodWeight: 1.0,
  waterWeight: 0.3,
  predictionHorizonTicks: 10,
  fuzzyDrynessScale: 0.5,
  fuzzyFloodScale: 0.4,
  minTicksBetweenToggles: 3,
  maxDutyCycle: 0.6,
};
