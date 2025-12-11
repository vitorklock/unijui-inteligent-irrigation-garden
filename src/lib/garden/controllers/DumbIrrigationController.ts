import { IrrigationController, Simulation } from "../types";
import { IDEAL_MIN_MOISTURE } from "../consts";

export class DumbIrrigationController implements IrrigationController {
  private moistureLow: number;
  private moistureHigh: number;

  constructor(moistureLow: number = IDEAL_MIN_MOISTURE, moistureHigh: number = 0.85) {
    this.moistureLow = moistureLow;
    this.moistureHigh = moistureHigh;
  }

  /**
   * Decide on irrigation based on current metrics
   * @param metrics Simulation.Metrics
   * @param state Simulation.State
   */
  decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
    
    // Only cut water when things are clearly saturated to allow for occasional overwatering
    if (metrics.percentTooWet > 30 && metrics.avgMoisture > this.moistureHigh) return false;

    // Irrigate eagerly whenever dryness is noticeable
    if (metrics.percentTooDry > 12) return true;

    // Keep watering if the average moisture is still close to or below the desired floor
    if (metrics.avgMoisture < this.moistureLow + 0.05) return true;

    // Even without obvious dryness, continue watering until the garden looks fairly wet
    if (metrics.percentTooWet < 20 && metrics.avgMoisture < this.moistureHigh) return true;

    return false;
  }
}
