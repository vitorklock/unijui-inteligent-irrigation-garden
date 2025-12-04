import { useMemo } from "react";
import { Garden, Simulation } from "./types";
import { IDEAL_MAX_MOISTURE, IDEAL_MIN_MOISTURE, TICKS_PER_DAY } from "./consts";

/** Compute all metrics from the current garden state */
export function useGardenMetrics(state: Simulation.State, garden: Garden): Simulation.Metrics {
    // useMemo to avoid re-computation if state hasn't changed since last render
    return useMemo(() => {
        const { irrigationOn, lastIrrigationTick, tick, episodeLength, cumulativeWaterUsed, waterUsedThisTick } = state;

        const { tiles } = garden;

        // Flatten the 2D tiles array to iterate easily over all plants
        const allTiles = tiles.flat();
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;
        let dryCount = 0;
        let wetCount = 0;
        const totalPlants = allTiles.length;
        for (const tile of allTiles) {
            const m = tile.moisture;
            sum += m;
            if (m < min) min = m;
            if (m > max) max = m;
            if (m < IDEAL_MIN_MOISTURE) dryCount++;
            if (m > IDEAL_MAX_MOISTURE) wetCount++;
        }
        const avg = totalPlants > 0 ? sum / totalPlants : 0;
        // Calculate percentage of plants in dry/wet categories
        const percentDry = totalPlants > 0 ? Math.round((dryCount / totalPlants) * 100) : 0;
        const percentWet = totalPlants > 0 ? Math.round((wetCount / totalPlants) * 100) : 0;
        // Calculate ticks since last irrigation (0 if currently irrigating)
        const ticksSince = irrigationOn ? 0 : (tick - lastIrrigationTick);
        // Compute normalized time of day (assuming TICKS_PER_DAY constitutes a full day cycle)
        const timeOfDay = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;
        // Compute episode progress (fraction of total ticks completed, 0–1)
        const progress = episodeLength > 0 ? Math.min(tick / episodeLength, 1) : 0;
        return {
            avgMoisture: avg,
            minMoisture: min === Infinity ? 0 : min,
            maxMoisture: max === -Infinity ? 0 : max,
            percentTooDry: percentDry,
            percentTooWet: percentWet,
            irrigationOn: irrigationOn,
            ticksSinceLastIrrigation: ticksSince,
            timeOfDay: timeOfDay,
            episodeProgress: progress,
            waterUsedThisTick: waterUsedThisTick,
            cumulativeWaterUsed: cumulativeWaterUsed
        };
    }, [state]);
}