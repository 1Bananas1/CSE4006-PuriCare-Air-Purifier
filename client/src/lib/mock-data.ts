/**
 * Mock Data for Demo Mode
 *
 * Provides realistic sample data for all API endpoints when in demo mode.
 * No random data - everything is deterministic for consistent demos.
 */

import type { Device, SensorReading, Alert, DeviceStatus } from './api';

// ============================================================================
// Mock Devices
// ============================================================================

export const MOCK_DEVICES: Device[] = [
  {
    id: 'demo-device-001',
    name: 'Living Room Purifier',
    customLocation: 'Living Room',
    aqi: 42,
    aqiLabel: 'Good',
    subtitle: '온라인 · 자동 모드 · 중풍',
    status: {
      online: true,
      lastSeen: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    },
    settings: {
      autoMode: true,
      fanSpeed: 6,
      sensitivity: 'medium',
    },
    data: {
      timezone: 'Asia/Seoul',
      stationIdx: 123,
      geo: [37.5665, 126.978], // Seoul
    },
  },
  {
    id: 'demo-device-002',
    name: 'Bedroom Purifier',
    customLocation: 'Master Bedroom',
    aqi: 28,
    aqiLabel: 'Good',
    subtitle: '온라인 · 수동 모드 · 약풍',
    status: {
      online: true,
      lastSeen: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    settings: {
      autoMode: false,
      fanSpeed: 3,
      sensitivity: 'low',
    },
    data: {
      timezone: 'Asia/Seoul',
      stationIdx: 123,
      geo: [37.5665, 126.978],
    },
  },
  {
    id: 'demo-device-003',
    name: 'Office Purifier',
    customLocation: 'Home Office',
    aqi: 68,
    aqiLabel: 'Moderate',
    subtitle: '온라인 · 자동 모드 · 강풍',
    status: {
      online: true,
      lastSeen: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
    },
    settings: {
      autoMode: true,
      fanSpeed: 9,
      sensitivity: 'high',
    },
    data: {
      timezone: 'Asia/Seoul',
      stationIdx: 123,
      geo: [37.5665, 126.978],
    },
  },
];

// ============================================================================
// Mock Sensor Data Generator
// ============================================================================

/**
 * Generate mock historical sensor data
 * Creates a smooth, realistic pattern based on time of day
 */
export function generateMockSensorData(
  deviceId: string,
  count: number = 24
): SensorReading[] {
  const result: SensorReading[] = [];
  const now = new Date();

  // Device-specific base values
  const baseValues = {
    'demo-device-001': { pm25: 18, temp: 22, rh: 45 },
    'demo-device-002': { pm25: 12, temp: 21, rh: 50 },
    'demo-device-003': { pm25: 28, temp: 23, rh: 42 },
  };

  const base = baseValues[deviceId as keyof typeof baseValues] || {
    pm25: 20,
    temp: 22,
    rh: 45,
  };

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000); // Hourly
    const hour = timestamp.getHours();

    // PM2.5 varies by time of day (higher during cooking hours)
    let pm25Modifier = 0;
    if (hour >= 7 && hour <= 9) pm25Modifier = 8; // Morning cooking
    else if (hour >= 18 && hour <= 20) pm25Modifier = 12; // Evening cooking
    else if (hour >= 0 && hour <= 6) pm25Modifier = -3; // Night (lower)

    const pm25 = Math.max(5, base.pm25 + pm25Modifier + Math.sin(i / 3) * 4);
    const pm10 = pm25 * 1.5;

    // Temperature slightly varies
    const tempModifier = Math.sin(i / 4) * 2;
    const temp = base.temp + tempModifier;

    // Humidity inversely related to temp
    const rh = Math.max(30, Math.min(70, base.rh - tempModifier * 2));

    result.push({
      time: timestamp.toISOString(),
      pm25: Math.round(pm25 * 10) / 10,
      pm10: Math.round(pm10 * 10) / 10,
      temp: Math.round(temp * 10) / 10,
      rh: Math.round(rh),
      co: 0.3 + Math.sin(i / 5) * 0.1,
      co2: 600 + Math.sin(i / 4) * 100,
      no2: 0.02 + Math.sin(i / 6) * 0.01,
      tvoc: 0.35 + Math.sin(i / 7) * 0.15,
    });
  }

  return result;
}

// ============================================================================
// Mock Alerts
// ============================================================================

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    type: 'pm25-spike',
    severity: 'medium',
    message: 'PM2.5 levels increased during cooking time',
    sensorValue: 45.2,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-002',
    type: 'pm25-spike',
    severity: 'low',
    message: 'Slight increase in particulate matter detected',
    sensorValue: 38.5,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
  {
    id: 'alert-003',
    type: 'humidity-high',
    severity: 'low',
    message: 'Humidity levels above optimal range',
    sensorValue: 68,
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
  {
    id: 'alert-004',
    type: 'co2-elevated',
    severity: 'medium',
    message: 'CO2 concentration elevated - consider ventilation',
    sensorValue: 850,
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-005',
    type: 'pm25-spike',
    severity: 'high',
    message: 'High PM2.5 detected - air purifier increased to maximum',
    sensorValue: 72.8,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
];

// ============================================================================
// Mock Device Status
// ============================================================================

export const MOCK_DEVICE_STATUS: Record<string, DeviceStatus> = {
  'demo-device-001': {
    online: true,
    fanSpeed: 6,
    autoMode: true,
    sensitivity: 'medium',
    timer: 'OFF',
    childLock: false,
  },
  'demo-device-002': {
    online: true,
    fanSpeed: 3,
    autoMode: false,
    sensitivity: 'low',
    timer: '4hr',
    childLock: true,
  },
  'demo-device-003': {
    online: true,
    fanSpeed: 9,
    autoMode: true,
    sensitivity: 'high',
    timer: 'OFF',
    childLock: false,
  },
};

// ============================================================================
// Helper: Check if in Demo Mode
// ============================================================================

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const authData = localStorage.getItem('purecare_auth');
    if (!authData) return false;

    const parsed = JSON.parse(authData);
    return parsed.demoMode === true;
  } catch {
    return false;
  }
}

// ============================================================================
// Mock API Delay (simulate network latency)
// ============================================================================

export function mockDelay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
