'use client';

import { useState } from 'react';
import { Room, RoomConnection } from '@/types/room';
import { Device } from '@/types/device';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RoomBuilderSidebarProps {
  room: Room | null;
  devices: Device[];
  edges: RoomConnection[];
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose: () => void;
}

export function RoomBuilderSidebar({
  room,
  devices,
  edges,
  onUpdateRoom,
  onDeleteRoom,
  onDeleteEdge,
  onClose,
}: RoomBuilderSidebarProps) {
  const [name, setName] = useState(room?.name || '');
  const [selectedDevices, setSelectedDevices] = useState<string[]>(room?.deviceIds || []);

  if (!room) return null;

  const handleSave = () => {
    onUpdateRoom({
      ...room,
      name,
      deviceIds: selectedDevices,
    });
    onClose();
  };

  const connectedEdges = edges.filter(
    (edge) => edge.source === room.id || edge.target === room.id
  );

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-background border-l shadow-lg z-20 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Edit Room</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter room name"
            />
          </div>

          <div className="space-y-2">
            <Label>Position</Label>
            <div className="text-sm text-muted-foreground">
              X: {Math.round(room.position.x)}, Y: {Math.round(room.position.y)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Devices in This Room</Label>
            <Card>
              <CardContent className="pt-4">
                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No devices available</p>
                ) : (
                  <div className="space-y-2">
                    {devices.map((device) => (
                      <div key={device.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={device.id}
                          checked={selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <label
                          htmlFor={device.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {device.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <Label>Connected Rooms</Label>
            <Card>
              <CardContent className="pt-4">
                {connectedEdges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No connections</p>
                ) : (
                  <div className="space-y-2">
                    {connectedEdges.map((edge) => {
                      const otherRoomId = edge.source === room.id ? edge.target : edge.source;
                      return (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{edge.type}</Badge>
                            <span>{otherRoomId}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteEdge(edge.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-2">
        <Button onClick={handleSave} className="w-full">
          Save Changes
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            onDeleteRoom(room.id);
            onClose();
          }}
          className="w-full"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Room
        </Button>
      </div>
    </div>
  );
}
