'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppNav } from '@/components/layout/app-nav';
import { useAuth } from '@/contexts/auth-context';
import { useDevices } from '@/lib/firestore-hooks';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  OnConnect,
} from '@xyflow/react';
import { RoomNode, RoomNodeData } from '@/components/rooms/room-node';
import { RoomBuilderToolbar } from '@/components/rooms/room-builder-toolbar';
import { RoomBuilderSidebar } from '@/components/rooms/room-builder-sidebar';
import { RoomBuilderBottomSheet } from '@/components/rooms/room-builder-bottom-sheet';
import { Room, RoomConnection } from '@/types/room';
import {
  saveRoom,
  saveEdge,
  deleteRoom as deleteRoomFromDb,
  deleteEdge as deleteEdgeFromDb,
  loadRooms,
  loadEdges,
} from '@/lib/firestore-rooms';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  roomNode: RoomNode,
};

type BuilderMode = 'select' | 'add-room' | 'add-edge';

export default function RoomBuilderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { devices } = useDevices(user?.uid);
  const { toast } = useToast();

  const [mode, setMode] = useState<BuilderMode>('select');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [edges, setEdges] = useState<RoomConnection[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  const addConnection = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    const exists = edges.some(
      (edge) => edge.source === sourceId && edge.target === targetId
    );

    if (exists) {
      toast({
        title: 'Edge already exists',
        description: 'These rooms are already connected.',
      });
      return;
    }

    const newEdge: RoomConnection = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId,
      type: 'door',
    };

    setEdges((prev) => [...prev, newEdge]);
    setEdgeSourceId(null);
    setMode('select');
    toast({
      title: 'Edge created',
      description: 'Connection added successfully',
    });
  }, [edges, toast]);

  // Load rooms and edges from Firestore
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const [loadedRooms, loadedEdges] = await Promise.all([
          loadRooms(user.uid),
          loadEdges(user.uid),
        ]);
        setRooms(loadedRooms);
        setEdges(loadedEdges);
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    };

    loadData();
  }, [user]);

  // Update ReactFlow nodes when rooms change
  useEffect(() => {
    const newNodes: Node<RoomNodeData>[] = rooms.map((room) => ({
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
    setNodes(newNodes);
  }, [rooms, setNodes]);

  // Update ReactFlow edges when edges change
  useEffect(() => {
    const newEdges: Edge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.type === 'airflow',
      label: edge.type === 'door' ? '🚪' : '💨',
      style: { stroke: edge.type === 'airflow' ? '#3b82f6' : '#6b7280' },
    }));
    setReactFlowEdges(newEdges);
  }, [edges, setReactFlowEdges]);

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (mode !== 'add-room') return;

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;

      const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: `Room ${rooms.length + 1}`,
        deviceIds: [],
        position: { x, y },
        sensors: {
          avgPm25: 0,
          avgVoc: 0,
          avgCo2: 0,
        },
      };

      setRooms([...rooms, newRoom]);
      setSelectedRoom(newRoom);
      setMode('select');
    },
    [mode, rooms]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();

      if (mode === 'add-edge') {
        if (!edgeSourceId) {
          setEdgeSourceId(node.id);
          toast({
            title: 'Source selected',
            description: 'Now click on the target room',
          });
        } else if (edgeSourceId !== node.id) {
          addConnection(edgeSourceId, node.id);
        }
      } else {
        const room = rooms.find((r) => r.id === node.id);
        if (room) {
          setSelectedRoom(room);
        }
      }
    },
    [mode, edgeSourceId, rooms, toast, addConnection]
  );

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      if (mode !== 'add-edge' || !connection.source || !connection.target) {
        return;
      }
      addConnection(connection.source, connection.target);
    },
    [mode, addConnection]
  );

  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const updatedRooms = rooms.map((room) =>
        room.id === node.id
          ? { ...room, position: node.position }
          : room
      );
      setRooms(updatedRooms);
    },
    [rooms]
  );

  const handleUpdateRoom = useCallback(
    (updatedRoom: Room) => {
      const updatedRooms = rooms.map((room) =>
        room.id === updatedRoom.id ? updatedRoom : room
      );
      setRooms(updatedRooms);
    },
    [rooms]
  );

  const handleDeleteRoom = useCallback(
    (roomId: string) => {
      setRooms(rooms.filter((room) => room.id !== roomId));
      setEdges(edges.filter((edge) => edge.source !== roomId && edge.target !== roomId));
      setSelectedRoom(null);
    },
    [rooms, edges]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges(edges.filter((edge) => edge.id !== edgeId));
    },
    [edges]
  );

  const handleAutoLayout = useCallback(() => {
    const layoutedRooms = rooms.map((room, index) => ({
      ...room,
      position: {
        x: 100 + (index % 4) * 250,
        y: 100 + Math.floor(index / 4) * 200,
      },
    }));
    setRooms(layoutedRooms);
  }, [rooms]);

  const handleSave = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to save',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      await Promise.all([
        ...rooms.map((room) => saveRoom(user.uid, room)),
        ...edges.map((edge) => saveEdge(user.uid, edge)),
      ]);

      toast({
        title: 'Saved ✓',
        description: 'Room graph saved successfully',
      });
    } catch (error) {
      console.error('Failed to save:', error);
      toast({
        title: 'Save failed',
        description: 'An error occurred while saving',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, rooms, edges, toast]);

  return (
    <ProtectedRoute>
      <AppNav />
      <main className="h-[calc(100vh-4rem)] relative">
        <div className="absolute top-4 right-4 z-10">
          <Button variant="outline" onClick={() => router.push('/rooms')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            View Graph
          </Button>
        </div>

        <RoomBuilderToolbar
          mode={mode}
          onModeChange={setMode}
          onAutoLayout={handleAutoLayout}
          onSave={handleSave}
          isSaving={isSaving}
        />

        <ReactFlow
          nodes={nodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap nodeColor="#e5e7eb" />
        </ReactFlow>

        <div className="hidden md:block">
          <RoomBuilderSidebar
            room={selectedRoom}
            devices={devices}
            edges={edges}
            onUpdateRoom={handleUpdateRoom}
            onDeleteRoom={handleDeleteRoom}
            onDeleteEdge={handleDeleteEdge}
            onClose={() => setSelectedRoom(null)}
          />
        </div>

        <div className="md:hidden">
          <RoomBuilderBottomSheet
            room={selectedRoom}
            devices={devices}
            edges={edges}
            onUpdateRoom={handleUpdateRoom}
            onDeleteRoom={handleDeleteRoom}
            onDeleteEdge={handleDeleteEdge}
            onClose={() => setSelectedRoom(null)}
          />
        </div>
      </main>
    </ProtectedRoute>
  );
}
