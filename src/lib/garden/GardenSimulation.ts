// src/lib/garden/GardenSimulation.ts
import { Garden, Simulation, Weather } from "./types";
import { generateGarden } from "./generator";
import { planHoses } from "./hosePlanner";
import { stepGardenMoisture, evolveWeather } from "./simulation";
import { EPISODE_LENGTH, FORECAST_TICK_WINDOW } from "./consts";

export interface GardenSimulationOptions {
  width: number;
  height: number;
  pillarDensity: number;
  plantChanceNearPath: number;
  seed: number;
  coverageRadius: number;
  simConfig?: Partial<Simulation.Config>;
}

export class GardenSimulation {
  public garden: Garden;
  public state: Simulation.State;
  public overrideEpisodeEnd: boolean = false;

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
    this.state = {
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
      forecast: Array.from({ length: 10 }, () => 0),
      waterUsedThisTick: 0,
      lastIrrigationTick: 0,
      cumulativeWaterUsed: 0,
    };
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
    this.state.tick = 0;
    this.state.isRunning = false;
    this.overrideEpisodeEnd = false;
  }

  step() {
    if (this.state.tick >= this.state.episodeLength && !this.overrideEpisodeEnd) {
      this.state.isRunning = false;
      return;
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
    // Forecast
    let tempWeather = this.state.weather;
    const forecast = Array.from({ length: FORECAST_TICK_WINDOW }, (_, k) => {
      const w = evolveWeather(this.garden.seed ?? 42, tempWeather, this.state.tick + k);
      tempWeather = w;
      return w.rainIntensity;
    });
    this.state.forecast = forecast;
    this.state.tick += 1;
  }
}
