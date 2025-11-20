'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Wind, Activity, AlertTriangle, ArrowRight, MapPin } from 'lucide-react';
import { Room } from '@/types/room';
import { Device } from '@/types/device';
import { cn } from '@/lib/utils';

interface RoomDetailPanelProps {
  room: Room | null;
  devices: Device[];
  onClose: () => void;
}

export function RoomDetailPanel({ room, devices, onClose }: RoomDetailPanelProps) {
  const router = useRouter();

  if (!room) return null;

  const roomDevices = devices.filter((d) => room.deviceIds.includes(d.id));
  const pm25Status = room.sensors.avgPm25 < 12 ? 'Good' : room.sensors.avgPm25 < 35 ? 'Moderate' : 'Poor';
  const pm25Color = room.sensors.avgPm25 < 12 ? 'text-green-600' : room.sensors.avgPm25 < 35 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="absolute top-4 right-4 w-80 z-10 animate-in slide-in-from-right">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{room.name}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Air Quality Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wind className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">PM2.5</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{room.sensors.avgPm25} µg/m³</p>
                  <p className={cn('text-xs', pm25Color)}>{pm25Status}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">VOC</span>
                </div>
                <p className="text-sm font-medium">{room.sensors.avgVoc} ppb</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">CO2</span>
                </div>
                <p className="text-sm font-medium">{room.sensors.avgCo2} ppm</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Devices in this room</h3>
            <div className="space-y-2">
              {roomDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => router.push(`/device/${device.id}`)}
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{device.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                      {device.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
