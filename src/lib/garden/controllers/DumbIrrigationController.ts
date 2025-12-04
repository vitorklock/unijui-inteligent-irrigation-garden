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
    // Turn off immediately if flooding is detected (> 5% of plants)
    if (metrics.percentTooWet > 5) return false;
    
    // Only irrigate if significant dryness (> 15% of plants) AND average moisture is low
    if (metrics.percentTooDry > 15 && metrics.avgMoisture < this.moistureHigh) return true;
    
    // Otherwise stay off to prevent flooding
    return false;
  }
}
