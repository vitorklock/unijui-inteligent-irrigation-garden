"use client";

import React, { useState, useEffect } from "react";
import { generateGarden } from "@/lib/garden/generator";
import { Garden } from "./types";
import { Button } from "@/components/ui/button";

interface GardenViewProps {
  width?: number;
  height?: number;
}

const tileColor = (tile: Garden.Tile): string => {
  if (tile.type === "pillar") return "#555555";
  if (tile.type === "path") return "#b3a07a";
  if (tile.type === "water_source") return "#2b6cb0"; // blue-ish

  // soil: base on moisture
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
  const [garden, setGarden] = useState<Garden | null>(null);

  useEffect(() => {
    const g = generateGarden({
      width,
      height,
      seed: Math.floor(Math.random() * 10_000),
    });
    setGarden(g);
  }, [width, height]);

  if (!garden) return <div>Generating garden…</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Smart Garden</h2>
        <Button
          onClick={() => {
            const g = generateGarden({
              width,
              height,
              seed: Math.floor(Math.random() * 10_000),
            });
            setGarden(g);
          }}
        >
          Regenerate
        </Button>
      </div>

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
