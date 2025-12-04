import {
    AlwaysOffIrrigationController,
    DumbIrrigationController,
    ManualIrrigationController,
    AlwaysOnIrrigationController,
} from "./";

export const CONTROLLERS = {
    dumb: DumbIrrigationController,
    manual: ManualIrrigationController,
    alwaysOn: AlwaysOnIrrigationController,
    alwaysOff: AlwaysOffIrrigationController,
} as const;

export type ControllerKey = keyof typeof CONTROLLERS | 'smart';