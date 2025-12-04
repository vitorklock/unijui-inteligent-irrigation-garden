import { IrrigationController, Simulation } from "../../types";
import { FuzzyClimateEvaluator } from "./FuzzyClimateEvaluator";
import { HumidityPredictorNN } from "./HumidityPredictorNN";
import { ControllerParams } from "./types";

/**
 * SmartIrrigationController
 *
 * A sophisticated controller that combines three AI techniques:
 *
 * 1. **Fuzzy Logic** (FuzzyClimateEvaluator)
 *    - Interprets weather + metrics into abstract risk scores
 *    - Outputs: drynessRisk [0-1], floodRisk [0-1]
 *
 * 2. **Neural Network** (HumidityPredictorNN)
 *    - Predicts future dryness in two scenarios (irrigation OFF vs ON)
 *    - Allows the controller to anticipate outcomes before deciding
 *
 * 3. **Genetic Algorithm** (parameter evolution, external)
 *    - ControllerParams are evolved offline to balance:
 *      * dryness penalty
 *      * flood penalty
 *      * water usage penalty
 *    - At runtime, the controller just uses the best evolved params
 *
 * Decision process per tick:
 * 1. Evaluate fuzzy risks from current weather/metrics
 * 2. Predict future dryness for OFF and ON scenarios
 * 3. Score each action using GA-tuned weights
 * 4. Apply safety constraints (hysteresis, water caps, flood limits)
 * 5. Return the chosen action
 */
export class SmartIrrigationController implements IrrigationController {
  private fuzzy: FuzzyClimateEvaluator;
  private nn: HumidityPredictorNN;
  private params: ControllerParams;

  /**
   * Create a SmartIrrigationController.
   *
   * @param fuzzy - FuzzyClimateEvaluator instance
   * @param nn - HumidityPredictorNN instance
   * @param params - GA-optimized ControllerParams
   */
  constructor(
    fuzzy: FuzzyClimateEvaluator,
    nn: HumidityPredictorNN,
    params: ControllerParams
  ) {
    this.fuzzy = fuzzy;
    this.nn = nn;
    this.params = params;
  }

  /**
   * Main decision logic: should irrigation be ON?
   *
   * @param metrics - Current simulation metrics
   * @param state - Current simulation state
   * @returns true if irrigation should be ON, false if OFF
   */
  decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
    const { weather, forecast } = state;
    const {
      drynessWeight,
      floodWeight,
      waterWeight,
      fuzzyDrynessScale,
      fuzzyFloodScale,
      minTicksBetweenToggles,
      maxDutyCycle,
    } = this.params;

    // --- 1. Hysteresis: Check timing constraints ---

    const ticksSinceLast = metrics.ticksSinceLastIrrigation;

    // Compute duty cycle: fraction of episode with irrigation ON
    const dutyCycle =
      state.irrigationOnTicks > 0
        ? state.irrigationOnTicks / Math.max(1, state.tick)
        : 0;

    // If we've already used too much water, disable irrigation unless extremely dry
    const hardWaterCapReached = dutyCycle > maxDutyCycle;

    // --- 2. Evaluate fuzzy risks ---

    const { drynessRisk, floodRisk } = this.fuzzy.evaluate(
      metrics,
      weather,
      forecast
    );

    // --- 3. Predict future dryness for two scenarios ---

    // Scenario A: What if irrigation stays OFF?
    const futureDryOff = this.nn.predictFutureDryness(
      metrics,
      weather,
      state,
      0
    );

    // Scenario B: What if irrigation turns ON?
    const futureDryOn = this.nn.predictFutureDryness(
      metrics,
      weather,
      state,
      1
    );

    // --- 4. Compute cost for each action ---

    // Cost of turning irrigation OFF
    const costOff =
      drynessWeight * futureDryOff + // penalty for predicted future dryness
      floodWeight * (floodRisk * fuzzyFloodScale) + // penalty for flood risk
      0; // no water usage if off

    // Cost of turning irrigation ON
    const costOn =
      drynessWeight * futureDryOn + // penalty for predicted future dryness (lower if NN learns irrigation helps)
      floodWeight * (floodRisk * fuzzyFloodScale) + // penalty for flood risk
      waterWeight; // penalty for using water

    // --- 5. Raw decision based purely on cost comparison ---

    let wantIrrigationOn = costOn < costOff;

    // --- 6. Safety constraints and hysteresis ---

    // SAFETY 1: If flood risk is very high, force OFF
    if (floodRisk > 0.7) {
      wantIrrigationOn = false;
    }

    // SAFETY 2: If water cap is reached, stay OFF unless extremely dry
    if (hardWaterCapReached && drynessRisk < 0.9 && futureDryOff < 0.9) {
      wantIrrigationOn = false;
    }

    // HYSTERESIS: Avoid toggling too frequently
    if (ticksSinceLast < minTicksBetweenToggles) {
      if (state.irrigationOn) {
        // Currently ON: keep ON unless flood risk is very high
        if (floodRisk > 0.6) {
          return false;
        }
        return true;
      } else {
        // Currently OFF: keep OFF unless dryness is extreme
        if (drynessRisk > 0.9 || futureDryOff > 0.9) {
          return true;
        }
        return false;
      }
    }

    return wantIrrigationOn;
  }
}
