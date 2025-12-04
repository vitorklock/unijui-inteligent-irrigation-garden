"use client";

import React, { useState, useEffect, useMemo } from "react";
import { generateGarden } from "@/lib/garden/generator";
import { planHoses } from "@/lib/garden/hosePlanner";
import { Garden, Simulation } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evolveWeather, stepGardenMoisture } from "../simulation";
import { EPISODE_LENGTH, FORECAST_TICK_WINDOW, TILE_MOISTURE_DRY, TILE_MOISTURE_FLOODED, TILE_MOISTURE_GOOD } from "@/lib/garden/consts";
import { MetricsPanel } from "./MetricsPanel";
import { RainForecastTable } from "./RainForecastTable";
import { MoistureStatusMap } from "./MoistureStatusMap";

interface GardenViewProps {
  width?: number;
  height?: number;
}

interface GardenConfig {
  width: number;
  height: number;
  pillarDensity: number;
  plantChanceNearPath: number;
  seed: number;
  coverageRadius: number;
}

const tileColor = (tile: Garden.Tile): string => {
  if (tile.type === "pillar") return "#555555";
  if (tile.type === "path") return "#b09764";
  if (tile.type === "water_source") return "#2b6cb0"; // blue-ish

  const m = tile.moisture;
  if (m <= TILE_MOISTURE_DRY) return "#c2a176"; // dry, light brown
  if (m < TILE_MOISTURE_GOOD) return "#9b7a4b"; // darker
  if (m < TILE_MOISTURE_FLOODED) return "#6b4b2b"; // very dark
  return "#1e3a8a"; // flooded (blue-ish)
};

export const GardenView: React.FC<GardenViewProps> = ({
  width,
  height,
}) => {
  const [config, setConfig] = useState<GardenConfig>({
    width: width ?? 30,
    height: height ?? 20,
    pillarDensity: 0.04,
    plantChanceNearPath: 0.25,
    seed: 42, // static default
    coverageRadius: 1,
  });

  const [garden, setGarden] = useState<Garden | null>(null);

  // NEW: which hose tile is hovered
  const [hoveredHoseCenter, setHoveredHoseCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Simulation state (tick, running, weather, and sim config)
  const [simulation, setSimulation] = useState<Simulation.State>({
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
      coverageRadius: config.coverageRadius,
    },
    episodeLength: EPISODE_LENGTH,
    forecast: Array.from({ length: 10 }, () => 0),
    waterUsedThisTick: 0,
    lastIrrigationTick: 0,
    cumulativeWaterUsed: 0,

  });

  const regenerate = () => {
    const base = generateGarden({
      width: config.width,
      height: config.height,
      pillarDensity: config.pillarDensity,
      plantChanceNearPath: config.plantChanceNearPath,
      seed: config.seed,
    });
    const withHoses = planHoses(base, {
      coverageRadius: config.coverageRadius,
    });
    setGarden(withHoses);
    // Reset simulation progress when regenerating the garden
    setSimulation((s) => ({ ...s, tick: 0, isRunning: false }));
  };

  const randomizeSeed = () => {
    setConfig((prev) => {
      const newSeed = Math.floor(Math.random() * 10_000);
      const next = { ...prev, seed: newSeed };
      const base = generateGarden({
        width: next.width,
        height: next.height,
        pillarDensity: next.pillarDensity,
        plantChanceNearPath: next.plantChanceNearPath,
        seed: next.seed,
      });
      const withHoses = planHoses(base, {
        coverageRadius: next.coverageRadius,
      });
      setGarden(withHoses);
      setConfig({
        ...config,
        seed: newSeed,
      });
      setSimulation((s) => ({ ...s, tick: 0, isRunning: false }));
      return next;
    });
  };

  // Precompute hose tiles for fast lookups
  const hoseTiles = useMemo(() => {
    const set = new Set<string>();
    if (!garden?.hoses) return set;
    for (const hose of garden.hoses) {
      for (const p of hose.tiles) {
        set.add(`${p.x}-${p.y}`);
      }
    }
    return set;
  }, [garden]);

  // initial generation
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!garden) return;
    if (!simulation.isRunning) return;

    const interval = setInterval(() => {
      setSimulation((prev) => {
        // simple animated weather, for now
        const nextWeather = evolveWeather(config.seed, prev.weather, prev.tick);

        setGarden((currentGarden) => {
          if (!currentGarden) return currentGarden;

          const nextGarden = stepGardenMoisture({
            garden: currentGarden,
            config: { ...prev.config, coverageRadius: config.coverageRadius },
            weather: nextWeather,
            irrigationOn: prev.irrigationOn,
          });

          return nextGarden;
        });

        // Build a short forecast of upcoming rain intensities.
        // We iteratively apply `evolveWeather` starting from the current
        // `prev.weather` so the forecast respects the decay/randomness logic.
        let tempWeather = prev.weather;
        const forecast = Array.from({ length: FORECAST_TICK_WINDOW }, (_, k) => {
          const w = evolveWeather(config.seed, tempWeather, prev.tick + k);
          tempWeather = w;
          return w.rainIntensity;
        });

        return {
          ...prev,
          tick: prev.tick + 1,
          weather: nextWeather,
          forecast,
        };
      });
    }, 100); // 100ms per tick

    return () => clearInterval(interval);
  }, [garden, simulation.isRunning]);


  if (!garden) return <div>Generating garden…</div>;

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: title */}
      <div className="flex items-center">
        <h2 className="text-lg font-semibold">Smart Garden</h2>
      </div>

      {/* Row 2: buttons (left) + settings (right) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={regenerate}>
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={randomizeSeed}>
            Randomize
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          {/* Width */}
          <div className="flex items-center gap-1">
            <span>W</span>
            <Input
              type="number"
              className="w-16 h-8"
              min={10}
              max={60}
              value={config.width}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setConfig((prev) => ({
                  ...prev,
                  width: Math.min(60, Math.max(10, value)),
                }));
              }}
            />
          </div>

          {/* Height */}
          <div className="flex items-center gap-1">
            <span>H</span>
            <Input
              type="number"
              className="w-16 h-8"
              min={8}
              max={40}
              value={config.height}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setConfig((prev) => ({
                  ...prev,
                  height: Math.min(40, Math.max(8, value)),
                }));
              }}
            />
          </div>

          {/* Seed (static unless edited or randomized) */}
          <div className="flex items-center gap-1">
            <span>Seed</span>
            <Input
              type="number"
              className="w-20 h-8"
              value={config.seed}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setConfig((prev) => ({
                  ...prev,
                  seed: value,
                }));
              }}
            />
          </div>

          {/* Pillar density */}
          <div className="flex items-center gap-1">
            <span>Pillars</span>
            <Input
              type="number"
              className="w-20 h-8"
              step={0.01}
              min={0}
              max={0.5}
              value={config.pillarDensity}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setConfig((prev) => ({
                  ...prev,
                  pillarDensity: Math.min(0.5, Math.max(0, value)),
                }));
              }}
            />
          </div>

          {/* Plant chance */}
          <div className="flex items-center gap-1">
            <span>Plant%</span>
            <Input
              type="number"
              className="w-24 h-8"
              step={0.01}
              min={0}
              max={1}
              value={config.plantChanceNearPath}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                setConfig((prev) => ({
                  ...prev,
                  plantChanceNearPath: Math.min(1, Math.max(0, value)),
                }));
              }}
            />
          </div>

          {/* Hose coverage radius */}
          <div className="flex items-center gap-1">
            <span>CoverR</span>
            <Input
              type="number"
              className="w-16 h-8"
              min={0}
              max={5}
              step={1}
              value={config.coverageRadius}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                const clamped = Math.min(5, Math.max(0, value));
                setConfig((prev) => ({
                  ...prev,
                  coverageRadius: clamped,
                }));
              }}
            />
          </div>
        </div>
      </div>

      {/* Layout: Metrics + Main simulation area */}
      <div className="flex-col gap-4">

        {/* Main simulation area (grid + controls) */}
        <main className="flex-1 p-1">
          <div className="flex gap-4">
            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${garden.width}, 18px)`,
                gridTemplateRows: `repeat(${garden.height}, 18px)`,
                gap: 1,
                background: "#222",
                padding: 4,
                borderRadius: 4,
              }}
            >
              {garden.tiles.flat().map((tile) => {
                const key = `${tile.x}-${tile.y}`;
                const hasHose = hoseTiles.has(key);

                const isInWateringRange =
                  hoveredHoseCenter !== null &&
                  Math.abs(hoveredHoseCenter.x - tile.x) +
                  Math.abs(hoveredHoseCenter.y - tile.y) <=
                  config.coverageRadius;

                return (
                  <div
                    key={key}
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: tileColor(tile),
                      position: "relative",
                    }}
                    onMouseEnter={() => {
                      if (hasHose) {
                        setHoveredHoseCenter({ x: tile.x, y: tile.y });
                      }
                    }}
                    onMouseLeave={() => {
                      if (hasHose) {
                        setHoveredHoseCenter(null);
                      }
                    }}
                  >
                    {/* Watering overlay when hovering a hose */}
                    {isInWateringRange && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 1,
                          borderRadius: 3,
                          backgroundColor: "rgba(56, 189, 248, 0.35)", // light blue
                          pointerEvents: "none",
                        }}
                      />
                    )}

                    {tile.hasPlant && (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: "#16a34a",
                          margin: "auto",
                          position: "absolute",
                          inset: 0,
                        }}
                      />
                    )}

                    {hasHose && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 1,
                          borderRadius: 9999,
                          border: "1px solid #0ea5e9",
                          pointerEvents: "none",
                          backgroundColor: "rgba(14, 165, 233, 0.1)"

                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Panel: Controls and Stats */}
            <div className="flex flex-col gap-4">
              <button
                onClick={() =>
                  setSimulation((prev) => ({ ...prev, isRunning: !prev.isRunning }))
                }
                className="px-3 py-2 border rounded"
              >
                {simulation.isRunning ? "Pause" : "Play"}
              </button>

              <button
                onClick={() =>
                  setSimulation((prev) => ({
                    ...prev,
                    irrigationOn: !prev.irrigationOn,
                  }))
                }
                className="px-3 py-2 border rounded"
              >
                Irrigation: {simulation.irrigationOn ? "On" : "Off"}
              </button>

              <div className="flex flex-col gap-2 text-xs text-gray-500 border rounded p-2">
                <div>Tick: {simulation.tick}</div>
                <div>Temp: {simulation.weather.temperature.toFixed(1)}°C</div>
                <div>Sun: {simulation.weather.sunIntensity.toFixed(2)}</div>
                <div>Rain: {simulation.weather.rainIntensity.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-full flex *:grow gap-4 p-4 bg-gray-50">
          <MetricsPanel state={simulation} garden={garden} />
          <div className="flex flex-col gap-4">
            <RainForecastTable forecast={simulation.forecast} currentTick={simulation.tick} />
            <MoistureStatusMap tiles={garden.tiles} />
          </div>
        </aside>
      </div>
    </div>
  );
};
