'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/lib/auth';
import { useDevice, useDeviceEvents } from '@/lib/firestore-hooks';
import { SensorPanel } from '@/components/devices/sensor-panel';
import { EventLog } from '@/components/devices/event-log';
import { DeviceControls } from '@/components/devices/device-controls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin, Clock, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { deleteDevice } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const deviceId = params.id as string;
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();
  
  const { device, loading: deviceLoading } = useDevice(deviceId);
  const { events, loading: eventsLoading } = useDeviceEvents(deviceId, 10);

  const handleDelete = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to delete a device',
        variant: 'destructive',
      });
      return;
    }

    setDeleteLoading(true);

    try {
      const idToken = await user.getIdToken();
      await deleteDevice(idToken, deviceId);
      
      toast({
        title: 'Device deleted',
        description: 'The device has been removed successfully',
      });
      
      router.push('/devices');
    } catch (error: any) {
      toast({
        title: 'Failed to delete device',
        description: error.message || 'An error occurred while deleting the device',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (deviceLoading) {
    return (
      <ProtectedRoute>
        <AppNav />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!device) {
    return (
      <ProtectedRoute>
        <AppNav />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium mb-4">Device not found</p>
              <Button onClick={() => router.push('/devices')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Devices
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const isOnline = device.status === 'online';

  return (
    <ProtectedRoute>
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/devices')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{device.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{device.location}</span>
                </div>
                {device.lastSeen && (
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      Last seen{' '}
                      {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isOnline ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Device</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{device.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Sensor Readings</h2>
            <SensorPanel sensors={device.sensors} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <DeviceControls device={device} />
            {!eventsLoading && <EventLog events={events} />}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
