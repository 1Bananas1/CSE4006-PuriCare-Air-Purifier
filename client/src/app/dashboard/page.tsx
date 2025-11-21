'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/firestore-hooks';
import { DeviceCard } from '@/components/devices/device-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Wind, Droplets, Thermometer } from 'lucide-react';

export default function DashboardPage() {
  const { auth } = useAuth();
  // Create a simple uid from email for compatibility
  const uid = auth.profile?.email;
  const { devices, loading } = useDevices(uid);

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

  const avgPm25 = devices.length > 0 
    ? Math.round(devices.reduce((sum, d) => sum + d.sensors.pm25, 0) / devices.length) 
    : 0;
  const avgVoc = devices.length > 0 
    ? Math.round(devices.reduce((sum, d) => sum + d.sensors.voc, 0) / devices.length) 
    : 0;
  const avgTemp = devices.length > 0 
    ? Math.round(devices.reduce((sum, d) => sum + d.sensors.temperature, 0) / devices.length) 
    : 0;
  const avgHumidity = devices.length > 0 
    ? Math.round(devices.reduce((sum, d) => sum + d.sensors.humidity, 0) / devices.length) 
    : 0;
  const onlineDevices = devices.filter(d => d.status === 'online').length;

  return (
    <ProtectedRoute>
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your air quality across all devices</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineDevices}/{devices.length}</div>
              <p className="text-xs text-muted-foreground">Active purifiers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg PM2.5</CardTitle>
              <Wind className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPm25} µg/m³</div>
              <p className="text-xs text-muted-foreground">
                {avgPm25 < 12 ? 'Good' : avgPm25 < 35 ? 'Moderate' : 'Poor'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg VOC</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgVoc} ppb</div>
              <p className="text-xs text-muted-foreground">
                {avgVoc < 220 ? 'Good' : avgVoc < 660 ? 'Moderate' : 'Poor'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Environment</CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgTemp}°C</div>
              <p className="text-xs text-muted-foreground">{avgHumidity}% humidity</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Your Devices</h2>
          {devices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No devices found</p>
                <p className="text-sm text-muted-foreground">Add a device to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
