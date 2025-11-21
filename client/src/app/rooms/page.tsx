'use client';

import { useCallback, useState } from 'react';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/firestore-hooks';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { RoomNode, RoomNodeData } from '@/components/rooms/room-node';
import { RoomDetailPanel } from '@/components/rooms/room-detail-panel';
import { createRoomsFromDevices, sampleRoomConnections } from '@/lib/room-data';
import { Room } from '@/types/room';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  roomNode: RoomNode,
};

export default function RoomsPage() {
  const { user } = useAuth();
  const { devices, loading } = useDevices(user?.uid);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const router = useRouter();

  const rooms = createRoomsFromDevices(devices);

  const initialNodes: Node<RoomNodeData>[] = rooms.map((room) => ({
    id: room.id,
    type: 'roomNode',
    position: room.position,
    data: {
      name: room.name,
      deviceCount: room.deviceIds.length,
      sensors: room.sensors,
      onSelect: () => setSelectedRoom(room),
    },
  }));

  const initialEdges: Edge[] = sampleRoomConnections
    .filter((conn) => {
      // Only show edges where both rooms exist
      return rooms.some((r) => r.id === conn.source) && rooms.some((r) => r.id === conn.target);
    })
    .map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: 'smoothstep',
      animated: conn.type === 'airflow',
      label: conn.type === 'door' ? '🚪' : '💨',
      style: { stroke: conn.type === 'airflow' ? '#3b82f6' : '#6b7280' },
    }));

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const room = rooms.find((r) => r.id === node.id);
    if (room) {
      setSelectedRoom(room);
    }
  }, [rooms]);

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
      <main className="h-[calc(100vh-4rem)] relative">
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-card border rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Room Graph</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Click on a room to view details
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-8 h-0.5 bg-gray-500"></div>
                <span>Door</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span>Airflow</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-10">
          <Button onClick={() => router.push('/rooms/builder')}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Graph
          </Button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap nodeColor="#e5e7eb" />
        </ReactFlow>

        <RoomDetailPanel
          room={selectedRoom}
          devices={devices}
          onClose={() => setSelectedRoom(null)}
        />
      </main>
    </ProtectedRoute>
  );
}
