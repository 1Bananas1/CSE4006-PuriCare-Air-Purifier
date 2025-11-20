'use client';

import { useState } from 'react';
import { Room, RoomConnection } from '@/types/room';
import { Device } from '@/types/device';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Trash2, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RoomBuilderBottomSheetProps {
  room: Room | null;
  devices: Device[];
  edges: RoomConnection[];
  onUpdateRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose: () => void;
}

export function RoomBuilderBottomSheet({
  room,
  devices,
  edges,
  onUpdateRoom,
  onDeleteRoom,
  onDeleteEdge,
  onClose,
}: RoomBuilderBottomSheetProps) {
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
    <div className="fixed inset-x-0 bottom-0 z-30 bg-background border-t shadow-lg rounded-t-2xl max-h-[80vh] flex flex-col md:hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Edit Room</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name-mobile">Room Name</Label>
            <Input
              id="room-name-mobile"
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
                          id={`mobile-${device.id}`}
                          checked={selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <label
                          htmlFor={`mobile-${device.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
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

      <div className="p-4 border-t space-y-2 bg-background">
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
