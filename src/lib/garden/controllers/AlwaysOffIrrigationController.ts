import { IrrigationController, Simulation } from "../types";

/**
 * Always-on irrigation controller: always returns true to keep irrigation on
 */
export class AlwaysOffIrrigationController implements IrrigationController {
  decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
    return false;
  }
}
