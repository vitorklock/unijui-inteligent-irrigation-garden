import { Garden, Simulation, Weather, IrrigationController } from "./types";
import { generateGarden } from "./generator";
import { planHoses } from "./hosePlanner";
import { stepGardenMoisture, evolveWeather } from "./simulation";
import { EPISODE_LENGTH, FORECAST_TICK_WINDOW, IDEAL_MIN_MOISTURE, IDEAL_MAX_MOISTURE, WATER_USAGE_PER_TICK } from "./consts";
import { computeGardenMetrics } from "./metrics";

function createDefaultState(options: GardenSimulationOptions): Simulation.State {
    return {
        tick: 0,
        isRunning: false,
        irrigationOn: true,
        weather: {
            temperature: 25,
            humidity: 0.5,
            sunIntensity: 0.8,
            rainIntensity: 0,
        },
        config: {
            irrigationRate: 0.05,
            baseEvaporationRate: 0.01,
            diffusionRate: 0.15,
            rainToMoisture: 0.1,
            maxMoisture: 2.0,
            coverageRadius: options.coverageRadius,
            ...options.simConfig,
        },
        episodeLength: EPISODE_LENGTH,
        forecast: Array.from({ length: FORECAST_TICK_WINDOW }, () => 0),
        waterUsedThisTick: 0,
        lastIrrigationTick: 0,
        cumulativeWaterUsed: 0,
        irrigationToggleCount: 0,
        irrigationOnTicks: 0,
        dryPlantTicks: 0,
        floodedPlantTicks: 0,
        healthyPlantTicks: 0,
        peakSimultaneousFloodedPlants: 0,
        peakSimultaneousDryPlants: 0,
        results: undefined,
    };
}

export interface GardenSimulationOptions {
    width: number;
    height: number;
    pillarDensity: number;
    plantChanceNearPath: number;
    seed: number;
    coverageRadius: number;
    simConfig?: Partial<Simulation.Config>;
    controller?: IrrigationController;
}

/**
 * Default controller that always keeps irrigation on
 */
class DefaultIrrigationController implements IrrigationController {
    decide(): boolean {
        return false;
    }
}

export class GardenSimulation {
    public garden: Garden;
    public state: Simulation.State;
    public overrideEpisodeEnd: boolean = false;
    private controller: IrrigationController;

    constructor(options: GardenSimulationOptions) {
        this.garden = planHoses(
            generateGarden({
                width: options.width,
                height: options.height,
                pillarDensity: options.pillarDensity,
                plantChanceNearPath: options.plantChanceNearPath,
                seed: options.seed,
            }),
            { coverageRadius: options.coverageRadius }
        );
        this.state = createDefaultState(options);
        // Set default controller or use provided one
        this.controller = options.controller || new DefaultIrrigationController();
    }

    private countPlants(): number {
        return this.garden.tiles.flat().filter((t) => t.hasPlant).length;
    }

    private computeWaterUsedThisTick(): number {
        const { irrigationRate, coverageRadius } = this.state.config;
        if (!this.state.irrigationOn) return 0;

        const marked = new Set<string>();
        for (const hose of this.garden.hoses) {
            for (const p of hose.tiles) {
                for (let dy = -coverageRadius; dy <= coverageRadius; dy++) {
                    for (let dx = -coverageRadius; dx <= coverageRadius; dx++) {
                        if (Math.abs(dx) + Math.abs(dy) > coverageRadius) continue;
                        const nx = p.x + dx;
                        const ny = p.y + dy;
                        if (nx < 0 || ny < 0 || ny >= this.garden.height || nx >= this.garden.width) continue;
                        const key = `${nx},${ny}`;
                        if (marked.has(key)) continue;
                        const tile = this.garden.tiles[ny][nx];
                        if (tile.type === "soil") {
                            marked.add(key);
                        }
                    }
                }
            }
        }
        return marked.size * (irrigationRate ?? 0);
    }

    private updatePlantAccumulators() {
        const allTiles = this.garden.tiles.flat();

        let dryPlants = 0;
        let floodedPlants = 0;
        let healthyPlants = 0;

        for (const tile of allTiles) {
            if (!tile.hasPlant) continue;

            const m = tile.moisture;
            if (m < IDEAL_MIN_MOISTURE) {
                dryPlants++;
            } else if (m > IDEAL_MAX_MOISTURE) {
                floodedPlants++;
            } else {
                healthyPlants++;
            }
        }

        this.state.dryPlantTicks = (this.state.dryPlantTicks ?? 0) + dryPlants;
        this.state.floodedPlantTicks = (this.state.floodedPlantTicks ?? 0) + floodedPlants;
        this.state.healthyPlantTicks = (this.state.healthyPlantTicks ?? 0) + healthyPlants;

        this.state.peakSimultaneousDryPlants = Math.max(
            this.state.peakSimultaneousDryPlants ?? 0,
            dryPlants
        );
        this.state.peakSimultaneousFloodedPlants = Math.max(
            this.state.peakSimultaneousFloodedPlants ?? 0,
            floodedPlants
        );
    }

    private generateForecast(): number[] {
        let tempWeather = this.state.weather;
        return Array.from({ length: FORECAST_TICK_WINDOW }, (_, k) => {
            const w = evolveWeather(this.garden.seed ?? 42, tempWeather, this.state.tick + k);
            tempWeather = w;
            return w.rainIntensity;
        });
    }

    /**
     * Compile simulation results based on current state and garden.
     * This can be called anytime to produce a `Simulation.Results` object.
     */
    public compileResults(): Simulation.Results {
        const tickCount = Math.min(this.state.tick, this.state.episodeLength);

        const totalPlants = this.countPlants();
        const totalPlantTicks = totalPlants * tickCount;

        const dryPlantTicks = this.state.dryPlantTicks ?? 0;
        const floodedPlantTicks = this.state.floodedPlantTicks ?? 0;
        const healthyPlantTicks = this.state.healthyPlantTicks ?? 0;
        const totalWaterUsed = this.state.cumulativeWaterUsed;

        let finalScore = 0;

        if (totalPlantTicks > 0) {
            // Ratios in [0, 1], assuming each plant tick is classified as exactly one of dry/healthy/flooded.
            const healthRatio = healthyPlantTicks / totalPlantTicks;
            const dryRatio = dryPlantTicks / totalPlantTicks;
            const floodRatio = floodedPlantTicks / totalPlantTicks;

            // Average water used per plant per tick
            const waterPerPlantTick = totalWaterUsed / totalPlantTicks;

            // 0 = no penalty, 1 = very wasteful
            const waterPenalty = Math.min(
                1,
                waterPerPlantTick / WATER_USAGE_PER_TICK
            );
            const waterScore = 1 - waterPenalty; // 1 = very efficient, 0 = very wasteful

            // Combine into a single score:
            // - Strong weight on healthRatio
            // - Extra penalty for dryness (worse than flooding)
            // - Mild penalty for flooding
            // - Reward efficient water usage
            const rawScore =
                0.6 * healthRatio +        // main objective: keep plants in ideal range
                0.2 * (1 - dryRatio) +     // avoid dryness
                0.1 * (1 - floodRatio) +   // avoid flooding
                0.1 * waterScore;          // be water-efficient

            // Clamp to [0, 100] and round for a nice UI value
            finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 100)));
        }

        const results: Simulation.Results = {
            totalWaterUsed,
            dryPlantTicks,
            floodedPlantTicks,
            healthyPlantTicks,
            peakSimultaneousFloodedPlants: this.state.peakSimultaneousFloodedPlants ?? 0,
            peakSimultaneousDryPlants: this.state.peakSimultaneousDryPlants ?? 0,
            tickCount,
            finalScore,
            totalPlantTicks, // ✅ fill the new field
            irrigationToggleCount: this.state.irrigationToggleCount,
            irrigationOnTicks: this.state.irrigationOnTicks,
        };

        this.state.results = results;
        return results;
    }

    regenerate(options: GardenSimulationOptions) {
        this.garden = planHoses(
            generateGarden({
                width: options.width,
                height: options.height,
                pillarDensity: options.pillarDensity,
                plantChanceNearPath: options.plantChanceNearPath,
                seed: options.seed,
            }),
            { coverageRadius: options.coverageRadius }
        );
        // Reset state to default for given options (keeps resets DRY)
        this.state = createDefaultState(options);
        this.overrideEpisodeEnd = false;
    }

    step() {
        if (this.state.tick >= this.state.episodeLength && !this.overrideEpisodeEnd) {
            // Episode finished: produce final results
            this.compileResults();
            this.state.isRunning = false;
            return;
        }
        
        const prevIrrigationOn = this.state.irrigationOn;

        // Let the controller decide on irrigation state
        const metrics = computeGardenMetrics(this.state, this.garden);
        this.state.irrigationOn = this.controller.decide(metrics, this.state);

        // Track irrigation toggles and time spent on
        if (this.state.irrigationOn !== prevIrrigationOn) {
            this.state.irrigationToggleCount += 1;
            if (this.state.irrigationOn) {
                this.state.lastIrrigationTick = this.state.tick;
            }
        }
        if (this.state.irrigationOn) {
            this.state.irrigationOnTicks += 1;
        }
        
        // Weather evolution
        const nextWeather = evolveWeather(
            this.garden.seed ?? 42,
            this.state.weather,
            this.state.tick
        );
        this.state.weather = nextWeather;
        // Garden moisture step
        this.garden = stepGardenMoisture({
            garden: this.garden,
            config: { ...this.state.config, coverageRadius: this.state.config.coverageRadius },
            weather: nextWeather,
            irrigationOn: this.state.irrigationOn,
        });
        // Compute water used this tick and update totals
        const waterUsedThisTick = this.computeWaterUsedThisTick();
        this.state.waterUsedThisTick = waterUsedThisTick;
        this.state.cumulativeWaterUsed += waterUsedThisTick;

        // Update plant-status accumulators for results
        this.updatePlantAccumulators();

        // Forecast
        this.state.forecast = this.generateForecast();
        this.state.tick += 1;
    }
}
