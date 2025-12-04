import { IrrigationController, Simulation } from "../types";
import { IDEAL_MIN_MOISTURE } from "../consts";

/**
 * Dumb irrigation controller: irrigates if dry percentage is above threshold, otherwise off.
 * Now uses threshold logic for dry/wet ratios and avgMoisture.
 */
export class DumbIrrigationController implements IrrigationController {
  private moistureLow: number;
  private moistureHigh: number;

  constructor(moistureLow: number = IDEAL_MIN_MOISTURE, moistureHigh: number = 1) {
    this.moistureLow = moistureLow;
    this.moistureHigh = moistureHigh;
  }

  /**
   * Decide on irrigation based on current metrics
   * @param metrics Simulation.Metrics
   * @param state Simulation.State
   */
  decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
    // Irrigate if percentTooDry is above 0.2
    if (metrics.percentTooDry > 0.2) return true;
    // Turn off if percentTooWet is above 0.3
    if (metrics.percentTooWet > 0.3) return false;
    // Otherwise, irrigate if avgMoisture is below moistureLow
    return metrics.avgMoisture < this.moistureLow;
  }
}
