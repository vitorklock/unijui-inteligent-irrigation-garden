'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FORECAST_TICK_WINDOW } from '../consts';

interface RainForecastTableProps {
  forecast: number[];      // array of rain intensity values for upcoming ticks
  currentTick: number;     // current tick number to label the forecast horizon
}

export function RainForecastTable({ forecast, currentTick }: RainForecastTableProps) {

  const displayForecast = forecast.slice(0, FORECAST_TICK_WINDOW);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rain Forecast</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tick</TableHead>
              <TableHead>Rain Intensity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayForecast.map((intensity, idx) => {
              const tickLabel = currentTick + idx + 1;  // next tick number
              return (
                <TableRow key={idx}>
                  <TableCell>{tickLabel}</TableCell>
                  <TableCell>{intensity.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
