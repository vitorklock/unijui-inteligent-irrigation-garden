"use client";

import React, { useState, useEffect } from "react";
import { generateGarden } from "@/lib/garden/generator";
import { Garden } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}

const tileColor = (tile: Garden.Tile): string => {
  if (tile.type === "pillar") return "#555555";
  if (tile.type === "path") return "#b3a07a";
  if (tile.type === "water_source") return "#2b6cb0"; // blue-ish

  const m = tile.moisture;
  if (m <= 0) return "#c2a176"; // dry, light brown
  if (m < 0.7) return "#9b7a4b"; // darker
  if (m <= 1.2) return "#6b4b2b"; // very dark
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
  });

  const [garden, setGarden] = useState<Garden | null>(null);

  const regenerate = () => {
    const g = generateGarden({
      width: config.width,
      height: config.height,
      pillarDensity: config.pillarDensity,
      plantChanceNearPath: config.plantChanceNearPath,
      seed: config.seed, // <– use current seed, do NOT change it
    });
    setGarden(g);
  };

  const randomizeSeed = () => {
    setConfig((prev) => {
      const newSeed = Math.floor(Math.random() * 10_000);
      const next = { ...prev, seed: newSeed };
      const g = generateGarden({
        width: next.width,
        height: next.height,
        pillarDensity: next.pillarDensity,
        plantChanceNearPath: next.plantChanceNearPath,
        seed: next.seed,
      });
      setGarden(g);
      return next;
    });
  };

  // initial generation
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        </div>
      </div>

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
        {garden.tiles.flat().map((tile) => (
          <div
            key={`${tile.x}-${tile.y}`}
            style={{
              width: 18,
              height: 18,
              backgroundColor: tileColor(tile),
              position: "relative",
            }}
          >
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
          </div>
        ))}
      </div>
    </div>
  );
};
