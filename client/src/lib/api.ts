// Authenticated API + Device 관련 유틸
// client/src/app/lib/api.ts

import {
  isDemoMode,
  mockDelay,
  MOCK_DEVICES,
  MOCK_ALERTS,
  MOCK_DEVICE_STATUS,
  generateMockSensorData,
} from './mock-data';

// 🔹 1. API 기본 설정
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3020';

// Auth token from sessionStorage (보안 강화 - 탭 닫으면 자동 삭제)
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authData = sessionStorage.getItem('purecare_auth');
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (e) {
    console.error('Failed to parse auth data:', e);
    return null;
  }
}

// Handle token expiration and logout
function handleAuthError(): void {
  if (typeof window === 'undefined') return;

  // Clear auth data from sessionStorage
  try {
    sessionStorage.removeItem('purecare_auth');
  } catch (e) {
    console.error('Failed to clear auth data:', e);
  }

  // Dispatch a custom event to notify the app
  window.dispatchEvent(new CustomEvent('auth:expired'));

  // Show user-friendly message
  alert('Your session has expired. Please log in again.');

  // Redirect to login page
  window.location.href = '/login';
}

// 2. 공통 API 요청 함수
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
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
    // Handle authentication errors (401 Unauthorized or 403 Forbidden)
    if (response.status === 401 || response.status === 403) {
      console.warn('Authentication failed - token expired or invalid');
      handleAuthError();
      throw new Error('Authentication expired. Please log in again.');
    }

    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// 3. Device 타입들
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
  // 🎭 Demo Mode: Return mock devices
  if (isDemoMode()) {
    await mockDelay();
    return MOCK_DEVICES;
  }

  try {
    const devices = await apiRequest<any[]>('/api/devices');

    // 🔄 Fetch latest sensor data from PostgreSQL for each device
    const devicesWithSensorData = await Promise.all(
      devices.map(async (device) => {
        const deviceId = device.id || device.data?.deviceID;

        // Fetch latest sensor data from PostgreSQL
        let latestSensorData: SensorReading | null = null;
        try {
          const response = await apiRequest<{
            success: boolean;
            data: SensorReading;
          }>(`/api/sensor-data/${deviceId}/latest`);
          latestSensorData = response.data;
        } catch (error) {
          console.warn(`No sensor data found for device ${deviceId}, using Firebase fallback`);
          // Fallback to Firebase measurements if PostgreSQL has no data
        }

        // Calculate AQI from PostgreSQL data (preferred) or Firebase data (fallback)
        const aqi = latestSensorData
          ? calculateAQIFromSensorReading(latestSensorData)
          : calculateAQI(device.data?.measurements);

        // Convert sensitivity number (0, 1, 2) to string ('low', 'medium', 'high')
        const sensitivityMap: Record<number, 'low' | 'medium' | 'high'> = {
          0: 'low',
          1: 'medium',
          2: 'high',
        };
        const sensitivity = typeof device.settings?.sensitivity === 'number'
          ? sensitivityMap[device.settings.sensitivity] || 'medium'
          : (device.settings?.sensitivity as 'low' | 'medium' | 'high') || 'medium';

        return {
          id: deviceId,
          name: device.data?.name || 'Unnamed Device',
          customLocation: device.data?.customLocation || 'Unknown',
          aqi,
          aqiLabel: getAQILabel(aqi),
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
            sensitivity,
          },
          data: {
            timezone: device.data?.timezone,
            stationIdx: device.data?.stationIdx,
            geo: device.data?.geo,
          },
        };
      })
    );

    return devicesWithSensorData;
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    return [];
  }
}

// 4. 교수님 스펙에 맞춘 기기 등록 API

// Request/Response 타입 (문서 기반)
export interface RegisterDeviceRequest {
  deviceId: string;
  name: string;
  location: string;
}

export interface RegisterDeviceResponse {
  success: boolean;
  deviceId: string;
}

/**
 * Register a new device
 * Endpoint: POST /api/devices/register
 * Body: { deviceId, name, location }
 * Response: { success: true, deviceId: "AP-001" }
 */
export async function registerDevice(
  data: RegisterDeviceRequest,
): Promise<RegisterDeviceResponse> {
  return apiRequest<RegisterDeviceResponse>('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceID: data.deviceId,      // Backend expects deviceID (uppercase ID)
      name: data.name,
      customLocation: data.location, // Backend expects customLocation
    }),
  });
}

// 5. delete a device
export async function deleteDevice(deviceId: string): Promise<void> {
  await apiRequest(`/api/devices/${deviceId}`, {
    method: 'DELETE',
  });
}

// 6. Sensor data API
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
  deviceId: string,
): Promise<SensorReading | null> {
  // 🎭 Demo Mode: Return latest mock sensor reading
  if (isDemoMode()) {
    await mockDelay();
    const readings = generateMockSensorData(deviceId, 1);
    return readings[0] || null;
  }

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
  } = {},
): Promise<SensorReading[]> {
  // 🎭 Demo Mode: Return mock historical data
  if (isDemoMode()) {
    await mockDelay();
    const count = options.limit || 24;
    return generateMockSensorData(deviceId, count);
  }

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

// 7. device alerts
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
  unacknowledgedOnly: boolean = false,
): Promise<Alert[]> {
  // 🎭 Demo Mode: Return mock alerts
  if (isDemoMode()) {
    await mockDelay();
    let alerts = [...MOCK_ALERTS];
    if (unacknowledgedOnly) {
      alerts = alerts.filter((a) => !a.acknowledged);
    }
    return alerts.slice(0, limit);
  }

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

// 8. device controls

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
  deviceId: string,
): Promise<DeviceStatus | null> {
  // 🎭 Demo Mode: Return mock device status
  if (isDemoMode()) {
    await mockDelay();
    return MOCK_DEVICE_STATUS[deviceId] || MOCK_DEVICE_STATUS['demo-device-001'];
  }

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

// set fan speed
export async function setFanSpeed(
  deviceId: string,
  speed: number,
): Promise<void> {
  // 🎭 Demo Mode: Simulate success
  if (isDemoMode()) {
    await mockDelay(200);
    console.log(`[DEMO] Set fan speed to ${speed} for device ${deviceId}`);
    return;
  }

  await apiRequest(`/api/control/${deviceId}/fan-speed`, {
    method: 'POST',
    body: JSON.stringify({ speed }),
  });
}

// auto mode
export async function toggleAutoMode(
  deviceId: string,
  enabled: boolean,
): Promise<void> {
  // 🎭 Demo Mode: Simulate success
  if (isDemoMode()) {
    await mockDelay(200);
    console.log(`[DEMO] Set auto mode to ${enabled} for device ${deviceId}`);
    return;
  }

  await apiRequest(`/api/control/${deviceId}/auto-mode`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// set sensitivity
export async function setSensitivity(
  deviceId: string,
  level: 'low' | 'medium' | 'high',
): Promise<void> {
  // 🎭 Demo Mode: Simulate success
  if (isDemoMode()) {
    await mockDelay(200);
    console.log(`[DEMO] Set sensitivity to ${level} for device ${deviceId}`);
    return;
  }

  await apiRequest(`/api/control/${deviceId}/sensitivity`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

// toggle power
export async function togglePower(
  deviceId: string,
  on: boolean,
): Promise<void> {
  // 🎭 Demo Mode: Simulate success
  if (isDemoMode()) {
    await mockDelay(200);
    console.log(`[DEMO] Toggle power to ${on} for device ${deviceId}`);
    return;
  }

  await apiRequest(`/api/control/${deviceId}/power`, {
    method: 'POST',
    body: JSON.stringify({ on }),
  });
}

// 9. Helper functions

// calculate AQI from Firebase measurements (uppercase field names)
function calculateAQI(measurements: any): number {
  if (!measurements || !measurements.PM25) return 0;

  const pm25 = measurements.PM25;

  return calculateAQIFromPM25(pm25);
}

// calculate AQI from PostgreSQL sensor reading (lowercase field names)
function calculateAQIFromSensorReading(reading: SensorReading): number {
  if (!reading || !reading.pm25) return 0;

  return calculateAQIFromPM25(reading.pm25);
}

// Core AQI calculation from PM2.5 value (EPA formula)
function calculateAQIFromPM25(pm25: number): number {
  // Simple PM2.5 to AQI conversion (simplified EPA formula)
  if (pm25 <= 12) return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4)
    return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4)
    return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  if (pm25 <= 150.4)
    return Math.round(
      ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151,
    );
  if (pm25 <= 250.4)
    return Math.round(
      ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201,
    );
  return Math.round(
    ((500 - 301) / (500.4 - 250.5)) * (pm25 - 250.5) + 301,
  );
}

// get AQI label
function getAQILabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// get device subtitle
function getDeviceSubtitle(device: any): string {
  const online = device.status?.online ? '온라인' : '오프라인';
  const mode = device.settings?.autoMode ? '자동 모드' : '수동 모드';
  const fanSpeed = getFanSpeedLabel(device.settings?.fanSpeed || 0);

  return `${online} · ${mode} · ${fanSpeed}`;
}

// get fan speed label
function getFanSpeedLabel(speed: number): string {
  if (speed === 0) return '꺼짐';
  if (speed <= 3) return '약풍';
  if (speed <= 7) return '중풍';
  return '강풍';
}

// 10. Weather AQI
export interface OutdoorAQI {
  aqi: number;
  city: string;
  station: string;
  dominentpol: string;
  time: string;
}

// outdoor AQI from device's station
export async function getOutdoorAQI(
  stationIdx: number,
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

// 11. Room Graph (Rooms + Edges)

// ─────────────────────────────
// 타입 정의
// ─────────────────────────────
export interface RoomPosition {
  x: number;
  y: number;
}

export interface RoomSensors {
  avgPm25: number;
  avgPm10: number;
  avgVoc: number;
  avgCo2: number;
  avgTemperature: number;
  avgHumidity: number;
}

export interface RoomNode {
  id: string;
  name: string;
  userId: string;
  position: RoomPosition;
  deviceIds: string[];
  sensors?: RoomSensors;
  createdAt: string;
  updatedAt: string;
}

export type RoomEdgeType = 'door' | 'airflow';

export interface RoomEdge {
  id: string;
  userId: string;
  sourceRoomId: string;
  targetRoomId: string;
  type: RoomEdgeType;
  createdAt: string;
}

// ─────────────────────────────
// Rooms
// ─────────────────────────────

/**
 * Get all rooms
 * Endpoint: GET /api/rooms
 * Response: { rooms: RoomNode[] }
 */
export async function getRooms(): Promise<RoomNode[]> {
  const res = await apiRequest<{ rooms: RoomNode[] }>('/api/rooms');
  return res.rooms;
}

/**
 * Create room
 * Endpoint: POST /api/rooms
 * Body: { name, position, deviceIds? }
 */
export async function createRoom(payload: {
  name: string;
  position: RoomPosition;
  deviceIds?: string[];
}): Promise<{ success: boolean; roomId: string; message: string }> {
  return apiRequest('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      position: payload.position,
      deviceIds: payload.deviceIds ?? [],
    }),
  });
}

/**
 * Update room
 * Endpoint: PATCH /api/rooms/:roomId
 */
export async function updateRoom(
  roomId: string,
  updates: Partial<Pick<RoomNode, 'name' | 'position' | 'deviceIds'>>,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete room
 * Endpoint: DELETE /api/rooms/:roomId
 */
export async function deleteRoomApi(
  roomId: string,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/rooms/${roomId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────
// Edges
// ─────────────────────────────

/**
 * Get all room edges
 * Endpoint: GET /api/rooms/edges
 * Response: { edges: RoomEdge[] }
 */
export async function getRoomEdges(): Promise<RoomEdge[]> {
  const res = await apiRequest<{ edges: RoomEdge[] }>(
    '/api/rooms/edges',
  );
  return res.edges;
}

/**
 * Create room edge
 * Endpoint: POST /api/rooms/edges
 * Body: { sourceRoomId, targetRoomId, type }
 */
export async function createRoomEdge(payload: {
  sourceRoomId: string;
  targetRoomId: string;
  type: RoomEdgeType;
}): Promise<{ success: boolean; edgeId: string; message: string }> {
  return apiRequest('/api/rooms/edges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update room edge type
 * Endpoint: PATCH /api/rooms/edges/:edgeId
 */
export async function updateRoomEdgeType(
  edgeId: string,
  type: RoomEdgeType,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/rooms/edges/${edgeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ type }),
  });
}

/**
 * Delete room edge
 * Endpoint: DELETE /api/rooms/edges/:edgeId
 */
export async function deleteRoomEdgeApi(
  edgeId: string,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/rooms/edges/${edgeId}`, {
    method: 'DELETE',
  });
}

// 특정 deviceId를 하나의 Room에만 연결하는 헬퍼
export async function assignDeviceToRoom(
  deviceId: string,
  targetRoomId: string | null, // null이면 모든 방에서 해제
): Promise<void> {
  // 1) 현재 모든 방 가져오기
  const rooms = await getRooms();

  const tasks: Promise<any>[] = [];

  for (const room of rooms) {
    const hasDevice = room.deviceIds.includes(deviceId);
    const shouldHave = targetRoomId === room.id;

    // 상태가 그대로면 패치 안 함
    if (hasDevice === shouldHave) continue;

    const nextIds = room.deviceIds.filter((id) => id !== deviceId);
    if (shouldHave) nextIds.push(deviceId);

    tasks.push(
      updateRoom(room.id, {
        deviceIds: nextIds,
      }),
    );
  }

  await Promise.all(tasks);
}

