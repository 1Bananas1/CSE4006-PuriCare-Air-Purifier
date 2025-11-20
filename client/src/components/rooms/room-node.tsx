'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wind, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RoomNodeData = {
  name: string;
  deviceCount: number;
  sensors: {
    avgPm25: number;
    avgVoc: number;
    avgCo2: number;
  };
  onSelect: () => void;
};

function RoomNodeComponent({ data, selected }: NodeProps<RoomNodeData>) {
  const pm25Status = data.sensors.avgPm25 < 12 ? 'good' : data.sensors.avgPm25 < 35 ? 'moderate' : 'poor';
  
  return (
    <>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Card
        className={cn(
          'min-w-[220px] cursor-pointer transition-all hover:shadow-lg',
          selected && 'ring-2 ring-primary'
        )}
        onClick={data.onSelect}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{data.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {data.deviceCount} {data.deviceCount === 1 ? 'device' : 'devices'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1">
                  <Wind className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">PM2.5:</span>
                </div>
                <span className={cn(
                  'font-medium',
                  pm25Status === 'good' && 'text-green-600',
                  pm25Status === 'moderate' && 'text-yellow-600',
                  pm25Status === 'poor' && 'text-red-600'
                )}>
                  {data.sensors.avgPm25}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">VOC:</span>
                </div>
                <span className="font-medium">{data.sensors.avgVoc}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">CO2:</span>
                </div>
                <span className="font-medium">{data.sensors.avgCo2}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </>
  );
}

export const RoomNode = memo(RoomNodeComponent);
