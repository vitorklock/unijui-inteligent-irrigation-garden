"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Simulation } from "../types";

interface EpisodeResultsProps {
  results?: Simulation.Results | undefined | null;
}

export const EpisodeResults: React.FC<EpisodeResultsProps> = ({ results }) => {
  if (!results) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Episode Results 🎯</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between"><span>Total Water Used</span><span>{typeof results.totalWaterUsed === 'number' ? results.totalWaterUsed.toFixed(1) : String(results.totalWaterUsed)}</span></div>
        <div className="flex justify-between"><span>Dry Plant Ticks</span><span>{results.dryPlantTicks}</span></div>
        <div className="flex justify-between"><span>Flooded Plant Ticks</span><span>{results.floodedPlantTicks}</span></div>
        <div className="flex justify-between"><span>Healthy Plant Ticks</span><span>{results.healthyPlantTicks}</span></div>
        <div className="flex justify-between"><span>Peak Flooded Plants</span><span>{results.peakSimultaneousFloodedPlants}</span></div>
        <div className="flex justify-between"><span>Peak Dry Plants</span><span>{results.peakSimultaneousDryPlants}</span></div>
        <div className="flex justify-between"><span>Tick Count</span><span>{results.tickCount}</span></div>
        <div className="flex justify-between"><span>Final Score</span><span>{results.finalScore}%</span></div>
      </CardContent>
    </Card>
  );
};

export default EpisodeResults;
