export interface Device {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  fanSpeed: number;
  autoMode: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  lastSeen: string;
  userId: string;
  sensors: SensorData;
}

export interface SensorData {
  pm25: number;
  pm10: number;
  voc: number;
  co2: number;
  temperature: number;
  humidity: number;
}

export interface DeviceEvent {
  id: string;
  timestamp: string;
  type: 'mode_change' | 'alert' | 'offline' | 'online';
  message: string;
}

export interface DeviceSettings {
  fanSpeed: number;
  autoMode: boolean;
  sensitivity: 'low' | 'medium' | 'high';
}
