'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Device } from '@/types/device';
import { Wind, MapPin, Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const isOnline = device.status === 'online';

  return (
    <Link href={`/device/${device.id}`}>
      <Card className="transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">{device.name}</CardTitle>
          <Badge variant={isOnline ? 'default' : 'secondary'}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{device.location}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Fan Speed:</span>
              </div>
              <span className="text-sm font-medium">{device.fanSpeed}%</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Auto Mode:</span>
              </div>
              <span className="text-sm font-medium">{device.autoMode ? 'On' : 'Off'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">PM2.5</p>
                <p className="text-sm font-semibold">{device.sensors.pm25}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">VOC</p>
                <p className="text-sm font-semibold">{device.sensors.voc}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">CO2</p>
                <p className="text-sm font-semibold">{device.sensors.co2}</p>
              </div>
            </div>

            {device.lastSeen && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground pt-2 border-t">
                <Clock className="h-3 w-3" />
                <span>Last seen {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
