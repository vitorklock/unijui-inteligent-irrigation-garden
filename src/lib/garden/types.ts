
export namespace Garden {

    export interface Position {
        x: number
        y: number
    }

    export namespace Tile {
        export type Type =
            | "soil"
            | "path"
            | "pillar"
            | "water_source"
    }

    export interface Tile extends Position {
        type: Tile.Type
        hasPlant: boolean
        moisture: number  // 0 = dry, 1 = ideal, >1 = flooded
    }

    export interface HosePath {
        id: string
        source: Position
        target: Position
        tiles: Position[] // ordered positions from source to target
    }

}

export interface Garden {
    width: number
    height: number
    tiles: Garden.Tile[][] // tiles[y][x]
    hoses: Garden.HosePath[]
    seed?: number // Optional: seed used for deterministic generation
}

export namespace Weather {

    export interface State {
        /** °C, e.g. 0–40 */
        temperature: number
        /** 0–1, relative humidity */
        humidity: number
        /** 0–1, 0 = night, 1 = full sun */
        sunIntensity: number
        /** 0–1, 0 = no rain, 1 = heavy rain */
        rainIntensity: number
    }
}

export namespace Simulation {

    /** Static parameters for the moisture simulation */
    export interface Config {
        /** Moisture added per tick at hose tiles when irrigation is ON */
        irrigationRate: number
        /** Base evaporation rate per tick at neutral weather */
        baseEvaporationRate: number
        /** How strongly moisture diffuses between neighbors (0–0.5) */
        diffusionRate: number
        /** Multiplier for rain → soil moisture */
        rainToMoisture: number
        /** Maximum moisture before we clamp (visual flooding can still be 1.2+ etc.) */
        maxMoisture: number
        /** Coverage radius for hose watering (Manhattan distance) */
        coverageRadius: number
    }

    export interface State {
        tick: number
        isRunning: boolean
        irrigationOn: boolean
        weather: Weather.State
        config: Simulation.Config
        episodeLength: number
        forecast: number[]
        waterUsedThisTick: number
        lastIrrigationTick: number
        cumulativeWaterUsed: number
        // Accumulators for episode results
        dryPlantTicks?: number
        floodedPlantTicks?: number
        healthyPlantTicks?: number
        peakSimultaneousFloodedPlants?: number
        peakSimultaneousDryPlants?: number
        // Results are produced once an episode finishes
        results?: Results
    }

    export interface Metrics {
        avgMoisture: number
        minMoisture: number
        maxMoisture: number
        percentTooDry: number   // % of plants with moisture < IDEAL_MIN_MOISTURE
        percentTooWet: number   // % of plants with moisture > IDEAL_MAX_MOISTURE
        irrigationOn: boolean
        ticksSinceLastIrrigation: number
        timeOfDay: number       // normalized time of day [0–1]
        episodeProgress: number // progress of the episode [0–1]
        waterUsedThisTick: number
        cumulativeWaterUsed: number
    }

    export interface Results {
        totalWaterUsed: number
        dryPlantTicks: number
        floodedPlantTicks: number
        healthyPlantTicks: number
        peakSimultaneousFloodedPlants: number
        peakSimultaneousDryPlants: number
        tickCount: number
        finalScore: number
        totalPlantTicks: number
    }

}