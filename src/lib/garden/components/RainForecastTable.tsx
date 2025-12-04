'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FORECAST_TICK_WINDOW } from '../consts';

// Small, focused forecast bar chart using simple divs and Tailwind styles.
// We avoid adding extra dependencies — the project already includes Tailwind.

interface RainForecastTableProps {
  forecast: number[];      // array of rain intensity values for upcoming ticks
  currentTick: number;     // current tick number to label the forecast horizon
}

export function RainForecastTable({ forecast, currentTick }: RainForecastTableProps) {

  const displayForecast = forecast.slice(0, FORECAST_TICK_WINDOW);

  const maxBarHeight = 80; // px

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rain Forecast 🌦️</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div
          className="flex items-end gap-2"
          style={{ height: maxBarHeight, flexDirection: "row" }}
        >
          {displayForecast.reverse().map((rawIntensity = 0, idx) => {
            const intensity = Math.max(0, Math.min(1, rawIntensity ?? 0));
            const barHeight = `${Math.round(intensity * 100)}%`;
            const tickLabel = currentTick + idx + 1;

            return (
              <div key={idx} className="flex flex-col items-center text-xs" style={{ width: 28 }}>
                <div className="flex items-end justify-center w-full" style={{ height: maxBarHeight - 18 }}>
                  <div
                    className="w-6 bg-blue-500 rounded-t-md"
                    style={{ height: barHeight }}
                    title={`Tick ${tickLabel}: ${intensity.toFixed(2)}`}
                    aria-label={`Rain intensity ${intensity.toFixed(2)} at tick ${tickLabel}`}
                  />
                </div>
                <div className="mt-1 text-xxs text-muted-foreground">{tickLabel}</div>
                <div className="text-xxs text-muted-foreground">{intensity.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
