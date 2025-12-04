// src/app/[locale]/rooms/graph/page.tsx
'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';

import {
  getRooms,
  getRoomEdges,
  createRoom,
  updateRoom,
  deleteRoomApi,
  createRoomEdge,
  updateRoomEdgeType,
  deleteRoomEdgeApi,
  type RoomNode,
  type RoomEdge,
} from '@/lib/api';

// ─────────────────────────────
// 노드 데이터 타입 & 유틸
// ─────────────────────────────

type RoomNodeData = {
  label: string;
  sensors?: RoomNode['sensors'];
  deviceCount: number;
};

function getPm25Status(pm25?: number) {
  if (pm25 == null) return { label: 'No data', color: '#64748b' };
  if (pm25 <= 12) return { label: 'Good', color: '#22c55e' };
  if (pm25 <= 35) return { label: 'Moderate', color: '#eab308' };
  return { label: 'Bad', color: '#ef4444' };
}

// 커스텀 Room 노드 컴포넌트 (모바일 카드 느낌)
// → NodeProps 제네릭 안 쓰고, 안에서 RoomNodeData로 캐스팅해서 타입 에러 제거
function RoomNodeComponent({ data }: NodeProps) {
  const nodeData = data as RoomNodeData;
  const name: string = nodeData.label;
  const sensors = nodeData.sensors;
  const deviceCount: number = nodeData.deviceCount ?? 0;

  const pm25 = sensors?.avgPm25;
  const co2 = sensors?.avgCo2;
  const temp = sensors?.avgTemperature;

  const pmStatus = getPm25Status(pm25);

  return (
    <div
      style={{
        minWidth: 180,
        maxWidth: 220,
        borderRadius: 16,
        padding: 10,
        background: 'rgba(15,23,42,0.96)',
        border: '1px solid rgba(148,163,184,0.65)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
        color: '#e5e7eb',
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 130,
          }}
        >
          {name}
        </div>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.6)',
          }}
        >
          {deviceCount} dev
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            opacity: 0.85,
          }}
        >
          PM2.5 / CO₂ / Temp
          <br />
          <span style={{ fontSize: 12 }}>
            {pm25 ?? '-'} / {co2 ?? '-'} / {temp ?? '-'}℃
          </span>
        </div>
        <div
          style={{
            textAlign: 'right',
            fontSize: 11,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: pmStatus.color,
            }}
          >
            {pmStatus.label}
          </div>
          <div style={{ opacity: 0.75 }}>status</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginTop: 4,
          opacity: 0.8,
          fontSize: 10,
        }}
      >
        <span
          style={{
            padding: '2px 6px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
          PM2.5 {pm25 ?? '-'}
        </span>
        <span
          style={{
            padding: '2px 6px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
          CO₂ {co2 ?? '-'}
        </span>
        <span
          style={{
            padding: '2px 6px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(51,65,85,0.9)',
          }}
        >
          {deviceCount} devices
        </span>
      </div>
    </div>
  );
}

// RoomNode → ReactFlow Node로 변환
function mapRoomToNode(room: RoomNode): Node {
  const data: RoomNodeData = {
    label: room.name,
    sensors: room.sensors,
    deviceCount: room.deviceIds.length,
  };

  return {
    id: room.id,
    position: room.position,
    type: 'room',
    data,
  };
}

// RoomEdge → ReactFlow Edge로 변환
function mapEdgeToFlowEdge(edge: RoomEdge): Edge {
  return {
    id: edge.id,
    source: edge.sourceRoomId,
    target: edge.targetRoomId,
    type: 'smoothstep',
    animated: edge.type === 'airflow',
    label: edge.type === 'door' ? '🚪' : '💨',
    data: { type: edge.type },
  } as Edge;
}

const nodeTypes: NodeTypes = {
  room: RoomNodeComponent,
};

export default function RoomGraphPage() {
  const router = useRouter();
  const errorTranslation = useTranslations('Errors');
  const roomTranslation = useTranslations('Rooms');

  // 1) 백엔드에서 rooms / edges 불러오기
  const {
    data: roomGraph,
    isLoading,
    mutate,
  } = useSWR<{ rooms: RoomNode[]; edges: RoomEdge[] }>(
    'room-graph-page',
    async () => {
      const [rooms, edges] = await Promise.all([getRooms(), getRoomEdges()]);
      return { rooms, edges };
    }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 백엔드 데이터가 바뀔 때마다 노드/엣지 동기화
  useEffect(() => {
    if (!roomGraph) return;
    setNodes(roomGraph.rooms.map(mapRoomToNode));
    setEdges(roomGraph.edges.map(mapEdgeToFlowEdge));
  }, [roomGraph, setNodes, setEdges]);

  const hasData =
    !!roomGraph && (roomGraph.rooms.length > 0 || roomGraph.edges.length > 0);

  // 노드 드래그 끝났을 때 → 위치 업데이트
  const onNodeDragStop = useCallback(
    async (_event: any, node: Node) => {
      try {
        await updateRoom(node.id, {
          position: node.position,
        });
        mutate();
      } catch (e) {
        console.error(e);
        alert('방 위치를 저장하는 데 실패했습니다.');
      }
    },
    [mutate]
  );

  // 노드 더블클릭 → 이름 변경
  const onNodeDoubleClick = useCallback(
    async (_event: any, node: Node) => {
      const current = String((node.data as any)?.label ?? '');
      const name = window.prompt('방 이름을 입력하세요', current);
      if (!name || name === current) return;
      try {
        await updateRoom(node.id, { name });
        mutate();
      } catch (e) {
        console.error(e);
        alert('방 이름 변경에 실패했습니다.');
      }
    },
    [mutate]
  );

  // 노드 삭제
  const onNodesDelete = useCallback(
    async (deleted: Node[]) => {
      for (const node of deleted) {
        try {
          await deleteRoomApi(node.id);
        } catch (e) {
          console.error(e);
        }
      }
      mutate();
    },
    [mutate]
  );

  // 노드 간 연결 생성
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        await createRoomEdge({
          sourceRoomId: connection.source,
          targetRoomId: connection.target,
          type: 'door',
        });
        // optimistic
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              id: `${connection.source}-${connection.target}-${Date.now()}`,
              type: 'smoothstep',
              animated: false,
              label: '🚪',
            },
            eds
          )
        );
        mutate();
      } catch (e: any) {
        console.error(e);
        alert(
          e?.message?.includes('already exists')
            ? errorTranslation('connectionAlreadyExists')
            : errorTranslation('failedCreateConnection')
        );
      }
    },
    [mutate, setEdges]
  );

  // 엣지 삭제
  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      for (const edge of deleted) {
        try {
          await deleteRoomEdgeApi(edge.id);
        } catch (e) {
          console.error(e);
        }
      }
      mutate();
    },
    [mutate]
  );

  // 엣지 클릭 → 타입 door <-> airflow 토글
  const onEdgeClick = useCallback(
    async (_: any, edge: Edge) => {
      const data = (edge.data || {}) as { type?: 'door' | 'airflow' };
      const currentType: 'door' | 'airflow' =
        data.type ?? (edge.label === '💨' ? 'airflow' : 'door');
      const newType: 'door' | 'airflow' =
        currentType === 'door' ? 'airflow' : 'door';

      try {
        await updateRoomEdgeType(edge.id, newType);
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edge.id
              ? {
                  ...e,
                  data: { ...(e.data as any), type: newType },
                  animated: newType === 'airflow',
                  label: newType === 'door' ? '🚪' : '💨',
                }
              : e
          )
        );
      } catch (e) {
        console.error(e);
        alert(errorTranslation('connectionTypeFail'));
      }
    },
    [setEdges]
  );

  // 방 추가
  const handleAddRoom = async () => {
    const name = window.prompt('새 방 이름을 입력하세요');
    if (!name) return;
    try {
      const randomPos = {
        x: Math.floor(Math.random() * 400),
        y: Math.floor(Math.random() * 300),
      };
      await createRoom({
        name,
        position: randomPos,
        deviceIds: [],
      });
      mutate();
    } catch (e) {
      console.error(e);
      alert(errorTranslation('roomCreationFail'));
    }
  };

  // ─────────────────────────────
  // 렌더
  // ─────────────────────────────

  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid rgba(148,163,184,0.3)',
          background: 'rgba(15,23,42,0.98)',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/home')}
          style={{
            fontSize: 13,
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.6)',
            background: 'transparent',
            color: 'inherit',
          }}
        >
          ← Home
        </button>
        <h1
          style={{
            fontSize: 17,
            fontWeight: 800,
          }}
        >
          Room Graph
        </h1>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleAddRoom}
          style={{
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid rgba(34,197,94,0.7)',
            background: 'rgba(22,163,74,0.95)',
            color: '#ecfdf5',
          }}
        >
          + {roomTranslation('newRoom')}
        </button>
      </header>

      <div
        style={{
          padding: '8px 16px',
          fontSize: 11,
          opacity: 0.8,
          background:
            'linear-gradient(135deg, rgba(30,64,175,0.35), rgba(15,23,42,0.95))',
          borderBottom: '1px solid rgba(30,64,175,0.6)',
        }}
      >
        {roomTranslation('instructionOne')}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {!isLoading && !hasData && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                padding: 16,
                borderRadius: 16,
                background: 'rgba(15,23,42,0.96)',
                border: '1px solid rgba(148,163,184,0.65)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.6)',
                textAlign: 'center',
                maxWidth: 260,
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📍</div>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {roomTranslation('noRooms')}
              </div>
              <div style={{ opacity: 0.8, marginBottom: 10 }}>
                {roomTranslation('instructionTwo')}
              </div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeClick={onEdgeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.35}
          maxZoom={1.2}
        >
          <MiniMap
            style={{
              background: 'rgba(15,23,42,0.95)',
              borderRadius: 8,
            }}
          />
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </div>
    </main>
  );
}
