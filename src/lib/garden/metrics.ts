import { useMemo } from "react";
import { Garden, Simulation } from "./types";
import { IDEAL_MAX_MOISTURE, IDEAL_MIN_MOISTURE, TICKS_PER_DAY } from "./consts";

/** Compute metrics */
export function computeGardenMetrics(state: Simulation.State, garden: Garden): Simulation.Metrics {
    const { irrigationOn, lastIrrigationTick, tick, episodeLength, cumulativeWaterUsed, waterUsedThisTick } = state;

    const plantTiles = garden.tiles.flat().filter((t) => t.hasPlant);

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let dryCount = 0;
    let wetCount = 0;

    for (const tile of plantTiles) {
        const m = tile.moisture;
        sum += m;
        if (m < min) min = m;
        if (m > max) max = m;
        if (m < IDEAL_MIN_MOISTURE) dryCount++;
        if (m > IDEAL_MAX_MOISTURE) wetCount++;
    }

    const totalPlants = plantTiles.length;
    const avg = totalPlants > 0 ? sum / totalPlants : 0;
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
}

/** Compute all metrics from the current garden state (React hook version) */
export function useGardenMetrics(state: Simulation.State, garden: Garden): Simulation.Metrics {
    // useMemo to avoid re-computation if state hasn't changed since last render
    return useMemo(() => {
        return computeGardenMetrics(state, garden);
    }, [state, garden]);
}