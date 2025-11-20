'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Device } from '@/types/device';
import { updateDeviceSettings } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Wind, Settings2, Zap } from 'lucide-react';

interface DeviceControlsProps {
  device: Device;
}

export function DeviceControls({ device }: DeviceControlsProps) {
  const [fanSpeed, setFanSpeed] = useState(device.fanSpeed);
  const [autoMode, setAutoMode] = useState(device.autoMode);
  const [sensitivity, setSensitivity] = useState(device.sensitivity);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateDeviceSettings(device.id, {
        fanSpeed,
        autoMode,
        sensitivity,
      });
      toast({
        title: 'Success',
        description: 'Device settings updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    fanSpeed !== device.fanSpeed ||
    autoMode !== device.autoMode ||
    sensitivity !== device.sensitivity;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="fan-speed" className="flex items-center space-x-2">
              <Wind className="h-4 w-4" />
              <span>Fan Speed</span>
            </Label>
            <span className="text-sm font-medium">{fanSpeed}%</span>
          </div>
          <Slider
            id="fan-speed"
            min={0}
            max={100}
            step={10}
            value={[fanSpeed]}
            onValueChange={([value]) => setFanSpeed(value)}
            disabled={autoMode}
          />
          {autoMode && (
            <p className="text-xs text-muted-foreground">
              Fan speed is controlled automatically
            </p>
          )}
        </div>

        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="auto-mode" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>Auto Mode</span>
          </Label>
          <Switch
            id="auto-mode"
            checked={autoMode}
            onCheckedChange={setAutoMode}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sensitivity" className="flex items-center space-x-2">
            <Settings2 className="h-4 w-4" />
            <span>Sensitivity</span>
          </Label>
          <Select value={sensitivity} onValueChange={(value: any) => setSensitivity(value)}>
            <SelectTrigger id="sensitivity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Higher sensitivity responds faster to air quality changes
          </p>
        </div>

        {hasChanges && (
          <Button onClick={handleUpdate} disabled={loading} className="w-full">
            {loading ? 'Updating...' : 'Apply Changes'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
