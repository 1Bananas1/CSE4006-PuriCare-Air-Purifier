'use client';

import type { ReactNode } from 'react';

// 외부 import 지우고, 로컬 타입으로 선언
type RoomSummary = {
  id: string;
  name: string;
  aqi: number;
  aqiLabel: string;
  status: { online: boolean };
  settings: { autoMode: boolean };
};

function ShellCard({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 18,
        padding: 16,
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(148,163,184,0.35)',
        display: 'block',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </button>
  );
}

export default function RoomCard({
  room,
  onClick,
}: {
  room: RoomSummary;
  onClick?: () => void;
}) {
  return (
    <ShellCard onClick={onClick}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{room.name}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          AQI {room.aqi} ({room.aqiLabel})
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          {room.status.online ? 'Online' : 'Offline'} ·{' '}
          {room.settings.autoMode ? 'Auto' : 'Manual'}
        </div>
      </div>
    </ShellCard>
  );
}

