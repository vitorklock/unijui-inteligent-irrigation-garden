// lib/garden/simulation.ts
import { mulberry32 } from "../utils";
import { TICKS_PER_DAY } from "./consts";
import { Garden, Garden as GardenNS, Simulation, Weather } from "./types";

interface StepParams {
    garden: Garden;
    config: Simulation.Config;
    weather: Weather.State;
    irrigationOn: boolean;
}

/**
 * One simulation tick: update moisture based on irrigation, weather, diffusion.
 * Returns a NEW Garden (tiles array cloned), only moisture changes.
 */
export function stepGardenMoisture(params: StepParams): Garden {
    const { garden, config, weather, irrigationOn } = params;
    const { width, height } = garden;

    // Quick references
    const tiles = garden.tiles;

    // Precompute hose tiles as a boolean grid
    const hoseMask: boolean[][] = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => false)
    );

    for (const hose of garden.hoses) {
        for (const p of hose.tiles) {
            if (
                p.y >= 0 &&
                p.y < height &&
                p.x >= 0 &&
                p.x < width &&
                tiles[p.y][p.x].type !== "pillar"
            ) {
                hoseMask[p.y][p.x] = true;
            }
        }
    }

    // Clone tiles shallowly, but we will replace each tile with a copy when updating
    const newTiles: GardenNS.Tile[][] = tiles.map((row) => row.slice() as GardenNS.Tile[]);

    // Extract current moisture into a numeric grid for easier math
    const moisture: number[][] = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => tiles[y][x].moisture ?? 0)
    );

    // ---- 1. Irrigation + rain (source terms) ----
    const { irrigationRate, rainToMoisture, baseEvaporationRate, maxMoisture } = config;

    // Irrigation adds water on hose tiles
    if (irrigationOn) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = tiles[y][x];
                if (hoseMask[y][x] && tile.type === "soil") {
                    moisture[y][x] += irrigationRate;
                }
            }
        }
    }

    // Rain adds a bit of moisture everywhere on soil
    if (weather.rainIntensity > 0) {
        const rainAmount = rainToMoisture * weather.rainIntensity;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = tiles[y][x];
                if (tile.type === "soil") {
                    moisture[y][x] += rainAmount;
                }
            }
        }
    }

    // ---- 2. Evaporation (sink term) ----
    // Simple model: more sun + temp, less air humidity ⇒ more evaporation
    const climateFactor =
        1 +
        0.5 * weather.sunIntensity +
        0.02 * (weather.temperature - 20) -
        0.5 * weather.humidity;

    const evaporationRate = Math.max(0, baseEvaporationRate * climateFactor);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type === "soil") {
                moisture[y][x] -= evaporationRate;
            }
        }
    }

    // ---- 3. Lateral diffusion between neighboring soil tiles ----
    const { diffusionRate } = config;
    const diffs: number[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => 0)
    );

    // Only right and down neighbors to avoid double-counting
    const neighborOffsets = [
        [1, 0], // right
        [0, 1], // down
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type !== "soil") continue;

            for (const [dx, dy] of neighborOffsets) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                const ntile = tiles[ny][nx];
                if (ntile.type !== "soil") continue;

                const m1 = moisture[y][x];
                const m2 = moisture[ny][nx];
                const diff = m1 - m2;
                if (diff === 0) continue;

                const delta = diffusionRate * diff;
                diffs[y][x] -= delta;
                diffs[ny][nx] += delta;
            }
        }
    }

    // Apply diffusion deltas
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            moisture[y][x] += diffs[y][x];
        }
    }

    // ---- 4. Clamp and write back into newTiles ----
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tile = tiles[y][x];
            if (tile.type === "soil") {
                const clamped = Math.max(0, Math.min(maxMoisture, moisture[y][x]));
                newTiles[y][x] = {
                    ...tile,
                    moisture: clamped,
                };
            } else {
                // Non-soil tiles keep their moisture (usually 0)
                newTiles[y][x] = tile;
            }
        }
    }

    return {
        ...garden,
        tiles: newTiles,
    };
}

export function evolveWeather(seed: number, prev: Weather.State, tick: number): Weather.State {

    const rand = mulberry32(seed + tick);

    // very simple day/night cycle for sun + a bit of random rain
    const dayPhase = (tick % TICKS_PER_DAY) / TICKS_PER_DAY; // 0..1
    const sunIntensity = Math.max(0, Math.sin(dayPhase * Math.PI * 2)); // 0..1

    // small random drizzle
    const randomRain = rand() < 0.01 ? 0.5 : Math.max(0, prev.rainIntensity - 0.05);

    return {
        temperature: 20 + 10 * sunIntensity, // 20–30°C
        humidity: 0.4 + 0.3 * (1 - sunIntensity), // more humid at night
        sunIntensity,
        rainIntensity: randomRain,
    };
}
