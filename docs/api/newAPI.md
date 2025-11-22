# PuriCare Air Purifier - API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Frontend Integration](#frontend-integration)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Device Management](#device-management)
  - [Device Control](#device-control)
  - [Sensor Data](#sensor-data)
  - [Data Export](#data-export)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)

---

## Overview

The PuriCare API is a RESTful service built with Express.js that provides comprehensive control and monitoring of air purifier devices. It supports real-time communication via WebSockets and stores data in both Firebase Firestore (device metadata) and PostgreSQL (time-series sensor data).

**Key Features:**
- Device registration and management
- Real-time device control (fan speed, auto mode, sensitivity)
- Sensor data collection and analysis
- Historical data retrieval and export
- Real-time alerts via WebSocket
- Automated air quality monitoring

---

## Base URL

The API can be accessed at two different URLs depending on your environment:

**Development (Local):**
```
http://localhost:3020
```

**Production (Heroku):**
```
https://your-app-name.herokuapp.com
```

**Server Configuration:**
- Default Port: 3020 (local)
- CORS Enabled: Configurable via environment variables
- Framework: Express.js with Socket.io

**Environment Variables:**
- `PORT` - Server port (default: 3020)
- `CLIENT_URL` - Frontend URL for CORS configuration

---

## Authentication

The API uses Google OAuth ID Tokens for authentication.

### How to Authenticate

**1. Obtain a Google ID Token** (frontend)

Your app uses a custom auth context that stores the Google ID token in localStorage:

```javascript
// Using your custom auth context
import { useAuth } from '@/lib/auth';

const { auth } = useAuth();
const idToken = auth.idToken; // Google ID token
```

Or retrieve directly from localStorage:
```javascript
const getAuthToken = () => {
  try {
    const authData = localStorage.getItem('purecare_auth');
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (e) {
    return null;
  }
};
```

**2. Include Token in Requests**
```javascript
headers: {
  'Authorization': `Bearer ${idToken}`,
  'Content-Type': 'application/json'
}
```

### Protected Endpoints
The following endpoints require authentication:
- `POST /api/devices/register`
- `DELETE /api/devices/:deviceId`
- `GET /api/devices`

### Security Notes
⚠️ **Current Security Gaps:**
- Device control endpoints (`/api/control/*`) are NOT authenticated
- Sensor data read endpoints should verify device ownership
- Export endpoints should verify device ownership

---

## Frontend Integration

### Setting Up API Client

Create a reusable API client for your frontend:

```javascript
// lib/api-client.js

// Configure based on environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
                     process.env.REACT_APP_API_BASE_URL ||
                     process.env.NEXT_PUBLIC_API_BASE_URL ||
                     'http://localhost:3020';

class PuriCareAPI {
  constructor(getAuthToken, baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.getAuthToken = getAuthToken; // Function that returns current auth token
  }

  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    // Add auth token if available
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Device Management
  async registerDevice(deviceData) {
    return this.request('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
  }

  async getDevices() {
    return this.request('/api/devices');
  }

  async deleteDevice(deviceId) {
    return this.request(`/api/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  // Device Control
  async setFanSpeed(deviceId, speed) {
    return this.request(`/api/control/${deviceId}/fan-speed`, {
      method: 'POST',
      body: JSON.stringify({ speed }),
    });
  }

  async setAutoMode(deviceId, enabled) {
    return this.request(`/api/control/${deviceId}/auto-mode`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async setSensitivity(deviceId, level) {
    return this.request(`/api/control/${deviceId}/sensitivity`, {
      method: 'POST',
      body: JSON.stringify({ level }),
    });
  }

  async setPower(deviceId, on) {
    return this.request(`/api/control/${deviceId}/power`, {
      method: 'POST',
      body: JSON.stringify({ on }),
    });
  }

  async getDeviceStatus(deviceId) {
    return this.request(`/api/control/${deviceId}/status`);
  }

  // Sensor Data
  async getLatestSensorData(deviceId) {
    return this.request(`/api/sensor-data/${deviceId}/latest`);
  }

  async getSensorHistory(deviceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/sensor-data/${deviceId}/history?${query}`);
  }

  async getAlerts(deviceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/sensor-data/${deviceId}/alerts?${query}`);
  }

  // Export
  getCSVExportURL(deviceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${this.baseURL}/api/export/${deviceId}/csv?${query}`;
  }

  getJSONExportURL(deviceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${this.baseURL}/api/export/${deviceId}/json?${query}`;
  }
}

export default PuriCareAPI;
```

### Environment Configuration

Create environment files for different deployment environments:

**.env.local** (Development)
```env
VITE_API_BASE_URL=http://localhost:3020
# or for Create React App
REACT_APP_API_BASE_URL=http://localhost:3020
# or for Next.js
NEXT_PUBLIC_API_BASE_URL=http://localhost:3020
```

**.env.production** (Production)
```env
VITE_API_BASE_URL=https://your-app-name.herokuapp.com
# or for Create React App
REACT_APP_API_BASE_URL=https://your-app-name.herokuapp.com
# or for Next.js
NEXT_PUBLIC_API_BASE_URL=https://your-app-name.herokuapp.com
```

**Note:** Replace `your-app-name` with your actual Heroku app name.

### Usage in React Components

```javascript
// In your app setup
import PuriCareAPI from './lib/api-client';

// Get auth token from localStorage (your custom auth system)
const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const authData = localStorage.getItem('purecare_auth');
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (e) {
    return null;
  }
};

// API client will automatically use the correct URL based on environment
const api = new PuriCareAPI(getAuthToken);

// Or explicitly specify the URL
// const api = new PuriCareAPI(getAuthToken, 'https://your-heroku-app.herokuapp.com');

// In a component
const MyComponent = () => {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await api.getDevices();
        setDevices(data);
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      }
    };
    fetchDevices();
  }, []);

  const handleFanSpeedChange = async (deviceId, speed) => {
    try {
      await api.setFanSpeed(deviceId, speed);
      console.log('Fan speed updated');
    } catch (error) {
      console.error('Failed to update fan speed:', error);
    }
  };

  // ... rest of component
};
```

---

## API Endpoints

### Health Check

#### Get Server Health
Check if the API server is running and Firebase is connected.

**Endpoint:** `GET /health`

**Authentication:** None

**Response:**
```json
{
  "status": "healthy",
  "message": "PureCare API is running",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "firebase": "connected"
}
```

**Frontend Example:**
```javascript
const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  const data = await response.json();
  console.log(data.status); // "healthy"
};

// Or using the API client
const checkHealth = async () => {
  const response = await api.request('/health');
  console.log(response.status); // "healthy"
};
```

---

### Device Management

#### Register a Device
Register a new air purifier device to your account.

**Endpoint:** `POST /api/devices/register`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "deviceId": "string",
  "name": "string",
  "location": "string"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "deviceId": "AP-001"
}
```

**Error Responses:**
- `400` - Invalid device ID format
- `409` - Device already registered
- `500` - Server error

**Frontend Example:**
```javascript
const registerDevice = async (deviceInfo) => {
  const response = await api.registerDevice({
    deviceId: deviceInfo.id,
    name: deviceInfo.name,
    location: deviceInfo.location
  });
  console.log('Device registered:', response.deviceId);
};
```

---

#### Get All Devices
Get all devices owned by the authenticated user.

**Endpoint:** `GET /api/devices`

**Authentication:** Required (Bearer Token)

**Response:** `200 OK`
```json
[
  {
    "deviceId": "AP-001",
    "name": "Living Room Purifier",
    "location": "Living Room",
    "ownerId": "user123",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "online": true,
    "lastSeen": "2025-01-21T10:30:00.000Z"
  }
]
```

**Frontend Example:**
```javascript
const fetchDevices = async () => {
  const devices = await api.getDevices();
  setDevices(devices);
};
```

---

#### Delete a Device
Delete/unregister a device from your account.

**Endpoint:** `DELETE /api/devices/:deviceId`

**Authentication:** Required (Bearer Token - must be device owner)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Device deleted successfully"
}
```

**Error Responses:**
- `403` - Not authorized (not the owner)
- `404` - Device not found
- `500` - Server error

**Frontend Example:**
```javascript
const deleteDevice = async (deviceId) => {
  await api.deleteDevice(deviceId);
  console.log('Device deleted successfully');
};
```

---

### Device Control

All control endpoints emit WebSocket events to notify connected clients and devices.

#### Set Fan Speed
Control the device fan speed (0-10).

**Endpoint:** `POST /api/control/:deviceId/fan-speed`

**Authentication:** None (⚠️ Should be protected)

**Request Body:**
```json
{
  "speed": 5
}
```

**Validation:**
- `speed`: Integer between 0 and 10

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Fan speed updated",
  "deviceId": "AP-001",
  "fanSpeed": 5
}
```

**WebSocket Event:** Emits `device_control` to room `device:AP-001`

**Error Responses:**
- `400` - Invalid speed (not 0-10)
- `404` - Device not found
- `500` - Server error

**Frontend Example:**
```javascript
const setFanSpeed = async (deviceId, speed) => {
  // Validate before sending
  if (speed < 0 || speed > 10) {
    throw new Error('Speed must be between 0 and 10');
  }

  await api.setFanSpeed(deviceId, speed);
};
```

---

#### Set Auto Mode
Enable or disable automatic mode (device adjusts fan speed based on air quality).

**Endpoint:** `POST /api/control/:deviceId/auto-mode`

**Authentication:** None (⚠️ Should be protected)

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Auto mode enabled",
  "deviceId": "AP-001",
  "autoMode": true
}
```

**WebSocket Event:** Emits `device_control` to device room

**Frontend Example:**
```javascript
const toggleAutoMode = async (deviceId, enabled) => {
  await api.setAutoMode(deviceId, enabled);
};
```

---

#### Set Sensitivity
Set device sensitivity level for automatic mode.

**Endpoint:** `POST /api/control/:deviceId/sensitivity`

**Authentication:** None (⚠️ Should be protected)

**Request Body:**
```json
{
  "level": "medium"
}
```

**Valid Levels:**
- `"low"` (0)
- `"medium"` (1)
- `"high"` (2)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Sensitivity set to medium",
  "deviceId": "AP-001",
  "sensitivity": "medium"
}
```

**WebSocket Event:** Emits `device_control` to device room

**Frontend Example:**
```javascript
const setSensitivity = async (deviceId, level) => {
  const validLevels = ['low', 'medium', 'high'];
  if (!validLevels.includes(level)) {
    throw new Error('Invalid sensitivity level');
  }

  await api.setSensitivity(deviceId, level);
};
```

---

#### Set Power
Turn device on or off.

**Endpoint:** `POST /api/control/:deviceId/power`

**Authentication:** None (⚠️ Should be protected)

**Request Body:**
```json
{
  "on": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Device turned on",
  "deviceId": "AP-001",
  "power": true
}
```

**Side Effect:** When turning off (`on: false`), fan speed is automatically set to 0.

**WebSocket Event:** Emits `device_control` to device room

**Frontend Example:**
```javascript
const togglePower = async (deviceId, on) => {
  await api.setPower(deviceId, on);
};
```

---

#### Get Device Status
Get current device control status and online state.

**Endpoint:** `GET /api/control/:deviceId/status`

**Authentication:** None (⚠️ Should be protected)

**Response:** `200 OK`
```json
{
  "success": true,
  "deviceId": "AP-001",
  "status": {
    "online": false,
    "fanSpeed": 0,
    "autoMode": false,
    "sensitivity": "medium",
    "lastSeen": "2025-01-21T10:30:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
const getStatus = async (deviceId) => {
  const { status } = await api.getDeviceStatus(deviceId);
  console.log('Device is', status.online ? 'online' : 'offline');
  console.log('Fan speed:', status.fanSpeed);
};
```

---

### Sensor Data

Requires PostgreSQL database to be configured via `DATABASE_URL` environment variable.

#### Submit Sensor Data
Submit sensor readings from a device or simulator.

**Endpoint:** `POST /api/sensor-data`

**Authentication:** None (device endpoint)

**Request Body:**
```json
{
  "deviceId": "AP-001",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "sensors": {
    "RH": 45.5,
    "CO": 0.2,
    "CO2": 450,
    "NO2": 15.3,
    "PM10": 25.8,
    "PM25": 12.4,
    "TEMP": 22.5,
    "TVOC": 120
  }
}
```

**Field Descriptions:**
- `RH` - Relative Humidity (%)
- `CO` - Carbon Monoxide (ppm)
- `CO2` - Carbon Dioxide (ppm)
- `NO2` - Nitrogen Dioxide (ppb)
- `PM10` - Particulate Matter 10μm (μg/m³)
- `PM25` - Particulate Matter 2.5μm (μg/m³)
- `TEMP` - Temperature (°C)
- `TVOC` - Total Volatile Organic Compounds (ppb)

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Sensor data stored successfully",
  "deviceId": "AP-001",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "alertsGenerated": 2,
  "alerts": [
    {
      "type": "PM25_HIGH",
      "severity": "warning",
      "message": "PM2.5 levels are elevated"
    }
  ]
}
```

**Side Effects:**
- Stores data in PostgreSQL
- Updates device `lastSeen` timestamp in Firebase
- Detects pollutant level changes
- Generates alerts if thresholds exceeded
- Emits `sensor_alerts` via WebSocket if alerts generated

**Error Responses:**
- `400` - Missing required fields
- `404` - Device not found
- `503` - Database unavailable
- `500` - Server error

---

#### Get Latest Sensor Data
Get the most recent sensor reading for a device.

**Endpoint:** `GET /api/sensor-data/:deviceId/latest`

**Authentication:** None (⚠️ Should verify ownership)

**Response:** `200 OK`
```json
{
  "success": true,
  "deviceId": "AP-001",
  "data": {
    "time": "2025-01-21T10:30:00.000Z",
    "rh": 45.5,
    "co": 0.2,
    "co2": 450,
    "no2": 15.3,
    "pm10": 25.8,
    "pm25": 12.4,
    "temp": 22.5,
    "tvoc": 120
  }
}
```

**Error Responses:**
- `404` - No data found or device not found
- `503` - Database unavailable
- `500` - Server error

**Frontend Example:**
```javascript
const getLatestReadings = async (deviceId) => {
  const { data } = await api.getLatestSensorData(deviceId);
  console.log('Temperature:', data.temp, '°C');
  console.log('Humidity:', data.rh, '%');
  console.log('PM2.5:', data.pm25, 'μg/m³');
};
```

---

#### Get Sensor History
Get historical sensor readings within a time range.

**Endpoint:** `GET /api/sensor-data/:deviceId/history`

**Authentication:** None (⚠️ Should verify ownership)

**Query Parameters:**
- `startTime` - ISO 8601 timestamp (default: 24 hours ago)
- `endTime` - ISO 8601 timestamp (default: now)
- `limit` - Number of records (default: 100, max: 1000)

**Example Request:**
```
GET /api/sensor-data/AP-001/history?startTime=2025-01-20T10:00:00Z&endTime=2025-01-21T10:00:00Z&limit=500
```

**Response:** `200 OK`
```json
{
  "success": true,
  "deviceId": "AP-001",
  "count": 144,
  "data": [
    {
      "time": "2025-01-21T10:30:00.000Z",
      "rh": 45.5,
      "co": 0.2,
      "co2": 450,
      "no2": 15.3,
      "pm10": 25.8,
      "pm25": 12.4,
      "temp": 22.5,
      "tvoc": 120
    }
  ]
}
```

**Error Responses:**
- `400` - Invalid parameters
- `404` - Device not found
- `503` - Database unavailable
- `500` - Server error

**Frontend Example:**
```javascript
const getHistoricalData = async (deviceId, hours = 24) => {
  const endTime = new Date();
  const startTime = new Date(endTime - hours * 60 * 60 * 1000);

  const { data } = await api.getSensorHistory(deviceId, {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    limit: 1000
  });

  return data;
};
```

---

#### Get Device Alerts
Get alerts generated for a device based on sensor thresholds.

**Endpoint:** `GET /api/sensor-data/:deviceId/alerts`

**Authentication:** None (⚠️ Should verify ownership)

**Query Parameters:**
- `limit` - Number of alerts (default: 20, max: 100)
- `unacknowledged` - Only unacknowledged alerts (boolean, default: false)

**Example Request:**
```
GET /api/sensor-data/AP-001/alerts?limit=50&unacknowledged=true
```

**Response:** `200 OK`
```json
{
  "success": true,
  "deviceId": "AP-001",
  "count": 5,
  "alerts": [
    {
      "alert_id": 123,
      "device_id": "AP-001",
      "alert_type": "PM25_HIGH",
      "severity": "warning",
      "message": "PM2.5 levels are elevated (35 μg/m³)",
      "created_at": "2025-01-21T10:30:00.000Z",
      "acknowledged": false
    }
  ]
}
```

**Alert Types:**
- `PM25_HIGH` / `PM25_LOW` - PM2.5 level changes
- `PM10_HIGH` / `PM10_LOW` - PM10 level changes
- `CO2_HIGH` / `CO2_LOW` - CO2 level changes
- `TVOC_HIGH` / `TVOC_LOW` - TVOC level changes
- `CO_HIGH` / `CO_HIGH` - Carbon Monoxide changes
- `NO2_HIGH` / `NO2_LOW` - Nitrogen Dioxide changes

**Severity Levels:**
- `info` - Informational
- `warning` - Warning level
- `critical` - Critical level

**Frontend Example:**
```javascript
const getUnacknowledgedAlerts = async (deviceId) => {
  const { alerts } = await api.getAlerts(deviceId, {
    unacknowledged: true,
    limit: 50
  });

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  console.log(`${criticalAlerts.length} critical alerts`);
};
```

---

#### Check Sensor Service Health
Check if the sensor data service (PostgreSQL) is available.

**Endpoint:** `GET /api/sensor-data/health`

**Authentication:** None

**Response:** `200 OK`
```json
{
  "service": "Sensor Data Service",
  "status": "available",
  "message": "Database connected and ready"
}
```

Or if unavailable:
```json
{
  "service": "Sensor Data Service",
  "status": "unavailable",
  "message": "DATABASE_URL not configured"
}
```

---

### Data Export

Export sensor data in various formats for analysis.

#### Export as CSV
Download sensor data as a CSV file.

**Endpoint:** `GET /api/export/:deviceId/csv`

**Authentication:** None (⚠️ Should verify ownership)

**Query Parameters:**
- `startTime` - ISO 8601 timestamp (optional)
- `endTime` - ISO 8601 timestamp (optional)
- `limit` - Number of records (default: 10000, max: 10000)

**Response:** `200 OK` (File Download)
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="sensor-data-{deviceId}-{date}.csv"`

**CSV Columns:**
```
time, humidity, carbon_monoxide, carbon_dioxide, nitrogen_dioxide, pm10, pm25, temperature, volatile_compounds
```

**Error Responses:**
- `404` - No data found
- `503` - Database unavailable
- `500` - Server error

**Frontend Example:**
```javascript
const downloadCSV = (deviceId, startTime, endTime) => {
  const params = new URLSearchParams({
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    limit: '10000'
  });

  const url = api.getCSVExportURL(deviceId, params);

  // Trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = `sensor-data-${deviceId}.csv`;
  link.click();
};
```

---

#### Export as JSON
Download sensor data as a JSON file.

**Endpoint:** `GET /api/export/:deviceId/json`

**Authentication:** None (⚠️ Should verify ownership)

**Query Parameters:**
- `startTime` - ISO 8601 timestamp (optional)
- `endTime` - ISO 8601 timestamp (optional)
- `limit` - Number of records (default: 1000, max: 10000)

**Response:** `200 OK` (File Download)
- Content-Type: `application/json`
- Content-Disposition: `attachment; filename="sensor-data-{deviceId}-{date}.json"`

**JSON Structure:**
```json
{
  "deviceId": "AP-001",
  "exportedAt": "2025-01-21T10:30:00.000Z",
  "count": 144,
  "data": [
    {
      "time": "2025-01-21T10:30:00.000Z",
      "rh": 45.5,
      "co": 0.2,
      "co2": 450,
      "no2": 15.3,
      "pm10": 25.8,
      "pm25": 12.4,
      "temp": 22.5,
      "tvoc": 120
    }
  ]
}
```

**Frontend Example:**
```javascript
const downloadJSON = (deviceId, startTime, endTime) => {
  const params = new URLSearchParams({
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    limit: '10000'
  });

  const url = api.getJSONExportURL(deviceId, params);
  window.open(url, '_blank');
};
```

---

## WebSocket API

Real-time bidirectional communication using Socket.io.

### Connection

**URL:** Same as HTTP server (Socket.io protocol)

```javascript
import { io } from 'socket.io-client';

// Use environment variable for WebSocket URL
const WS_URL = import.meta.env.VITE_API_BASE_URL ||
               process.env.REACT_APP_API_BASE_URL ||
               process.env.NEXT_PUBLIC_API_BASE_URL ||
               'http://localhost:3020';

const socket = io(WS_URL, {
  auth: {
    token: 'your-firebase-id-token'
  }
});
```

### Client Events (Frontend → Server)

#### Join Device Room
Subscribe to updates for a specific device.

```javascript
socket.emit('join_device', deviceId);
```

**Server Response:**
```javascript
socket.on('joined_device', (data) => {
  console.log('Joined device:', data.deviceId);
});
```

---

#### Leave Device Room
Unsubscribe from device updates.

```javascript
socket.emit('leave_device', deviceId);
```

---

### Server Events (Server → Frontend)

#### Device Control Updates
Receive real-time device control changes.

```javascript
socket.on('device_control', (data) => {
  console.log('Device control update:', data);
  /*
  {
    type: "fan_speed" | "auto_mode" | "sensitivity" | "power",
    value: any,
    timestamp: "2025-01-21T10:30:00.000Z"
  }
  */
});
```

**Event Types:**
- `fan_speed` - Fan speed changed (value: 0-10)
- `auto_mode` - Auto mode toggled (value: boolean)
- `sensitivity` - Sensitivity changed (value: "low" | "medium" | "high")
- `power` - Device power changed (value: boolean)

---

#### Sensor Alerts
Receive alerts when sensor thresholds are exceeded.

```javascript
socket.on('sensor_alerts', (data) => {
  console.log('New alerts:', data);
  /*
  {
    deviceId: "AP-001",
    alerts: [
      {
        type: "PM25_HIGH",
        severity: "warning",
        message: "PM2.5 levels are elevated"
      }
    ],
    timestamp: "2025-01-21T10:30:00.000Z"
  }
  */
});
```

---

#### Error Events
Receive error notifications.

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});
```

---

### Complete WebSocket Example

```javascript
import { io } from 'socket.io-client';

const setupWebSocket = (deviceId) => {
  // WebSocket URL from environment
  const WS_URL = import.meta.env.VITE_API_BASE_URL ||
                 process.env.REACT_APP_API_BASE_URL ||
                 process.env.NEXT_PUBLIC_API_BASE_URL ||
                 'http://localhost:3020';

  // Get auth token from localStorage
  const authData = localStorage.getItem('purecare_auth');
  const token = authData ? JSON.parse(authData).idToken : null;

  if (token) {
    // Connect with authentication
    const socket = io(WS_URL, {
      auth: { token }
    });

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('join_device', deviceId);
    });

    socket.on('joined_device', (data) => {
      console.log('Subscribed to device:', data.deviceId);
    });

    // Device updates
    socket.on('device_control', (data) => {
      switch(data.type) {
        case 'fan_speed':
          updateFanSpeedUI(data.value);
          break;
        case 'auto_mode':
          updateAutoModeUI(data.value);
          break;
        case 'power':
          updatePowerUI(data.value);
          break;
      }
    });

    // Alert notifications
    socket.on('sensor_alerts', (data) => {
      data.alerts.forEach(alert => {
        showNotification(alert.message, alert.severity);
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Cleanup function
    return () => {
      socket.emit('leave_device', deviceId);
      socket.disconnect();
    };
  });
};
```

---

## Error Handling

### HTTP Error Codes

**Common Error Responses:**

**400 Bad Request**
```json
{
  "error": "Invalid request parameters",
  "details": "Speed must be between 0 and 10"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required",
  "details": "No valid authorization token provided"
}
```

**403 Forbidden**
```json
{
  "error": "Access denied",
  "details": "You do not own this device"
}
```

**404 Not Found**
```json
{
  "error": "Device not found",
  "details": "Device with ID 'AP-001' does not exist"
}
```

**409 Conflict**
```json
{
  "error": "Device already registered",
  "details": "A device with this ID already exists"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "details": "An unexpected error occurred"
}
```

**503 Service Unavailable**
```json
{
  "error": "Service unavailable",
  "details": "Database is not available"
}
```

### Frontend Error Handling

```javascript
const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;

    switch(status) {
      case 400:
        showError('Invalid request: ' + data.details);
        break;
      case 401:
        // Redirect to login
        redirectToLogin();
        break;
      case 403:
        showError('Access denied: ' + data.details);
        break;
      case 404:
        showError('Not found: ' + data.details);
        break;
      case 503:
        showError('Service temporarily unavailable');
        break;
      default:
        showError('An error occurred: ' + data.error);
    }
  } else if (error.request) {
    // Request made but no response
    showError('Network error: Unable to reach server');
  } else {
    // Other errors
    showError('Error: ' + error.message);
  }
};

// Usage
try {
  await api.setFanSpeed(deviceId, speed);
} catch (error) {
  handleAPIError(error);
}
```

---

## Code Examples

### Complete React Hook for Device Control

```javascript
// hooks/useDeviceControl.js
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAuth } from 'firebase/auth';
import api from '../lib/api-client';

export const useDeviceControl = (deviceId) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const { status: deviceStatus } = await api.getDeviceStatus(deviceId);
        setStatus(deviceStatus);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [deviceId]);

  // Setup WebSocket
  useEffect(() => {
    // WebSocket URL from environment
    const WS_URL = import.meta.env.VITE_API_BASE_URL ||
                   process.env.REACT_APP_API_BASE_URL ||
                   process.env.NEXT_PUBLIC_API_BASE_URL ||
                   'http://localhost:3020';

    // Get auth token from localStorage
    const authData = localStorage.getItem('purecare_auth');
    const token = authData ? JSON.parse(authData).idToken : null;

    if (token) {
      const newSocket = io(WS_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        newSocket.emit('join_device', deviceId);
      });

      newSocket.on('device_control', (data) => {
        setStatus(prev => ({
          ...prev,
          [data.type === 'fan_speed' ? 'fanSpeed' :
           data.type === 'auto_mode' ? 'autoMode' :
           data.type === 'sensitivity' ? 'sensitivity' : 'power']: data.value
        }));
      });

      setSocket(newSocket);

      return () => {
        newSocket.emit('leave_device', deviceId);
        newSocket.disconnect();
      };
    });
  }, [deviceId]);

  // Control functions
  const setFanSpeed = async (speed) => {
    try {
      await api.setFanSpeed(deviceId, speed);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const setAutoMode = async (enabled) => {
    try {
      await api.setAutoMode(deviceId, enabled);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const setSensitivity = async (level) => {
    try {
      await api.setSensitivity(deviceId, level);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const setPower = async (on) => {
    try {
      await api.setPower(deviceId, on);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    status,
    loading,
    error,
    setFanSpeed,
    setAutoMode,
    setSensitivity,
    setPower
  };
};
```

### Using the Hook in a Component

```javascript
import React from 'react';
import { useDeviceControl } from './hooks/useDeviceControl';

const DeviceControlPanel = ({ deviceId }) => {
  const {
    status,
    loading,
    error,
    setFanSpeed,
    setAutoMode,
    setSensitivity,
    setPower
  } = useDeviceControl(deviceId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!status) return <div>No device data</div>;

  return (
    <div className="control-panel">
      <h2>Device Control</h2>

      {/* Power Switch */}
      <div>
        <label>Power</label>
        <button onClick={() => setPower(!status.power)}>
          {status.power ? 'Turn Off' : 'Turn On'}
        </button>
      </div>

      {/* Fan Speed Slider */}
      <div>
        <label>Fan Speed: {status.fanSpeed}</label>
        <input
          type="range"
          min="0"
          max="10"
          value={status.fanSpeed}
          onChange={(e) => setFanSpeed(parseInt(e.target.value))}
          disabled={!status.power || status.autoMode}
        />
      </div>

      {/* Auto Mode Toggle */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={status.autoMode}
            onChange={(e) => setAutoMode(e.target.checked)}
          />
          Auto Mode
        </label>
      </div>

      {/* Sensitivity Select */}
      <div>
        <label>Sensitivity</label>
        <select
          value={status.sensitivity}
          onChange={(e) => setSensitivity(e.target.value)}
          disabled={!status.autoMode}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Status Indicator */}
      <div>
        <span className={status.online ? 'online' : 'offline'}>
          {status.online ? '● Online' : '○ Offline'}
        </span>
        <span>Last seen: {new Date(status.lastSeen).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default DeviceControlPanel;
```

---

## Quick Setup Guide

### Frontend Environment Setup

**Step 1: Create environment file**

For **Vite**:
```bash
# .env.local
VITE_API_BASE_URL=http://localhost:3020

# .env.production
VITE_API_BASE_URL=https://your-heroku-app.herokuapp.com
```

For **Create React App**:
```bash
# .env.local
REACT_APP_API_BASE_URL=http://localhost:3020

# .env.production
REACT_APP_API_BASE_URL=https://your-heroku-app.herokuapp.com
```

For **Next.js**:
```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3020

# .env.production
NEXT_PUBLIC_API_BASE_URL=https://your-heroku-app.herokuapp.com
```

**Step 2: Install dependencies**
```bash
npm install socket.io-client
```

Note: You don't need the Firebase SDK since you're using a custom Google OAuth implementation.

**Step 3: Copy the API client**
Copy the `PuriCareAPI` class from the [Frontend Integration](#frontend-integration) section to your project (e.g., `lib/api-client.js`).

**Step 4: Initialize in your app**
```javascript
import PuriCareAPI from './lib/api-client';

// Get auth token from your custom auth system (localStorage)
const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const authData = localStorage.getItem('purecare_auth');
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (e) {
    return null;
  }
};

export const api = new PuriCareAPI(getAuthToken);
```

**Step 5: Use in components**
```javascript
import { api } from './lib/api';

// Fetch devices
const devices = await api.getDevices();

// Control device
await api.setFanSpeed(deviceId, 5);

// Get sensor data
const { data } = await api.getLatestSensorData(deviceId);
```

---

## Additional Resources

**Repository Files:**
- API Routes: [server/src/api/routes/](server/src/api/routes/)
- Controllers: [server/src/api/controllers/](server/src/api/controllers/)
- Middleware: [server/src/api/middleware/](server/src/api/middleware/)
- Main Entry: [server/src/api/index.js](server/src/api/index.js)

**Environment Setup:**
See `.env.example` for required environment variables.

**Database Schema:**
- Firebase: Device metadata, user profiles
- PostgreSQL: Sensor readings (timeseries), alerts

### Server Environment Variables (Heroku)

Your Heroku server requires the following environment variables:

**Authentication & Firebase:**
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Database:**
```bash
DATABASE_URL=postgres://username:password@host:5432/database
```

**API & CORS:**
```bash
PORT=3020  # Optional, Heroku sets this automatically
CLIENT_URL=https://your-frontend-app.vercel.app  # Update for production frontend
```

**Optional (Air Quality):**
```bash
AQICN_TOKEN=your-aqicn-api-token
```

**Important Notes:**
- Update `CLIENT_URL` to match your production frontend URL (not localhost)
- `FIREBASE_PRIVATE_KEY` must include the `\n` newline characters
- All sensitive keys should be kept secure and never committed to git

---

## Security Recommendations

⚠️ **Critical Security Improvements Needed:**

1. **Add Authentication to Control Endpoints**
   - All `/api/control/*` endpoints should verify user owns device
   - Prevents unauthorized device control

2. **Add Ownership Verification**
   - Sensor data read endpoints should verify device ownership
   - Export endpoints should verify device ownership
   - Prevents data leaks

3. **Rate Limiting**
   - Implement rate limiting on all endpoints
   - Prevent abuse and DoS attacks

4. **Input Sanitization**
   - Validate all input parameters
   - Prevent injection attacks

5. **HTTPS in Production**
   - Use HTTPS for all API communication
   - Protect authentication tokens in transit

---

## Support

For issues, questions, or contributions, please refer to the project repository.

**Last Updated:** 2025-01-21
