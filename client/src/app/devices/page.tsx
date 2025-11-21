'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/firestore-hooks';
import { DeviceCard } from '@/components/devices/device-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DevicesPage() {
  const { user } = useAuth();
  const { devices, loading } = useDevices(user?.uid);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filteredDevices = devices.filter(
    (device) =>
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.location.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <AppNav />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Devices</h1>
            <Button onClick={() => router.push('/devices/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>
          <p className="text-muted-foreground">Manage all your air purifiers</p>
        </div>

        <div className="mb-6">
          <Input
            type="text"
            placeholder="Search devices by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {filteredDevices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {search ? 'No devices match your search' : 'No devices found'}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? 'Try a different search term' : 'Add a device to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
