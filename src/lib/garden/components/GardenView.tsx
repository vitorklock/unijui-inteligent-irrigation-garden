"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TILE_MOISTURE_DRY, TILE_MOISTURE_FLOODED, TILE_MOISTURE_GOOD } from "@/lib/garden/consts";
import type { Garden, Simulation } from "../types";
import { MetricsPanel } from "./MetricsPanel";
import { EpisodeResults } from "./EpisodeResults";
import { RainForecastTable } from "./RainForecastTable";
import { MoistureStatusMap } from "./MoistureStatusMap";
import { GardenSimulation, GardenSimulationOptions } from "../GardenSimulation";
import { ManualIrrigationController } from "../controllers/ManualIrrigationController";

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


  // Simulation instance (ref to persist across renders)
  const simRef = useRef<GardenSimulation | null>(null);
  const controllerRef = useRef<ManualIrrigationController>(new ManualIrrigationController());
  const [garden, setGarden] = useState<Garden | null>(null);
  const [simulation, setSimulation] = useState<Simulation.State | null>(null);
  const [hoveredHoseCenter, setHoveredHoseCenter] = useState<{ x: number; y: number } | null>(null);
  const [overrideEpisodeEnd, setOverrideEpisodeEnd] = useState(false);


  const regenerate = () => {
    const options: GardenSimulationOptions = {
      width: config.width,
      height: config.height,
      pillarDensity: config.pillarDensity,
      plantChanceNearPath: config.plantChanceNearPath,
      seed: config.seed,
      coverageRadius: config.coverageRadius,
      controller: controllerRef.current,
    };
    simRef.current = new GardenSimulation(options);
    setGarden(simRef.current.garden);
    setSimulation({ ...simRef.current.state });
    setOverrideEpisodeEnd(false);
  };


  const randomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 10_000);
    setConfig((prev) => {
      const next = { ...prev, seed: newSeed };
      const options: GardenSimulationOptions = {
        width: next.width,
        height: next.height,
        pillarDensity: next.pillarDensity,
        plantChanceNearPath: next.plantChanceNearPath,
        seed: next.seed,
        coverageRadius: next.coverageRadius,
        controller: controllerRef.current,
      };
      simRef.current = new GardenSimulation(options);
      setGarden(simRef.current.garden);
      setSimulation({ ...simRef.current.state });
      setOverrideEpisodeEnd(false);
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
    if (!simRef.current || !simulation?.isRunning) return;
    const interval = setInterval(() => {
      if (!simRef.current) return;
      simRef.current.overrideEpisodeEnd = overrideEpisodeEnd;
      simRef.current.step();
      setGarden(simRef.current.garden);
      setSimulation({ ...simRef.current.state });
    }, 100);
    return () => clearInterval(interval);
  }, [simulation?.isRunning, overrideEpisodeEnd]);


  if (!garden || !simulation) return <div>Generating garden…</div>;

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
              {(garden.tiles.flat() as Garden.Tile[]).map((tile) => {
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
                onClick={() => {
                  const isCurrentlyRunning = simulation.isRunning;
                  if (!isCurrentlyRunning && simulation.tick >= simulation.episodeLength) {
                    setOverrideEpisodeEnd(true);
                  }
                  if (isCurrentlyRunning) {
                    setOverrideEpisodeEnd(false);
                  }
                  if (simRef.current) {
                    simRef.current.state.isRunning = !simRef.current.state.isRunning;
                    // If we just paused the simulation, compile results immediately
                    if (isCurrentlyRunning) {
                      // compileResults updates simRef.current.state.results
                      simRef.current.compileResults();
                    }
                    setSimulation({ ...simRef.current.state });
                  }
                }}
                className="px-3 py-2 border rounded"
              >
                {simulation.isRunning ? "Pause" : "Play"}
              </button>

              <button
                onClick={() => {
                  const newState = !controllerRef.current.isIrrigationEnabled();
                  controllerRef.current.setIrrigation(newState);
                  if (simRef.current) {
                    setSimulation({ ...simRef.current.state });
                  }
                }}
                className="px-3 py-2 border rounded"
              >
                Irrigation: {controllerRef.current.isIrrigationEnabled() ? "On" : "Off"}
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
          <div className="flex flex-col gap-4">
            <EpisodeResults results={simulation.results} />
            <MetricsPanel state={simulation} garden={garden} />
          </div>
          <div className="flex flex-col gap-4">
            <RainForecastTable forecast={simulation.forecast} currentTick={simulation.tick} />
            <MoistureStatusMap tiles={garden.tiles} />
          </div>
        </aside>
      </div>
    </div>
  );
};
