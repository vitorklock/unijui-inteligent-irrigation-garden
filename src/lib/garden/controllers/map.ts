import { DumbIrrigationController } from "./";
import { ManualIrrigationController } from "./";
import { AlwaysOnIrrigationController } from "./";

export const CONTROLLERS = {
  dumb: DumbIrrigationController,
  manual: ManualIrrigationController,
  alwaysOn: AlwaysOnIrrigationController,
} as const;

export type ControllerKey = keyof typeof CONTROLLERS;