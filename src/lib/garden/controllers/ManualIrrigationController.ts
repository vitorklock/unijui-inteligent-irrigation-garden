import { IrrigationController, Simulation } from "../types";

/**
 * Manual irrigation controller that allows external state to control irrigation
 */
export class ManualIrrigationController implements IrrigationController {
    private irrigationEnabled: boolean = false;

    /**
     * Set whether irrigation should be on or off
     */
    setIrrigation(enabled: boolean): void {
        this.irrigationEnabled = enabled;
    }

    /**
     * Get current irrigation state
     */
    isIrrigationEnabled(): boolean {
        return this.irrigationEnabled;
    }

    /**
     * Decide on irrigation based on the manually set state
     */
    decide(): boolean {
        return this.irrigationEnabled;
    }
}
