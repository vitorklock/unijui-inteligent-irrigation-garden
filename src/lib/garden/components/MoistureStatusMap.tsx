// File: src/components/garden/MoistureStatusMap.tsx
'use client';
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Garden } from '../types';
import { IDEAL_MAX_MOISTURE, IDEAL_MIN_MOISTURE } from '../consts';

interface MoistureStatusMapProps {
  tiles: Garden.Tile[][];
}

export function MoistureStatusMap({ tiles }: MoistureStatusMapProps) {
  const rows = tiles.length;
  const cols = rows > 0 ? tiles[0].length : 0;
  // Calculate distribution of moisture categories
  let dryCount = 0, wetCount = 0, plantCount = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = tiles[y][x];
      // Only consider tiles that actually have a plant
      if (!tile.hasPlant) continue;
      plantCount++;
      const m = tile.moisture;
      if (m < IDEAL_MIN_MOISTURE) dryCount++;
      else if (m > IDEAL_MAX_MOISTURE) wetCount++;
      // (implicitly, else means in good range)
    }
  }
  const totalPlants = plantCount || 0;
  const dryPercent = totalPlants > 0 ? Math.round((dryCount / totalPlants) * 100) : 0;
  const wetPercent = totalPlants > 0 ? Math.round((wetCount / totalPlants) * 100) : 0;
  const goodPercent = totalPlants > 0 ? Math.round(((totalPlants - dryCount - wetCount) / totalPlants) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moisture Status 🚰</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Miniature map of plant moisture status */}
        <div className="overflow-x-auto">
          {tiles.map((row, y) => (
            <div key={y} className="flex">
              {row.map((tile, x) => {
                // Only color tiles that have plants; non-plant tiles are neutral
                let colorClass = 'bg-slate-200';
                let title = `(${y},${x}) empty`;
                if (tile.hasPlant) {
                  const moisture = tile.moisture;
                  title = `(${y},${x}) moisture ${moisture.toFixed(2)}`;
                  if (moisture < IDEAL_MIN_MOISTURE) colorClass = 'bg-red-500'; // thirsty
                  else if (moisture > IDEAL_MAX_MOISTURE) colorClass = 'bg-blue-500'; // drowning
                  else colorClass = 'bg-green-500'; // good
                }
                return (
                  <div
                    key={x}
                    className={`${colorClass} w-2 h-2`}
                    title={title}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend / summary */}
        <div className="mt-2 text-sm space-y-1">
          <div>
            <span className="inline-block w-3 h-3 bg-red-500 mr-1"></span>
            Thirsty (dry): {dryPercent}%
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-green-500 mr-1"></span>
            Good: {goodPercent}%
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-blue-500 mr-1"></span>
            Drowning (wet): {wetPercent}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
