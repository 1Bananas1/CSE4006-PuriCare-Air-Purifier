'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceEvent } from '@/types/device';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Power, CheckCircle } from 'lucide-react';

interface EventLogProps {
  events: DeviceEvent[];
}

function getEventIcon(type: DeviceEvent['type']) {
  switch (type) {
    case 'mode_change':
      return <Activity className="h-4 w-4 text-blue-600" />;
    case 'alert':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'offline':
      return <Power className="h-4 w-4 text-gray-600" />;
    case 'online':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

export function EventLog({ events }: EventLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No events yet</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-start space-x-3 pb-3 border-b last:border-0">
                <div className="mt-0.5">{getEventIcon(event.type)}</div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
