'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SensorData } from '@/types/device';
import { Wind, Activity, Droplets, Thermometer, AlertTriangle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensorPanelProps {
  sensors: SensorData;
}

function getSensorStatus(value: number, thresholds: { good: number; moderate: number }) {
  if (value <= thresholds.good) return { label: 'Good', color: 'text-green-600' };
  if (value <= thresholds.moderate) return { label: 'Moderate', color: 'text-yellow-600' };
  return { label: 'Poor', color: 'text-red-600' };
}

export function SensorPanel({ sensors }: SensorPanelProps) {
  const pm25Status = getSensorStatus(sensors.pm25, { good: 12, moderate: 35 });
  const pm10Status = getSensorStatus(sensors.pm10, { good: 54, moderate: 154 });
  const vocStatus = getSensorStatus(sensors.voc, { good: 220, moderate: 660 });
  const co2Status = getSensorStatus(sensors.co2, { good: 1000, moderate: 2000 });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PM2.5</CardTitle>
          <Wind className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.pm25} µg/m³</div>
          <p className={cn('text-xs font-medium', pm25Status.color)}>{pm25Status.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PM10</CardTitle>
          <Cloud className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.pm10} µg/m³</div>
          <p className={cn('text-xs font-medium', pm10Status.color)}>{pm10Status.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">VOC</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.voc} ppb</div>
          <p className={cn('text-xs font-medium', vocStatus.color)}>{vocStatus.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CO2</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.co2} ppm</div>
          <p className={cn('text-xs font-medium', co2Status.color)}>{co2Status.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Temperature</CardTitle>
          <Thermometer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.temperature}°C</div>
          <p className="text-xs text-muted-foreground">
            {sensors.temperature < 18
              ? 'Cool'
              : sensors.temperature < 24
              ? 'Comfortable'
              : 'Warm'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Humidity</CardTitle>
          <Droplets className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sensors.humidity}%</div>
          <p className="text-xs text-muted-foreground">
            {sensors.humidity < 30
              ? 'Dry'
              : sensors.humidity < 60
              ? 'Comfortable'
              : 'Humid'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
