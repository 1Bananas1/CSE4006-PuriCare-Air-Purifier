# PuriCare System Architecture

## Table of Contents
1. [Overview](#overview)
2. [System Architecture Diagram](#system-architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [API Integration Points](#api-integration-points)
6. [Database Schema](#database-schema)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Overview

The PuriCare system consists of **4 main components** that work together to provide intelligent air purification:

1. **Frontend (PWA/Mobile App)** - User interface for control and monitoring
2. **Firebase Backend API** - Main backend for authentication, device management, and data storage
3. **AQI Proxy Service (API 1)** - External API gateway for fetching air quality data
4. **Hardware Simulator (API 2)** - Simulates physical air purifier devices

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React PWA / React Native | Mobile-first user interface |
| Firebase API | Node.js + Express + Firebase Admin SDK | Main backend service |
| AQI Proxy | Node.js + Express OR Python Flask | External API gateway with caching |
| Hardware Simulator | Node.js + Express OR Python Flask | Device simulation for testing |
| Database | Firebase Firestore | Primary data storage |
| Cache | In-memory OR Redis | Short-term AQI data caching |
| Authentication | Firebase Auth | User authentication (Google OAuth, Email/Password) |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS & CLIENTS                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │               │               │
                     ▼               ▼               ▼
        ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
        │   Mobile App   │  │   Web App      │  │  Physical      │
        │   (iOS/Android)│  │   (Desktop)    │  │  Device        │
        │   React Native │  │   React PWA    │  │  (Raspberry Pi)│
        └────────┬───────┘  └────────┬───────┘  └────────┬───────┘
                 │                   │                   │
                 │ Firebase ID Token │                   │ X-API-Key
                 │                   │                   │
                 └───────────────────┼───────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIREBASE AUTHENTICATION                              │
│                  (Google OAuth, Email/Password)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIREBASE BACKEND API                                │
│                     (server/src/firebase/)                                  │
│                      Port: 3001 (default)                                   │
│                                                                             │
│  Routes:                                                                    │
│  ├─ POST   /auth/register         - Create user profile                   │
│  ├─ GET    /auth/me                - Get user profile                      │
│  ├─ PUT    /auth/me                - Update user profile                   │
│  ├─ POST   /api/devices            - Register device                       │
│  ├─ GET    /api/devices            - List user devices                     │
│  ├─ GET    /api/devices/:id        - Get device details                    │
│  ├─ PUT    /api/devices/:id        - Update device settings                │
│  ├─ DELETE /api/devices/:id        - Remove device                         │
│  ├─ POST   /api/data/upload        - Upload sensor data (from device)      │
│  ├─ POST   /api/data/upload/batch  - Batch upload sensor data              │
│  └─ GET    /api/devices/:id/environment/latest - Get latest readings       │
└─────────────────┬───────────────────────────────────────┬──────────────────┘
                  │                                       │
                  │ Read/Write                            │ Read locationAirQuality
                  │                                       │
                  ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIREBASE FIRESTORE                                 │
│                                                                             │
│  Collections:                                                               │
│  ├─ users/                  - User profiles & preferences                  │
│  │  └─ {userId}/            - uid, email, location, respiratorySensitivities│
│  │                                                                          │
│  ├─ devices/                - Registered devices                           │
│  │  └─ {deviceId}/          - userId, name, location, settings, status     │
│  │                                                                          │
│  ├─ environmentData/        - Sensor readings & health events              │
│  │  └─ {dataId}/            - deviceId, aqi, pm25, temp, humidity, events  │
│  │                                                                          │
│  └─ locationAirQuality/     - External AQI data (populated by API 1)       │
│     └─ {locationId}/        - aqi, city, iaqi, time (from WAQI API)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                  ▲                                       ▲
                  │                                       │
                  │ Write                                 │ Read device configs
                  │                                       │
┌─────────────────┴───────────────────────────┐  ┌────────┴────────────────────┐
│      API 1: AQI PROXY SERVICE               │  │  API 2: HARDWARE SIMULATOR  │
│      (server/src/api/routes/                │  │  (server/src/hardware/)     │
│       locationAirQuality.js)                │  │   Port: 3003 (proposed)     │
│       Port: 3002 (proposed)                 │  │                             │
│                                             │  │  Simulates:                 │
│  Purpose:                                   │  │  - Air purifier device      │
│  - Fetch external AQI data                  │  │  - Sensor readings          │
│  - Cache responses (15min - 6hr)            │  │  - Control responses        │
│  - Upload to Firebase locationAirQuality/   │  │  - Online/offline status    │
│                                             │  │                             │
│  Routes:                                    │  │  Routes:                    │
│  ├─ GET  /api/aqi/:location                 │  │  ├─ GET  /device/:deviceId  │
│  ├─ POST /api/aqi/sync                      │  │  ├─ POST /device/:deviceId/ │
│  └─ GET  /api/aqi/batch?locations=...       │  │  │            /command      │
│                                             │  │  ├─ GET  /device/:deviceId/ │
│  Scheduled Jobs:                            │  │  │            /status       │
│  └─ Every 1-6 hours: Update Firebase        │  │  └─ POST /device/:deviceId/ │
│                                             │  │              /simulate-event │
└─────────────────┬───────────────────────────┘  └─────────────────────────────┘
                  │                                       ▲
                  │ HTTP Request                          │
                  │                                       │ Console Output
                  ▼                                       │ (for now)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                                     │
│                                                                             │
│  1. World Air Quality Index (WAQI)                                         │
│     - API: https://aqicn.org/api/                                          │
│     - Provides: AQI, PM2.5, PM10, O3, NO2, SO2, CO                         │
│     - Rate Limit: 1000 requests/day (free tier)                            │
│     - Token Required: Yes                                                  │
│                                                                             │
│  2. OpenWeatherMap (Optional)                                              │
│     - API: https://openweathermap.org/api                                  │
│     - Provides: Weather, temperature, humidity, air quality                │
│                                                                             │
│  3. IQAir (Optional)                                                       │
│     - API: https://www.iqair.com/air-pollution-data-api                    │
│     - Provides: Real-time air quality data                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Frontend (Mobile/Web App)

**Technology**: React PWA / React Native

**Responsibilities**:
- User authentication (Google Sign-In, Email/Password)
- Device management (QR code scanning, registration, control)
- Real-time air quality monitoring
- Automation routines creation
- Notification handling
- Settings management

**Key Features**:
- Firebase Auth integration for authentication
- Real-time Firestore listeners for live updates
- Push notification support
- Offline capability (PWA)
- Responsive design (mobile-first)

**Communication**:
- ➡️ **Firebase Auth**: User authentication
- ➡️ **Firebase API**: All CRUD operations
- ⬅️ **Firebase API**: Device status, sensor data, user profile

---

### 2. Firebase Backend API (Main Backend)

**Technology**: Node.js + Express + Firebase Admin SDK

**Port**: 3001 (default)

**Location**: `server/src/firebase/`

**Responsibilities**:
- User authentication & authorization (verify Firebase ID tokens)
- User profile management
- Device registration & management (max 6 devices per user)
- Environment data storage (sensor readings, health events)
- Real-time device status tracking
- Data aggregation & statistics

**Authentication Methods**:
1. **Firebase ID Token** (for users): `Authorization: Bearer <token>`
2. **API Key** (for devices): `X-API-Key: <key>`

**Key Collections**:
- `users/` - User profiles
- `devices/` - Device registrations
- `environmentData/` - Sensor readings & ML events
- `locationAirQuality/` - External AQI data (read-only from API 1)

**Communication**:
- ⬅️ **Frontend**: User requests (with Firebase ID token)
- ⬅️ **Physical Devices/Simulator**: Sensor data uploads (with API key)
- ↔️ **Firestore**: All database operations
- ⬅️ **API 1**: Reads `locationAirQuality` collection

---

### 3. AQI Proxy Service (API 1) - NEW

**Technology**: Node.js + Express OR Python Flask

**Port**: 3002 (proposed)

**Location**: `server/src/api/` (proposed)

**Problem It Solves**:
> Firebase Functions (free tier) cannot make outbound HTTP requests to external APIs. We need a separate service to fetch external AQI data.

**Responsibilities**:
1. Fetch air quality data from external APIs (WAQI, OpenWeatherMap, IQAir)
2. Cache responses to minimize API calls (15min - 6hr TTL)
3. Transform external API responses to our schema
4. Upload processed data to Firebase `locationAirQuality/` collection
5. Handle rate limiting & error handling

**Caching Strategy**:
- **In-memory cache**: Simple Map/Dictionary (development)
- **Redis cache**: Production-grade (optional)
- **Cache duration**:
  - Good AQI (0-50): 6 hours
  - Moderate AQI (51-100): 2 hours
  - Unhealthy AQI (101+): 30 minutes

**API Endpoints**:

```javascript
// Fetch AQI for a specific location
GET /api/aqi/:location
// Example: GET /api/aqi/Seoul
// Response: { aqi: 57, city: { name: "Seoul" }, ... }

// Manually trigger sync to Firebase
POST /api/aqi/sync
// Body: { location: "Seoul" }
// Action: Fetch fresh data + upload to Firebase

// Batch fetch multiple locations
GET /api/aqi/batch?locations=Seoul,Busan,Tokyo
// Response: [{ location: "Seoul", aqi: 57 }, ...]
```

**Scheduled Jobs**:
```javascript
// Run every 2 hours (configurable)
cron.schedule('0 */2 * * *', async () => {
  const activeLocations = await getActiveUserLocations();
  for (const location of activeLocations) {
    await fetchAndUploadAQI(location);
  }
});
```

**Firebase Integration**:
```javascript
// After fetching from external API, upload to Firebase
async function uploadToFirebase(locationData) {
  const db = admin.firestore();
  const docRef = db.collection('locationAirQuality').doc(locationData.city.name);

  await docRef.set({
    aqi: locationData.aqi,
    city: locationData.city,
    dominentpol: locationData.dominentpol,
    iaqi: locationData.iaqi,
    time: locationData.time,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

**Communication**:
- ➡️ **External APIs**: Fetch AQI data
- ➡️ **Firebase Firestore**: Write to `locationAirQuality/`
- ⬅️ **Scheduled Jobs**: Automatic updates every 1-6 hours

**Environment Variables**:
```bash
# .env for AQI Proxy Service
PORT=3002
WAQI_API_TOKEN=your_token_here
OPENWEATHER_API_KEY=your_key_here
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
CACHE_DURATION_MINUTES=30
```

---

### 4. Hardware Simulator (API 2) - NEW

**Technology**: Node.js + Express OR Python Flask

**Port**: 3003 (proposed)

**Location**: `server/src/hardware/` (proposed)

**Problem It Solves**:
> We don't have physical air purifier hardware yet. This service simulates a real device for testing the entire system.

**Responsibilities**:
1. Simulate air purifier device behavior
2. Read device configuration from Firebase
3. Generate realistic sensor readings (AQI, PM2.5, temp, humidity)
4. Simulate control responses (power, fan speed, mode changes)
5. Output device state to console (for now)
6. Later: Accept commands from mobile app via Firebase API

**Device Simulation Features**:
- ✅ Realistic sensor data generation (with random variations)
- ✅ Simulated AQI fluctuations based on time of day
- ✅ Fan speed affects simulated air quality over time
- ✅ Power on/off simulation
- ✅ Auto mode vs Manual mode behavior
- ✅ Health event detection simulation (cough/sneeze)
- ✅ Online/offline status
- ✅ Timer mode countdown

**API Endpoints**:

```javascript
// Get current device state
GET /device/:deviceId/status
// Response: { deviceId, power: true, fanSpeed: 50, mode: "auto", ... }

// Send command to device
POST /device/:deviceId/command
// Body: { command: "set_fan_speed", value: 75 }
// Response: { success: true, newState: {...} }

// Get latest sensor readings
GET /device/:deviceId/sensors
// Response: { aqi: 45, pm25: 12.5, temperature: 22.5, ... }

// Simulate health event (for testing)
POST /device/:deviceId/simulate-event
// Body: { eventType: "cough", confidence: 0.87 }
// Response: { success: true, eventLogged: true }
```

**Simulation Logic**:

```javascript
class AirPurifierSimulator {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.power = false;
    this.fanSpeed = 0;
    this.mode = "auto"; // "auto" | "manual"
    this.currentAQI = 75; // Start with moderate air quality
  }

  // Simulate air quality improvement when running
  tick() {
    if (this.power) {
      // Fan speed affects how quickly AQI improves
      const improvement = this.fanSpeed / 100 * 2; // Max 2 points per tick
      this.currentAQI = Math.max(0, this.currentAQI - improvement);
    } else {
      // Air quality degrades when off
      this.currentAQI = Math.min(200, this.currentAQI + 0.5);
    }

    // Add random fluctuation
    this.currentAQI += (Math.random() - 0.5) * 2;

    return this.getSensorReadings();
  }

  getSensorReadings() {
    return {
      aqi: Math.round(this.currentAQI),
      pm25: this.currentAQI * 0.5, // PM2.5 correlates with AQI
      pm10: this.currentAQI * 0.7,
      temperature: 20 + Math.random() * 5, // 20-25°C
      humidity: 40 + Math.random() * 20,   // 40-60%
      timestamp: new Date().toISOString()
    };
  }

  setCommand(command, value) {
    switch(command) {
      case "power":
        this.power = value;
        break;
      case "fan_speed":
        this.fanSpeed = value;
        break;
      case "mode":
        this.mode = value;
        break;
    }
    console.log(`[${this.deviceId}] Command executed: ${command} = ${value}`);
  }
}
```

**Firebase Integration**:

```javascript
// On startup, read device config from Firebase
async function initializeSimulator(deviceId) {
  const db = admin.firestore();
  const deviceDoc = await db.collection('devices').doc(deviceId).get();

  if (!deviceDoc.exists) {
    console.error(`Device ${deviceId} not found in Firebase`);
    return;
  }

  const deviceData = deviceDoc.data();
  console.log(`[Simulator] Initialized device: ${deviceData.name}`);
  console.log(`  Location: ${deviceData.location.name}`);
  console.log(`  Settings: ${JSON.stringify(deviceData.settings)}`);

  // Create simulator instance
  const simulator = new AirPurifierSimulator(deviceId);

  // Upload sensor data every 15 seconds
  setInterval(() => {
    const readings = simulator.tick();
    uploadSensorData(deviceId, readings);
  }, 15000);

  return simulator;
}

// Upload sensor data to Firebase API
async function uploadSensorData(deviceId, readings) {
  try {
    const response = await axios.post('http://localhost:3001/api/data/upload', {
      deviceId: deviceId,
      data: readings
    }, {
      headers: {
        'X-API-Key': process.env.DEVICE_API_KEY
      }
    });

    console.log(`✅ [${deviceId}] Sensor data uploaded:`, readings);
  } catch (error) {
    console.error(`❌ [${deviceId}] Failed to upload sensor data:`, error.message);
  }
}
```

**Console Output** (for now):
```
🟢 [DEVICE-001] Simulator Started
  Name: Living Room Purifier
  Location: Seoul, Living Room
  Mode: Auto
  Fan Speed: 50%

[15:30:00] [DEVICE-001] Sensor Reading:
  AQI: 45 (Good)
  PM2.5: 12.5 μg/m³
  PM10: 18.3 μg/m³
  Temperature: 22.5°C
  Humidity: 45.2%
  ✅ Data uploaded to Firebase

[15:30:15] [DEVICE-001] Sensor Reading:
  AQI: 44 (Good) ↓
  ...
```

**Communication**:
- ⬅️ **Firebase Firestore**: Read device configuration
- ➡️ **Firebase API**: Upload sensor data (via `/api/data/upload`)
- ➡️ **Console**: Output current state (for debugging)

**Environment Variables**:
```bash
# .env for Hardware Simulator
PORT=3003
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_API_URL=http://localhost:3001
DEVICE_API_KEY=your_device_api_key
DEVICE_ID=DEVICE-001
SIMULATION_INTERVAL_MS=15000
```

---

## Data Flow Diagrams

### Flow 1: User Monitors Air Quality

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Open app
     ▼
┌────────────┐
│ Frontend   │
└────┬───────┘
     │ 2. GET /api/devices (with Firebase ID token)
     ▼
┌──────────────┐      3. Query devices collection
│ Firebase API │─────────────────────────────────┐
└────┬─────────┘                                 │
     │ 4. Return device list                     ▼
     │                                    ┌────────────┐
     │                                    │ Firestore  │
     │ 5. GET /api/devices/:id/           │            │
     │    environment/latest              │ devices/   │
     ▼                                    │ environment│
┌────────────┐                            │ Data/      │
│ Frontend   │                            └────────────┘
└────┬───────┘                                 ▲
     │ 6. Read locationAirQuality              │
     │    for user's city                      │ 7. Read external
     ▼                                         │    AQI data
┌──────────────┐                               │
│ Firebase API │───────────────────────────────┘
└────┬─────────┘
     │ 8. Return combined data:
     │    - Device sensor readings
     │    - External AQI for location
     ▼
┌────────────┐
│ Frontend   │
│ Displays:  │
│ - Indoor:  │
│   AQI: 45  │
│ - Outdoor: │
│   AQI: 57  │
└────────────┘
```

---

### Flow 2: AQI Proxy Fetches External Data

```
┌──────────────────┐
│ Scheduled Job    │ (Every 2 hours)
│ (cron / setInterval)
└────┬─────────────┘
     │ 1. Trigger sync for active locations
     ▼
┌──────────────────┐
│ API 1:           │
│ AQI Proxy        │
└────┬─────────────┘
     │ 2. Get list of active user locations
     ▼
┌──────────────────┐      3. Query users collection
│ Firebase API     │◄──────────────────────────────┐
│ (or direct       │                               │
│  Firestore query)│                               │
└────┬─────────────┘                               │
     │ 4. Return: ["Seoul", "Busan", "Tokyo"]      │
     ▼                                             │
┌──────────────────┐                               │
│ API 1:           │                               │
│ AQI Proxy        │                               │
└────┬─────────────┘                               │
     │ 5. For each location:                       │
     │    Check cache first                        │
     │                                             │
     │ 6. If not cached or expired:                │
     │    Fetch from WAQI API                      │
     ▼                                             │
┌──────────────────┐                               │
│ External API:    │                               │
│ WAQI / IQAir     │                               │
└────┬─────────────┘                               │
     │ 7. Return AQI data                          │
     ▼                                             │
┌──────────────────┐                               │
│ API 1:           │                               │
│ AQI Proxy        │                               │
│ - Cache response │                               │
│ - Transform data │                               │
└────┬─────────────┘                               │
     │ 8. Upload to Firebase                       │
     │    locationAirQuality/                      │
     ▼                                             │
┌──────────────────┐                               │
│ Firestore        │◄──────────────────────────────┘
│ locationAirQuality/
│ ├─ Seoul/
│ │  └─ aqi: 57
│ ├─ Busan/
│ └─ Tokyo/
└──────────────────┘
```

---

### Flow 3: Hardware Simulator Uploads Sensor Data

```
┌──────────────────┐
│ API 2:           │
│ Hardware         │
│ Simulator        │
└────┬─────────────┘
     │ 1. On startup: Read device config
     ▼
┌──────────────────┐
│ Firestore        │
│ devices/DEVICE-001
│ {
│   name: "Living Room",
│   settings: {
│     autoMode: true,
│     fanSpeed: 50
│   }
│ }
└────┬─────────────┘
     │ 2. Return device config
     ▼
┌──────────────────┐
│ API 2:           │
│ Hardware         │
│ Simulator        │
│ - Initialize     │
│ - Start sensor   │
│   simulation     │
└────┬─────────────┘
     │ 3. Every 15 seconds:
     │    Generate sensor readings
     │
     │ 4. POST /api/data/upload
     │    X-API-Key: device-key
     │    Body: { deviceId, data: {...} }
     ▼
┌──────────────────┐
│ Firebase API     │
└────┬─────────────┘
     │ 5. Validate API key
     │ 6. Store in environmentData/
     ▼
┌──────────────────┐
│ Firestore        │
│ environmentData/ │
│ └─ {dataId}/     │
│    ├─ deviceId   │
│    ├─ aqi: 45    │
│    ├─ pm25: 12.5 │
│    └─ timestamp  │
└──────────────────┘
     │
     │ 7. Real-time update
     ▼
┌──────────────────┐
│ Frontend         │
│ (Live updates    │
│  via Firestore   │
│  listeners)      │
└──────────────────┘
```

---

### Flow 4: User Controls Device (Future)

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Adjust fan speed to 75%
     ▼
┌──────────────┐
│ Frontend     │
└────┬─────────┘
     │ 2. PUT /api/devices/:id
     │    Body: { settings: { fanSpeed: 75 } }
     ▼
┌──────────────┐
│ Firebase API │
└────┬─────────┘
     │ 3. Update Firestore devices/:id
     ▼
┌──────────────┐
│ Firestore    │
│ devices/:id  │
│ settings:    │
│   fanSpeed: 75
└────┬─────────┘
     │
     │ 4. Listen for changes
     │    (Firestore real-time listener)
     ▼
┌──────────────┐
│ API 2:       │
│ Hardware     │
│ Simulator    │
│ - Detect     │
│   settings   │
│   change     │
│ - Update     │
│   fan speed  │
└────┬─────────┘
     │ 5. Console output
     ▼
     [DEVICE-001] Fan speed changed: 50% → 75%
     [DEVICE-001] Air quality improving faster...
```

---

## API Integration Points

### Integration 1: Firebase API ← AQI Proxy

**Purpose**: AQI Proxy writes external air quality data to Firebase for the main API to read.

**Method**: AQI Proxy uses Firebase Admin SDK to write directly to Firestore.

**Collection**: `locationAirQuality/`

**Data Flow**: External API → AQI Proxy → Firestore → Firebase API → Frontend

**Code Example** (AQI Proxy):
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function uploadAQI(location, aqiData) {
  await db.collection('locationAirQuality').doc(location).set({
    aqi: aqiData.aqi,
    city: aqiData.city,
    dominentpol: aqiData.dominentpol,
    iaqi: aqiData.iaqi,
    time: aqiData.time,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

---

### Integration 2: Firebase API ← Hardware Simulator

**Purpose**: Hardware Simulator uploads sensor data to Firebase API.

**Method**: HTTP POST requests to Firebase API with API key authentication.

**Endpoint**: `POST /api/data/upload`

**Authentication**: `X-API-Key` header

**Data Flow**: Simulator → Firebase API → Firestore → Frontend

**Code Example** (Hardware Simulator):
```javascript
const axios = require('axios');

async function uploadSensorData(deviceId, readings) {
  await axios.post('http://localhost:3001/api/data/upload', {
    deviceId: deviceId,
    data: {
      aqi: readings.aqi,
      pm25: readings.pm25,
      temperature: readings.temperature,
      humidity: readings.humidity,
      eventType: readings.eventType, // "cough" | "sneeze" | null
      confidence: readings.confidence
    }
  }, {
    headers: {
      'X-API-Key': process.env.DEVICE_API_KEY,
      'Content-Type': 'application/json'
    }
  });
}
```

---

### Integration 3: Hardware Simulator → Firestore (Read Config)

**Purpose**: Hardware Simulator reads device configuration on startup.

**Method**: Firebase Admin SDK direct Firestore query.

**Collection**: `devices/`

**Data Flow**: Firestore → Hardware Simulator

**Code Example** (Hardware Simulator):
```javascript
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function loadDeviceConfig(deviceId) {
  const snapshot = await db.collection('devices')
    .where('deviceId', '==', deviceId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error(`Device ${deviceId} not found`);
  }

  const deviceDoc = snapshot.docs[0];
  return {
    id: deviceDoc.id,
    ...deviceDoc.data()
  };
}
```

---

## Database Schema

### Complete Firestore Schema

```javascript
// Collection: users
users/{userId}
{
  uid: "firebase-auth-uid",
  email: "user@example.com",
  username: "John Doe",
  photoURL: "https://...",
  location: {
    city: "Seoul",
    country: "South Korea",
    latitude: 37.5665,
    longitude: 126.9780
  },
  phone: "+82-10-1234-5678",
  dob: "1990-01-15",
  respiratorySensitivities: ["pollen", "dust"],
  quietHours: {
    start: "22:00",
    end: "07:00"
  },
  preferredTemp: {
    min: 20,
    max: 24,
    unit: "celsius"
  },
  preferredHumidity: {
    min: 40,
    max: 60
  },
  deviceCount: 2,
  createdAt: "2025-01-07T10:00:00.000Z",
  updatedAt: "2025-01-07T10:00:00.000Z"
}

// Collection: devices
devices/{deviceId}
{
  userId: "firebase-auth-uid",
  deviceId: "DEVICE-001",
  name: "Living Room Purifier",
  location: {
    name: "Living Room",
    city: "Seoul",
    latitude: 37.5665,
    longitude: 126.9780,
    lastUpdated: "2025-01-07T10:00:00.000Z"
  },
  settings: {
    autoMode: true,
    fanSpeed: 50,
    sensitivity: 2
  },
  status: {
    online: true,
    lastSeen: "2025-01-07T14:30:00.000Z"
  },
  createdAt: "2025-01-07T10:00:00.000Z",
  updatedAt: "2025-01-07T14:30:00.000Z"
}

// Collection: environmentData
environmentData/{dataId}
{
  deviceId: "firestore-device-doc-id",
  deviceHardwareId: "DEVICE-001",
  userId: "firebase-auth-uid",
  data: {
    aqi: 45,
    pm25: 12.5,
    pm10: 18.3,
    o3: 0.05,
    no2: 0.02,
    so2: 0.01,
    co: 0.3,
    dominantPollutant: "PM2.5",
    temperature: 22.5,
    humidity: 45.2,
    pressure: 1013.25,
    eventType: "cough",  // "cough" | "sneeze" | "sniff" | "snore" | null
    confidence: 0.87,
    raw: {}
  },
  location: {
    name: "Living Room",
    city: "Seoul"
  },
  timestamp: "2025-01-07T14:30:00.000Z",
  createdAt: "2025-01-07T14:30:05.000Z"
}

// Collection: locationAirQuality (populated by API 1)
locationAirQuality/{locationId}  // locationId = city name
{
  aqi: 57,
  city: {
    geo: [31.2047372, 121.4489017],
    name: "Shanghai (上海)"
  },
  dominentpol: "pm25",
  iaqi: {
    co: { v: 6.4 },
    h: { v: 70 },
    no2: { v: 16.5 },
    o3: { v: 32.5 },
    p: { v: 1022 },
    pm10: { v: 19 },
    pm25: { v: 57 },
    so2: { v: 4.1 },
    t: { v: 19 },
    w: { v: 1.5 }
  },
  iqx: 1437,
  time: {
    iso: "2025-11-07T11:00:00+08:00",
    s: "2025-11-07 11:00:00",
    tz: "+08:00",
    v: 1762513200
  },
  updatedAt: "2025-01-07T15:00:00.000Z"  // When API 1 last updated this
}
```

---

## Implementation Roadmap

### Phase 1: Setup & Foundation (Week 1)

**Completed**:
- ✅ Firebase project created
- ✅ Firebase API implemented (`server/src/firebase/`)
- ✅ User authentication endpoints
- ✅ Device management endpoints
- ✅ Environment data upload endpoints
- ✅ Firebase API documentation (FIREBASE_API_GUIDE.md)

**Next Steps**:
- [ ] Create project structure for API 1 (AQI Proxy)
- [ ] Create project structure for API 2 (Hardware Simulator)
- [ ] Set up environment variables for all services
- [ ] Test Firebase API endpoints manually (Postman/Thunder Client)

---

### Phase 2: API 1 - AQI Proxy Service (Week 2)

**Goals**: Implement external AQI data fetching with caching

**Tasks**:
1. [ ] Initialize Node.js/Express project in `server/src/api/`
2. [ ] Install dependencies: `express`, `axios`, `node-cron`, `firebase-admin`
3. [ ] Implement WAQI API integration
   - [ ] GET /api/aqi/:location
   - [ ] POST /api/aqi/sync
   - [ ] GET /api/aqi/batch
4. [ ] Implement in-memory caching
5. [ ] Add scheduled job (every 2 hours)
6. [ ] Implement Firebase upload logic
7. [ ] Add error handling & rate limiting
8. [ ] Test with Shanghai, Seoul, Busan locations
9. [ ] Document API endpoints

**Deliverables**:
- Working AQI Proxy service on port 3002
- `locationAirQuality/` collection populated with real data
- Scheduled updates working
- Basic logging & monitoring

---

### Phase 3: API 2 - Hardware Simulator (Week 3)

**Goals**: Simulate air purifier device for testing

**Tasks**:
1. [ ] Initialize Node.js/Express project in `server/src/hardware/`
2. [ ] Install dependencies: `express`, `axios`, `firebase-admin`
3. [ ] Implement AirPurifierSimulator class
   - [ ] Sensor data generation
   - [ ] Air quality improvement logic
   - [ ] Power on/off simulation
   - [ ] Fan speed effects
4. [ ] Implement API endpoints
   - [ ] GET /device/:deviceId/status
   - [ ] POST /device/:deviceId/command
   - [ ] GET /device/:deviceId/sensors
5. [ ] Integrate with Firebase API
   - [ ] Read device config on startup
   - [ ] Upload sensor data every 15 seconds
   - [ ] Listen for setting changes (optional)
6. [ ] Add console output formatting
7. [ ] Add health event simulation (cough/sneeze)
8. [ ] Test with multiple simulated devices
9. [ ] Document simulator API

**Deliverables**:
- Working Hardware Simulator on port 3003
- Console output showing device state
- Sensor data flowing to Firebase
- Realistic air quality simulation

---

### Phase 4: Integration Testing (Week 4)

**Goals**: Test all components working together

**Test Scenarios**:
1. [ ] **User Registration Flow**
   - Register new user via Firebase API
   - Verify user document in Firestore
   - Update user location
2. [ ] **Device Registration Flow**
   - Register device via Firebase API
   - Start Hardware Simulator for that device
   - Verify sensor data appearing in Firestore
3. [ ] **AQI Data Flow**
   - Trigger AQI Proxy sync
   - Verify `locationAirQuality/` updated
   - Check Firebase API returns external AQI
4. [ ] **End-to-End Monitoring**
   - User views device on frontend
   - Sees both indoor (simulator) and outdoor (AQI proxy) data
   - Data updates in real-time
5. [ ] **Device Control** (if time permits)
   - User changes fan speed via frontend
   - Firebase API updates device settings
   - Hardware Simulator detects change
   - Simulated air quality improves faster

**Deliverables**:
- All 3 services running simultaneously
- Data flowing through entire pipeline
- Integration test suite (manual or automated)
- Bug fixes & performance improvements

---

### Phase 5: Frontend Integration (Week 5-6)

**Goals**: Connect React PWA to backend services

**Tasks**:
1. [ ] Implement Firebase Auth in frontend
2. [ ] Create device management screens
3. [ ] Create air quality dashboard
4. [ ] Add real-time Firestore listeners
5. [ ] Implement device control interface
6. [ ] Add location-based AQI display
7. [ ] Test on mobile devices

---

## Next Immediate Steps

Based on your current state (Firebase DB partially set up, locationAirQuality collection created), here are your next 3 steps:

### Step 1: Explore Existing Codebase (5 minutes)
Let me help you explore what you already have in `server/` to understand what needs refactoring.

### Step 2: Set Up API 1 Structure (30 minutes)
Create the AQI Proxy Service:
```bash
cd server/src/api/routes/
# Create locationAirQuality.js (you mentioned this exists)
```

### Step 3: Set Up API 2 Structure (30 minutes)
Create the Hardware Simulator:
```bash
mkdir server/src/hardware/
cd server/src/hardware/
npm init -y
# Create simulator.js
```

---

## Questions for You

1. **Which technology do you prefer for API 1 & API 2?**
   - Node.js + Express (consistent with Firebase API)
   - Python + Flask (you mentioned Python expertise)

2. **Do you want to start with API 1 (AQI Proxy) or API 2 (Hardware Simulator) first?**
   - API 1 gets real external data into your system
   - API 2 simulates devices for testing

3. **What external AQI API should we use?**
   - WAQI (World Air Quality Index) - most popular
   - OpenWeatherMap - also has weather data
   - IQAir - very accurate

4. **Do you have the WAQI API token yet?**
   - Sign up: https://aqicn.org/data-platform/token/

---

**Ready to proceed?** Let me know which step you'd like to tackle first!
</robbins>
