export interface Room {
  id: string;
  name: string;
  deviceIds: string[];
  position: { x: number; y: number };
  sensors: {
    avgPm25: number;
    avgVoc: number;
    avgCo2: number;
  };
}

export interface RoomConnection {
  id: string;
  source: string;
  target: string;
  type: 'door' | 'airflow';
}
