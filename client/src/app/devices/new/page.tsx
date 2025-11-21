'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/lib/auth';
import { registerDevice } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NewDevicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    deviceId: '',
    name: '',
    cityName: '',
    roomId: '',
    fanSpeed: 3,
    autoMode: true,
    sensitivity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to add a device',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      await registerDevice(idToken, formData);
      
      toast({
        title: 'Device added successfully',
        description: `${formData.name} has been registered`,
      });
      
      router.push('/devices');
    } catch (error: any) {
      toast({
        title: 'Failed to add device',
        description: error.message || 'An error occurred while registering the device',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/devices')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Devices
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Add New Device</CardTitle>
            <CardDescription>
              Register a new air purifier to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID</Label>
                <Input
                  id="deviceId"
                  placeholder="e.g., AP-2024-001"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Device Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Living Room Purifier"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cityName">City Name</Label>
                <Input
                  id="cityName"
                  placeholder="e.g., Seoul"
                  value={formData.cityName}
                  onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  placeholder="e.g., living-room"
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fanSpeed">Fan Speed (0-5)</Label>
                <Input
                  id="fanSpeed"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.fanSpeed}
                  onChange={(e) => setFormData({ ...formData, fanSpeed: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sensitivity">Sensitivity</Label>
                <Select
                  value={formData.sensitivity}
                  onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') =>
                    setFormData({ ...formData, sensitivity: value })
                  }
                >
                  <SelectTrigger id="sensitivity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="autoMode">Auto Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Automatically adjust fan speed based on air quality
                  </div>
                </div>
                <Switch
                  id="autoMode"
                  checked={formData.autoMode}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoMode: checked })
                  }
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Device
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </ProtectedRoute>
  );
}
