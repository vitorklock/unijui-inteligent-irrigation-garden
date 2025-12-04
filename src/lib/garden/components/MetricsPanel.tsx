
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useGardenMetrics } from '../metrics';
import { Garden, Simulation } from '../types';

interface MetricsPanelProps {
  state: Simulation.State
  garden: Garden
}

export function MetricsPanel({ state, garden }: MetricsPanelProps) {
  const metrics = useGardenMetrics(state, garden);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Metrics 📏</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {/* Moisture statistics */}
        <div className="flex justify-between">
          <span>Avg Moisture</span>
          <span>{metrics.avgMoisture.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Min Moisture</span>
          <span>{metrics.minMoisture.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Max Moisture</span>
          <span>{metrics.maxMoisture.toFixed(2)}</span>
        </div>
        {/* Plant moisture categories */}
        <div className="flex justify-between">
          <span>% Plants Too Dry</span>
          <span>{metrics.percentTooDry}%</span>
        </div>
        <div className="flex justify-between">
          <span>% Plants Too Wet</span>
          <span>{metrics.percentTooWet}%</span>
        </div>
        {/* Irrigation status */}
        <div className="flex justify-between">
          <span>Irrigation</span>
          <span>{metrics.irrigationOn ? 'On' : 'Off'}</span>
        </div>
        <div className="flex justify-between">
          <span>Ticks Since Last Irrigation</span>
          <span>{metrics.ticksSinceLastIrrigation}</span>
        </div>
        {/* Time and progress */}
        <div className="flex justify-between">
          <span>Time of Day</span>
          <span>{metrics.timeOfDay.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Episode Progress</span>
          <span>{metrics.episodeProgress.toFixed(2)}</span>
        </div>
        {/* Water usage */}
        <div className="flex justify-between">
          <span>Water Used (this tick)</span>
          <span>{metrics.waterUsedThisTick.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cumulative Water Used</span>
          <span>{metrics.cumulativeWaterUsed.toFixed(1)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
