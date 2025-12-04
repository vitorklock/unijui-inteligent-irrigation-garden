"use client";

import React, { useState, useEffect } from "react";
import { CONTROLLERS, ControllerKey } from "../controllers/map";

interface SavedTraining {
  id: string;
  name: string;
  timestamp: string;
}

interface ControllerSelectorProps {
  controllerKey: ControllerKey;
  selectedTrainingId: string | null;
  onControllerChange: (controllerKey: ControllerKey) => void;
  onTrainingChange: (trainingId: string | null) => void;
  disabled?: boolean;
  /** If true, filters out 'manual' from the controller options */
  excludeManual?: boolean;
  /** If true, shows full date in training selector, otherwise just name */
  showTrainingDate?: boolean;
  /** Custom class for the controller select */
  controllerClassName?: string;
  /** Custom class for the training select */
  trainingClassName?: string;
}

/**
 * Reusable controller selector component that handles:
 * - Controller type selection (manual, dumb, alwaysOn, alwaysOff, smart)
 * - Training model selection (when smart controller is selected)
 * - Fetching available trainings from API
 */
export const ControllerSelector: React.FC<ControllerSelectorProps> = ({
  controllerKey,
  selectedTrainingId,
  onControllerChange,
  onTrainingChange,
  disabled = false,
  excludeManual = false,
  showTrainingDate = false,
  controllerClassName = "rounded-md border px-2 h-8 text-xs",
  trainingClassName = "rounded-md border px-2 h-8 text-xs",
}) => {
  const [trainings, setTrainings] = useState<SavedTraining[]>([]);

  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const response = await fetch('/api/trainings');
        if (response.ok) {
          const data = await response.json();
          setTrainings(data.trainings || []);
        }
      } catch (err) {
        console.error('Failed to fetch trainings:', err);
      }
    };
    fetchTrainings();
  }, []);

  const controllerKeys = Object.keys(CONTROLLERS).filter(
    k => !excludeManual || k !== 'manual'
  );

  return (
    <>
      {/* Controller Selection */}
      <select
        className={controllerClassName}
        value={controllerKey}
        onChange={(e) => onControllerChange(e.target.value as ControllerKey)}
        disabled={disabled}
      >
        {controllerKeys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
        <option value="smart">smart</option>
      </select>

      {/* Training Selection (only for smart controller) */}
      {controllerKey === 'smart' && (
        <select
          className={trainingClassName}
          value={selectedTrainingId || ''}
          onChange={(e) => onTrainingChange(e.target.value || null)}
          disabled={disabled}
        >
          <option value="">Default Parameters</option>
          {trainings.map((t) => (
            <option key={t.id} value={t.id}>
              {showTrainingDate
                ? `${t.name} (${new Date(t.timestamp).toLocaleDateString()})`
                : t.name
              }
            </option>
          ))}
        </select>
      )}
    </>
  );
};
