const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3020';

// Auth token from localStorage

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authData = localStorage.getItem('purecare_auth');
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (e) {
    console.error('Failed to parse auth data:', e);
    return null;
  }
}

// Authenticated API request

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Device APIs
export interface Device {
  id: string;
  name: string;
  customLocation: string;
  aqi: number;
  aqiLabel: string;
  subtitle: string;
  status: {
    online: boolean;
    lastSeen: Date;
  };
  settings: {
    autoMode: boolean;
    fanSpeed: number;
    sensitivity: 'low' | 'medium' | 'high';
  };
  data: {
    timezone?: string;
    stationIdx?: number | null;
    geo?: [number, number];
  };
}

// Get all devices for authenticated user
export async function getDevices(): Promise<Device[]> {
  try {
    const devices = await apiRequest<any[]>('/api/devices');

    // Transform backend format to frontend format
    return devices.map((device) => ({
      id: device.data?.deviceID || device.id,
      name: device.data?.name || 'Unnamed Device',
      customLocation: device.data?.customLocation || 'Unknown',
      aqi: calculateAQI(device.data?.measurements),
      aqiLabel: getAQILabel(calculateAQI(device.data?.measurements)),
      subtitle: getDeviceSubtitle(device),
      status: {
        online: device.status?.online || false,
        lastSeen: device.status?.lastSeen
          ? new Date(device.status.lastSeen)
          : new Date(),
      },
      settings: {
        autoMode: device.settings?.autoMode || false,
        fanSpeed: device.settings?.fanSpeed || 0,
        sensitivity: device.settings?.sensitivity || 'medium',
      },
      data: {
        timezone: device.data?.timezone,
        stationIdx: device.data?.stationIdx,
        geo: device.data?.geo,
      },
    }));
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    return [];
  }
}

// register a new device
export async function registerDevice(deviceData: {
  deviceID: string;
  name: string;
  customLocation: string;
  geo: [number, number] | [null, null];
}): Promise<{ success: boolean; deviceId: string }> {
  return apiRequest('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify(deviceData),
  });
}

// delete a device
export async function deleteDevice(deviceId: string): Promise<void> {
  await apiRequest(`/api/devices/${deviceId}`, {
    method: 'DELETE',
  });
}

// sensor data API
export interface SensorReading {
  time: string;
  rh: number;
  co: number;
  co2: number;
  no2: number;
  pm10: number;
  pm25: number;
  temp: number;
  tvoc: number;
}

// get latest sensor Reading
export async function getLatestSensorData(
  deviceId: string
): Promise<SensorReading | null> {
  try {
    const response = await apiRequest<{
      success: boolean;
      data: SensorReading;
    }>(`/api/sensor-data/${deviceId}/latest`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch latest sensor data:', error);
    return null;
  }
}

// historical data
export async function getHistoricalSensorData(
  deviceId: string,
  options: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}
): Promise<SensorReading[]> {
  try {
    const params = new URLSearchParams();

    if (options.startTime) {
      params.append('startTime', options.startTime.toISOString());
    }
    if (options.endTime) {
      params.append('endTime', options.endTime.toISOString());
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    const response = await apiRequest<{
      success: boolean;
      data: SensorReading[];
    }>(`/api/sensor-data/${deviceId}/history?${params.toString()}`);

    return response.data;
  } catch (error) {
    console.error('Failed to fetch historical sensor data:', error);
    return [];
  }
}

//device alerts
export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  sensorValue: number;
  timestamp: string;
  acknowledged: boolean;
}
export async function getDeviceAlerts(
  deviceId: string,
  limit: number = 20,
  unacknowledgedOnly: boolean = false
): Promise<Alert[]> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      unacknowledged: unacknowledgedOnly.toString(),
    });

    const response = await apiRequest<{
      success: boolean;
      alerts: Alert[];
    }>(`/api/sensor-data/${deviceId}/alerts?${params.toString()}`);

    return response.alerts;
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return [];
  }
}

// device controls

export interface DeviceStatus {
  online: boolean;
  fanSpeed: number;
  autoMode: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  timer?: 'OFF' | '4hr' | '6hr' | '8hr';
  childLock?: boolean;
}

// device control status
export async function getDeviceStatus(
  deviceId: string
): Promise<DeviceStatus | null> {
  try {
    const response = await apiRequest<{
      status: DeviceStatus;
    }>(`/api/control/${deviceId}/status`);

    return {
      ...response.status,
      timer: response.status.timer || 'OFF',
      childLock: response.status.childLock || false,
    };
  } catch (error) {
    console.error('Failed to fetch device status:', error);
    return null;
  }
}

//set fan speed
export async function setFanSpeed(
  deviceId: string,
  speed: number
): Promise<void> {
  await apiRequest(`/api/control/${deviceId}/fan-speed`, {
    method: 'POST',
    body: JSON.stringify({ speed }),
  });
}

// auto mode
export async function toggleAutoMode(
  deviceId: string,
  enabled: boolean
): Promise<void> {
  await apiRequest(`/api/control/${deviceId}/auto-mode`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

//set sensitivity
export async function setSensitivity(
  deviceId: string,
  level: 'low' | 'medium' | 'high'
): Promise<void> {
  await apiRequest(`/api/control/${deviceId}/sensitivity`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

//toggle power
export async function togglePower(
  deviceId: string,
  on: boolean
): Promise<void> {
  await apiRequest(`/api/control/${deviceId}/power`, {
    method: 'POST',
    body: JSON.stringify({ on }),
  });
}

// helper functions

// calculate AQI
function calculateAQI(measurements: any): number {
  if (!measurements || !measurements.PM25) return 0;

  const pm25 = measurements.PM25;

  // Simple PM2.5 to AQI conversion (simplified EPA formula)
  if (pm25 <= 12) return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4)
    return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4)
    return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  if (pm25 <= 150.4)
    return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  if (pm25 <= 250.4)
    return Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
  return Math.round(((500 - 301) / (500.4 - 250.5)) * (pm25 - 250.5) + 301);
}

//get AQI label
function getAQILabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

//get device subtitle
function getDeviceSubtitle(device: any): string {
  const online = device.status?.online ? '온라인' : '오프라인';
  const mode = device.settings?.autoMode ? '자동 모드' : '수동 모드';
  const fanSpeed = getFanSpeedLabel(device.settings?.fanSpeed || 0);

  return `${online} · ${mode} · ${fanSpeed}`;
}

//get fan speed label
function getFanSpeedLabel(speed: number): string {
  if (speed === 0) return '꺼짐';
  if (speed <= 3) return '약풍';
  if (speed <= 7) return '중풍';
  return '강풍';
}

// weather AQI
export interface OutdoorAQI {
  aqi: number;
  city: string;
  station: string;
  dominentpol: string;
  time: string;
}

// outdoor AQI from device's station
export async function getOutdoorAQI(
  stationIdx: number
): Promise<OutdoorAQI | null> {
  try {
    // This would call your backend which then calls the AQI API
    // For now, return null if no station
    if (!stationIdx) return null;

    // TODO: Implement backend endpoint for fetching station AQI
    // const response = await apiRequest<OutdoorAQI>(`/api/aqi/station/${stationIdx}`);
    // return response;

    return null;
  } catch (error) {
    console.error('Failed to fetch outdoor AQI:', error);
    return null;
  }
}
