# PureCare Simulation Architecture

As we do not have access to a physical device, we are going to be using a laptop as our Air Purifier simulator.

---

## Table of Contents
1. [Network Architecture Overview](#network-architecture-overview)
2. [Firebase Firestore Basics](#firebase-firestore-basics)
3. [Real-Time Listeners Explained](#real-time-listeners-explained)
4. [Communication Patterns](#communication-patterns)
5. [Laptop Simulator Specification](#laptop-simulator-specification)
6. [Backend API Specification](#backend-api-specification)
7. [Frontend PWA Specification](#frontend-pwa-specification)
8. [Implementation Guide](#implementation-guide)

---

## Network Architecture Overview

### The Problem We're Solving

We need **bidirectional communication** between:
- **Laptop Simulator** (runs on localhost, behind a router/firewall)
- **Heroku Backend** (cloud server on the internet)
- **Frontend PWA** (web app accessed from browsers)

**The Challenge:** Your laptop doesn't have a public IP address, so the backend can't directly "call" your laptop to send commands.

### The Solution: Firebase Firestore as a Message Broker

Instead of direct connections, all three components connect to **Firebase Firestore** (a cloud database) and use it as a central hub:

```
                    ┌─────────────────────────┐
                    │  Firebase Firestore     │
                    │  (Cloud Database)       │
                    │                         │
                    │  Acts as the "middle    │
                    │  man" for all           │
                    │  communication          │
                    └─────────────────────────┘
                            ▲   ▲   ▲
                            │   │   │
           ┌────────────────┘   │   └────────────────┐
           │                    │                     │
           │                    │                     │
┌──────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Laptop Simulator │  │  Heroku Backend │  │   Frontend PWA  │
│   (localhost)     │  │  (Cloud Server) │  │  (Web Browser)  │
│                   │  │                 │  │                 │
│  Reads/Writes     │  │  Reads/Writes   │  │  Reads/Writes   │
│  Firestore data   │  │  Firestore data │  │  Firestore data │
└───────────────────┘  └─────────────────┘  └─────────────────┘
```

**Key Insight:** Instead of the backend "pushing" commands to the simulator, the simulator **watches** (listens to) the database for changes. When the backend updates the database, the simulator automatically receives the change.

---

## Firebase Firestore Basics

### What is Firestore?

Firebase Firestore is a **NoSQL cloud database** that stores data as JSON-like documents organized into collections. Think of it like:

- **Collection** = A folder (e.g., "devices")
- **Document** = A file with data (e.g., "device-001")
- **Fields** = Key-value pairs inside the document

```
Firestore Database
└── devices/                    ← Collection (like a folder)
    ├── device-001              ← Document (like a file)
    │   ├── linkedUserID: "user-123"
    │   ├── data: { ... }
    │   ├── settings: { fanSpeed: 3 }
    │   └── status: { online: true }
    │
    └── device-002              ← Another document
        └── ...
```

### Why Firestore for IoT?

1. **Real-time synchronization**: Changes instantly propagate to all connected clients
2. **Works behind firewalls**: Clients initiate connections (outbound), no port forwarding needed
3. **Automatic reconnection**: If internet drops, it reconnects and syncs automatically
4. **Free tier is generous**: Spark plan allows 50k reads + 20k writes per day
5. **No server required**: Clients can read/write directly (with security rules)

### Firestore vs Traditional REST API

**Traditional Approach (Polling):**
```
Every 5 seconds:
  Simulator → GET /api/devices/123/settings → Backend
  Backend → Query database → Return settings
  Simulator → Compare with local settings → Update if changed
```
- ❌ Wastes bandwidth (polls even when nothing changes)
- ❌ High latency (up to 5 seconds delay)
- ❌ More backend load

**Firestore Approach (Real-time Listeners):**
```
Once at startup:
  Simulator → Subscribe to devices/123 → Firestore
  [Simulator waits...]

When settings change:
  Backend → Update devices/123/settings → Firestore
  Firestore → Instantly notify simulator → Callback triggered
  Simulator → Update UI immediately
```
- ✅ Zero bandwidth waste (only notified on changes)
- ✅ Sub-second latency (~100-300ms)
- ✅ No backend load for reads

---

## Real-Time Listeners Explained

### The "Watching a Folder" Analogy

Imagine you have a shared folder on Dropbox:

1. **You open the folder** in your file browser (this is like "subscribing")
2. **Your friend adds a file** to the folder from their computer
3. **Your file browser automatically refreshes** and shows the new file

Firestore listeners work exactly the same way, but for database documents!

### How Firestore Listeners Work (Technical)

#### Step 1: Establish Connection (Simulator Side)

```python
# Python code in your laptop simulator
import firebase_admin
from firebase_admin import credentials, firestore

# Connect to Firebase (this is like logging into Dropbox)
cred = credentials.Certificate('device-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# Define what to do when data changes (the callback function)
def on_settings_change(doc_snapshot, changes, read_time):
    """This function runs automatically when settings change"""
    for doc in doc_snapshot:
        data = doc.to_dict()
        new_fan_speed = data['settings']['fanSpeed']
        print(f"🔔 Fan speed changed to: {new_fan_speed}")
        # Update your simulator dashboard here
        update_fan_speed_ui(new_fan_speed)

# Start watching the document (subscribe to changes)
device_ref = db.collection('devices').document('device-001')
settings_watch = device_ref.on_snapshot(on_settings_change)

# Your simulator continues running, callback fires when data changes
print("✓ Listening for settings changes...")
# Keep the program running
while True:
    time.sleep(1)  # Simulator continues other tasks
```

#### Step 2: Backend Updates Data

```javascript
// Node.js code on Heroku backend
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// API endpoint called by frontend
app.patch('/api/devices/:deviceId/settings', async (req, res) => {
  const { fanSpeed } = req.body;

  // Update Firestore document
  await db.collection('devices').doc('device-001').update({
    'settings.fanSpeed': fanSpeed,
    'settings.updatedAt': admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ success: true });
});
```

#### Step 3: Simulator Receives Update Automatically

```
Timeline:
T+0ms:    Frontend sends: PATCH /api/devices/device-001/settings { fanSpeed: 4 }
T+50ms:   Backend writes to Firestore: devices/device-001/settings/fanSpeed = 4
T+150ms:  Firestore notifies simulator (via WebSocket)
T+151ms:  Simulator's on_settings_change() callback runs
T+152ms:  Simulator dashboard updates to show fan speed = 4
```

**The simulator never polled! It was automatically notified.**

### Types of Firestore Listeners

1. **Document Listener**: Watch a single document
   ```python
   device_ref = db.collection('devices').document('device-001')
   device_ref.on_snapshot(callback)
   ```

2. **Collection Listener**: Watch all documents in a collection
   ```python
   devices_ref = db.collection('devices')
   devices_ref.on_snapshot(callback)
   ```

3. **Query Listener**: Watch documents matching a condition
   ```python
   online_devices = db.collection('devices').where('status.online', '==', True)
   online_devices.on_snapshot(callback)
   ```

### What Gets Sent Over the Network?

When a listener is active, Firestore uses a **WebSocket connection** (persistent TCP connection) between your simulator and Google's servers:

```
Initial connection (once):
  Simulator → "Hey Firestore, send me devices/device-001" → Firestore
  Firestore → [sends current document] → Simulator
  [WebSocket stays open]

When settings change:
  Backend → [writes new fanSpeed] → Firestore
  Firestore → [sends only the changed fields] → Simulator

  Payload sent: ~200 bytes
  {
    "settings": {
      "fanSpeed": 4  // Only this field
    }
  }
```

**Benefits:**
- Only changed fields are sent (not the whole document)
- Connection stays open (no reconnection overhead)
- Automatic batching if multiple fields change simultaneously

---

## Communication Patterns

### Pattern 1: Frontend → Backend → Device (Settings Update)

**Scenario:** User changes fan speed from 2 to 4 in the PWA

```
Step 1: User Action
  ┌─────────────┐
  │ Frontend    │  User clicks "Fan Speed: 4"
  │ PWA         │
  └──────┬──────┘
         │
         │ PATCH /api/devices/device-001/settings
         │ { fanSpeed: 4 }
         ▼
Step 2: Backend Processing
  ┌─────────────┐
  │ Heroku      │  1. Authenticate user
  │ Backend     │  2. Verify user owns device
  └──────┬──────┘  3. Update Firestore
         │
         │ db.collection('devices').doc('device-001').update(...)
         ▼
Step 3: Firestore Update
  ┌─────────────┐
  │ Firestore   │  Document updated:
  │ Database    │  devices/device-001/settings/fanSpeed = 4
  └──────┬──────┘
         │
         │ WebSocket notification (automatic)
         ▼
Step 4: Device Receives Update
  ┌─────────────┐
  │ Laptop      │  Callback triggered:
  │ Simulator   │  on_settings_change() runs
  └──────┬──────┘  Updates dashboard UI
         │
         │ Acknowledge by updating status
         ▼
  ┌─────────────┐
  │ Firestore   │  devices/device-001/status/lastSeen = now()
  │ Database    │  devices/device-001/status/lastCommandAck = "set_fan_speed"
  └─────────────┘
```

**Total Time:** ~200-500ms from click to dashboard update

---

### Pattern 2: Device → Firestore → Frontend (Sensor Data Publishing)

**Scenario:** Simulator publishes temperature reading every 10 seconds

```
Step 1: Simulator Generates Data
  ┌─────────────┐
  │ Laptop      │  temp_sensor.read() → 23.5°C
  │ Simulator   │  humidity_sensor.read() → 45%
  └──────┬──────┘  pm25_sensor.read() → 12 µg/m³
         │
         │ Write to Firestore
         ▼
Step 2: Firestore Update
  ┌─────────────┐
  │ Firestore   │  devices/device-001/measurements = {
  │ Database    │    temp: 23.5,
  └──────┬──────┘    RH: 45,
         │           pm25: 12
         │         }
         │
         │ WebSocket notification (automatic)
         ▼
Step 3: Frontend Receives Update
  ┌─────────────┐
  │ Frontend    │  Listener callback triggered
  │ PWA         │  Updates dashboard charts
  └─────────────┘  Shows notification if threshold exceeded
```

**Frequency:** Every 10 seconds (configurable)

---

### Pattern 3: Device → Firestore → Backend (Event Detection)

**Scenario:** Simulator detects a cough (AI model)

```
Step 1: Audio Detection
  ┌─────────────┐
  │ Laptop      │  1. Microphone captures audio
  │ Simulator   │  2. AI model analyzes: "COUGH" (confidence: 0.87)
  └──────┬──────┘  3. Generate event
         │
         │ Write event to Firestore
         ▼
Step 2: Create Event Document
  ┌─────────────┐
  │ Firestore   │  devices/device-001/events/1699900000 = {
  │ Database    │    type: "cough",
  └──────┬──────┘    confidence: 0.87,
         │           timestamp: "2025-11-13T14:23:15Z"
         │         }
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │ Frontend    │   │ Backend     │   │ Simulator   │
  │ PWA         │   │ (optional)  │   │ (Auto Mode) │
  └─────────────┘   └─────────────┘   └──────┬──────┘
  Shows event       Logs for         Increases
  notification      analytics        fan speed +1
```

**If Auto Mode Enabled:**
```
  ┌─────────────┐
  │ Simulator   │  1. Detect cough event
  │             │  2. Read current settings.fanSpeed (e.g., 2)
  └──────┬──────┘  3. Calculate new speed: 2 + 1 = 3
         │
         │ Update Firestore
         ▼
  ┌─────────────┐
  │ Firestore   │  devices/device-001/settings/fanSpeed = 3
  │ Database    │
  └──────┬──────┘
         │
         │ WebSocket notification
         ▼
  ┌─────────────┐
  │ Frontend    │  Dashboard shows fan speed increased
  │ PWA         │  "Auto mode: Responding to cough event"
  └─────────────┘
```

---

### Pattern 4: Backend Midnight Routine (Scheduled Task)

**Scenario:** Daily at midnight (per timezone), fetch external AQI data

```
Step 1: Heroku Cron Scheduler
  ┌─────────────┐
  │ Heroku      │  Cron: 0 * * * * (every hour)
  │ Scheduler   │  Checks all timezones for midnight window
  └──────┬──────┘
         │
         │ Run: npm run midnight
         ▼
Step 2: Midnight Routine Logic
  ┌─────────────┐
  │ Backend     │  1. Get all devices in "America/Chicago" timezone
  │ Script      │  2. Current time: 2025-11-13 00:05 (midnight!)
  └──────┬──────┘  3. Fetch AQI for city "St. Louis"
         │
         │ HTTPS request (outbound, allowed on Spark plan)
         ▼
  ┌─────────────┐
  │ AQICN API   │  GET https://api.waqi.info/feed/st.louis/?token=...
  │ (External)  │  Returns: { aqi: 42, pm25: 12, ... }
  └──────┬──────┘
         │
         │ Response
         ▼
Step 3: Store in Firestore
  ┌─────────────┐
  │ Backend     │  Process AQI data
  │ Script      │  Calculate recommendations
  └──────┬──────┘
         │
         │ Write to Firestore
         ▼
  ┌─────────────┐
  │ Firestore   │  locationAirQuality/st-louis = {
  │ Database    │    aqi: 42,
  └──────┬──────┘    pm25: 12,
         │           fetchedAt: "2025-11-13T06:00:00Z"
         │         }
         │
         │ WebSocket notification
         ▼
Step 4: Simulator Reads External AQI
  ┌─────────────┐
  │ Laptop      │  Listener triggered on locationAirQuality collection
  │ Simulator   │  Compares external AQI (42) with internal readings
  └──────┬──────┘  Displays notification: "External AQI: Good (42)"
         │
         │ Optional: Calibrate sensors
         ▼
  ┌─────────────┐
  │ Firestore   │  devices/device-001/data/externalAQI = 42
  │ Database    │  devices/device-001/data/lastCalibration = now()
  └─────────────┘
```

**Why this works on Spark plan:**
- ✅ Backend runs on Heroku (not a Cloud Function)
- ✅ Heroku can make external API calls freely
- ✅ Only Firestore reads/writes count against quota

---

## Laptop Simulator Specification

### Overview

The laptop acts as our physical device simulator, running a Python CLI application with:
- Real-time audio detection (cough/sneeze classification)
- Simulated environmental sensors (temp, humidity, PM2.5, CO, TVOC)
- Two-way state synchronization with Firestore
- Terminal-based dashboard UI

### Hardware Requirements

- **Microphone**: Built-in or USB microphone for audio capture
- **Internet**: Stable connection for Firestore real-time sync
- **Python**: 3.8+ with required libraries

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Laptop Simulator Process                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Audio Thread │  │ Sensor Thread│  │  UI Thread   │ │
│  │              │  │              │  │              │ │
│  │ • Microphone │  │ • Generate   │  │ • Terminal   │ │
│  │   capture    │  │   readings   │  │   dashboard  │ │
│  │ • AI model   │  │   every 10s  │  │ • Keyboard   │ │
│  │   inference  │  │ • Publish to │  │   input      │ │
│  │ • Event pub  │  │   Firestore  │  │ • Log events │ │
│  └───────┬──────┘  └───────┬──────┘  └──────┬───────┘ │
│          │                 │                 │         │
│          └─────────────────┴─────────────────┘         │
│                            │                           │
│                  ┌─────────▼──────────┐                │
│                  │ Firestore Listener │                │
│                  │                    │                │
│                  │ • Settings changes │                │
│                  │ • AQI updates      │                │
│                  │ • Callbacks        │                │
│                  └─────────┬──────────┘                │
│                            │                           │
└────────────────────────────┼───────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Firestore    │
                    │    Database     │
                    └─────────────────┘
```

### Firestore Document Structure

**Path:** `devices/{deviceID}`

```javascript
{
  linkedUserID: "user-uid-from-firebase-auth",

  data: {
    version: "1.0.0",
    customLocation: "Bedroom",           // Set by user in frontend
    deviceID: "TEST-DEVICE-001",         // Immutable primary key
    geo: [38.6270, -90.1994],           // [latitude, longitude], set by frontend
    measurements: {
      RH: 45.2,          // Relative humidity (%)
      co: 0.3,           // Carbon monoxide (ppm)
      no2: null,         // Nitrogen dioxide (ppb) - not simulated
      pm10: 25,          // Particulate matter 10 (µg/m³)
      pm25: 12,          // Particulate matter 2.5 (µg/m³)
      temp: 23.5,        // Temperature (°C)
      tvoc: 150,         // Total volatile organic compounds (ppb)
    },
    name: "Living Room Air Purifier",   // Set by user in frontend
    timezone: "America/Chicago",         // Set by user in frontend
    externalAQI: 42,                     // From midnight routine
    lastCalibration: Timestamp           // Last sensor calibration
  },

  settings: {
    autoMode: true,      // Boolean: automatic fan adjustment
    fanSpeed: 3,         // Integer 0-5: fan speed level
    sensitivity: 2       // Integer 0-2: LOW=0, MEDIUM=1, HIGH=2
  },

  status: {
    lastSeen: Timestamp,         // Updated every 10s when publishing data
    online: true,                // Boolean: device connectivity status
    lastCommandAck: "set_fan_speed", // Last command acknowledged
    commandAckedAt: Timestamp    // When command was processed
  }
}
```

**Sub-collection:** `devices/{deviceID}/events/{eventID}`

```javascript
{
  type: "cough",               // "cough", "sneeze", "snore"
  confidence: 0.87,            // Float 0-1: AI model confidence
  timestamp: Timestamp,        // When event occurred
  audioFile: null,             // Optional: path to saved audio (not implemented)
  autoModeResponse: {          // If auto mode triggered
    previousFanSpeed: 2,
    newFanSpeed: 3,
    reason: "Respiratory event detected"
  }
}
```

### Simulated Sensor Data Generation

Since we don't have real sensors, generate fake but realistic data:

```python
import random
import time

class SensorSimulator:
    def __init__(self):
        # Base values (will fluctuate around these)
        self.base_temp = 23.0       # °C
        self.base_humidity = 45.0   # %
        self.base_pm25 = 12.0       # µg/m³
        self.base_pm10 = 25.0       # µg/m³
        self.base_co = 0.3          # ppm
        self.base_tvoc = 150        # ppb

    def read_sensors(self):
        """Generate sensor readings with realistic variation"""
        return {
            'temp': round(self.base_temp + random.uniform(-0.5, 0.5), 1),
            'RH': round(self.base_humidity + random.uniform(-2, 2), 1),
            'pm25': max(0, round(self.base_pm25 + random.uniform(-3, 3))),
            'pm10': max(0, round(self.base_pm10 + random.uniform(-5, 5))),
            'co': round(max(0, self.base_co + random.uniform(-0.1, 0.1)), 2),
            'no2': None,  # Not simulated
            'tvoc': max(0, round(self.base_tvoc + random.uniform(-20, 20)))
        }

    def respond_to_event(self, event_type):
        """Simulate air quality degradation after respiratory event"""
        if event_type in ['cough', 'sneeze']:
            # Increase particulates temporarily
            self.base_pm25 += 5
            self.base_pm10 += 8
            self.base_tvoc += 30

    def apply_fan_speed(self, fan_speed):
        """Simulate air purification based on fan speed"""
        # Higher fan speed = faster air cleaning
        cleaning_rate = fan_speed * 0.5
        self.base_pm25 = max(5, self.base_pm25 - cleaning_rate)
        self.base_pm10 = max(10, self.base_pm10 - cleaning_rate * 1.5)
        self.base_tvoc = max(50, self.base_tvoc - cleaning_rate * 10)
```

### Dashboard UI Specification

```
╔══════════════════════════════════════════════════════════════╗
║                 PureCare Device Simulator                    ║
╠══════════════════════════════════════════════════════════════╣
║ Device: TEST-DEVICE-001          Status: ● ONLINE            ║
║ Location: Living Room            Uptime: 02:34:17            ║
║ Firestore Sync: ✓ Connected     Last Sync: 1s ago           ║
╠══════════════════════════════════════════════════════════════╣
║ DEVICE SETTINGS (Two-way sync)                               ║
║ ┌────────────────────────────────────────────────────────┐   ║
║ │ Fan Speed:     ████████░░░░░░░░ 3/5                    │   ║
║ │ Auto Mode:     ✓ ENABLED                               │   ║
║ │ Sensitivity:   ████████████████ HIGH                   │   ║
║ │ Last Command:  set_fan_speed (2.3s ago)                │   ║
║ └────────────────────────────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════╣
║ SENSOR READINGS (Simulated)         Last Updated: 1s ago     ║
║ ┌────────────────────────────────────────────────────────┐   ║
║ │ Temperature:   23.5°C      [████████████░░░░] NORMAL   │   ║
║ │ Humidity:      45.0%       [██████████░░░░░░] NORMAL   │   ║
║ │ PM2.5:         12 µg/m³    [████░░░░░░░░░░░░] GOOD     │   ║
║ │ PM10:          25 µg/m³    [████░░░░░░░░░░░░] GOOD     │   ║
║ │ CO:            0.3 ppm     [██░░░░░░░░░░░░░░] GOOD     │   ║
║ │ TVOC:          150 ppb     [███░░░░░░░░░░░░░] GOOD     │   ║
║ └────────────────────────────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════╣
║ EXTERNAL AIR QUALITY (From midnight routine)                 ║
║ City: St. Louis, MO          AQI: 42 (Good)                  ║
║ Dominant Pollutant: PM2.5    Last Updated: 6h ago            ║
╠══════════════════════════════════════════════════════════════╣
║ EVENT LOG (Last 10 events)                                   ║
║ [14:23:45] ⚙️  Fan speed changed: 2 → 3 (remote command)    ║
║ [14:23:30] 📊 Published sensor data (temp: 23.5°C)          ║
║ [14:23:15] 🤧 Cough detected (confidence: 0.87)             ║
║ [14:23:00] ✓  Command acknowledged: auto_mode_enable        ║
║ [14:22:45] 📊 Published sensor data (temp: 23.4°C)          ║
║ [14:22:30] ⚙️  Auto mode enabled (remote command)           ║
╚══════════════════════════════════════════════════════════════╝

Press 'q' to quit | 'c' to simulate cough | 's' to simulate sneeze
Keyboard Input: _
```

**Color Coding (use ANSI codes):**
- Green: Good air quality, online status
- Yellow: Moderate air quality, warnings
- Red: Poor air quality, errors
- Blue: Information, timestamps
- Cyan: User actions, commands

### Keyboard Commands

| Key | Action | Description |
|-----|--------|-------------|
| `q` | Quit | Gracefully shut down simulator |
| `c` | Simulate Cough | Trigger cough event manually |
| `s` | Simulate Sneeze | Trigger sneeze event manually |
| `n` | Simulate Snore | Trigger snore event manually |
| `+` | Increase Fan | Local fan speed +1 (publishes to Firestore) |
| `-` | Decrease Fan | Local fan speed -1 (publishes to Firestore) |
| `a` | Toggle Auto Mode | Enable/disable auto mode locally |
| `r` | Reset Sensors | Reset sensor baselines to defaults |
| `d` | Trigger Degradation | Simulate sudden air quality drop |

---

## Backend API Specification

### Technology Stack
- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.1.0
- **Database:** Firebase Firestore
- **Authentication:** Firebase Admin SDK (JWT tokens)
- **Deployment:** Heroku
- **Scheduler:** node-cron for midnight routine

### API Endpoints

#### 1. Device Management

**POST /api/devices/register**
```
Description: Register/claim a new device for a user
Authentication: Required (Firebase ID token)
Request Body:
{
  deviceID: "TEST-DEVICE-001",
  customLocation: "Living Room",
  timezone: "America/Chicago",
  geo: [38.6270, -90.1994],
  name: "My Air Purifier"
}

Response 200:
{
  success: true,
  deviceId: "TEST-DEVICE-001",
  message: "Device registered successfully"
}

Response 409:
{
  error: "Device already claimed"
}
```

**DELETE /api/devices/:deviceId**
```
Description: Unclaim and delete a device
Authentication: Required (must be device owner)

Response 200:
{
  success: true,
  message: "Device deleted successfully"
}
```

**GET /api/devices/:deviceId**
```
Description: Get device details
Authentication: Required (must be device owner)

Response 200:
{
  deviceId: "TEST-DEVICE-001",
  linkedUserID: "user-uid",
  data: { ... },
  settings: { ... },
  status: { ... }
}
```

#### 2. Settings Management (NEW - To Be Implemented)

**PATCH /api/devices/:deviceId/settings**
```
Description: Update device settings
Authentication: Required (must be device owner)
Request Body:
{
  fanSpeed: 4,           // Optional: 0-5
  autoMode: true,        // Optional: boolean
  sensitivity: 2         // Optional: 0-2
}

Response 200:
{
  success: true,
  settings: {
    fanSpeed: 4,
    autoMode: true,
    sensitivity: 2
  }
}

Implementation:
- Verify user owns device
- Validate input ranges
- Update Firestore: devices/{deviceId}/settings
- Firestore triggers device listener automatically
```

**GET /api/devices/:deviceId/settings**
```
Description: Get current device settings
Authentication: Required (must be device owner)

Response 200:
{
  autoMode: true,
  fanSpeed: 3,
  sensitivity: 2
}
```

#### 3. Measurements (NEW - To Be Implemented)

**GET /api/devices/:deviceId/measurements**
```
Description: Get latest sensor readings
Authentication: Required (must be device owner)

Response 200:
{
  temp: 23.5,
  RH: 45.0,
  pm25: 12,
  pm10: 25,
  co: 0.3,
  tvoc: 150,
  timestamp: "2025-11-13T14:23:30Z"
}
```

**GET /api/devices/:deviceId/events**
```
Description: Get event history
Authentication: Required (must be device owner)
Query Parameters:
  - limit: number (default: 50, max: 100)
  - startAfter: timestamp (pagination)
  - type: string (filter: "cough", "sneeze", "snore")

Response 200:
{
  events: [
    {
      id: "1699900000",
      type: "cough",
      confidence: 0.87,
      timestamp: "2025-11-13T14:23:15Z",
      autoModeResponse: { ... }
    },
    ...
  ],
  nextPageToken: "1699899000"
}
```

#### 4. External Air Quality (NEW - To Be Implemented)

**GET /api/aqi/:city**
```
Description: Get cached air quality data for a city
Authentication: Required
Path Parameters:
  - city: string (e.g., "st-louis", "chicago")

Response 200:
{
  aqi: 42,
  city: {
    geo: [38.6270, -90.1994],
    name: "St. Louis"
  },
  dominentpol: "pm25",
  iaqi: {
    co: 6.4,
    h: 70,
    no2: 16.5,
    o3: 32.5,
    p: 1022,
    pm10: 19,
    pm25: 57,
    so2: 4.1,
    t: 19,
    w: 1.5
  },
  time: {
    iso: "2025-11-13T06:00:00Z",
    s: "2025-11-13 06:00:00",
    tz: "-06:00"
  }
}

Implementation:
- Read from Firestore: locationAirQuality/{city}
- If data is stale (>1 hour), fetch fresh data from AQICN API
- Cache result in Firestore
```

### Midnight Routine Implementation

**File:** `server/src/api/scripts/midnightRoutine.js`

**Current Status:** Framework exists, business logic is TODO (line 102-109)

**Implementation Plan:**

```javascript
// Add to midnightRoutine.js at line 102
const aqiService = require('../services/aqiProxyService');

for (const deviceId of deviceIds) {
  const deviceDoc = await db.collection('devices').doc(deviceId).get();

  if (!deviceDoc.exists) {
    console.log(`⚠️  Device ${deviceId} not found`);
    continue;
  }

  const deviceData = deviceDoc.data();
  const cityName = deviceData.data.customLocation || 'Unknown';
  const geo = deviceData.data.geo;

  console.log(`• Processing device ${deviceId} in ${cityName}`);

  // 1. Fetch external AQI data for device location
  try {
    const aqiData = await aqiService.fetchAQIByCoordinates(geo[0], geo[1]);

    // 2. Store in locationAirQuality collection
    await db.collection('locationAirQuality').doc(cityName).set({
      ...aqiData,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Update device with external AQI reference
    await db.collection('devices').doc(deviceId).update({
      'data.externalAQI': aqiData.aqi,
      'data.lastCalibration': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`  ✓ Updated AQI for ${cityName}: ${aqiData.aqi}`);
  } catch (error) {
    console.error(`  ✗ Failed to fetch AQI for ${cityName}:`, error.message);
  }

  // 4. Generate daily summary (optional)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const eventsSnapshot = await db
    .collection('devices')
    .doc(deviceId)
    .collection('events')
    .where('timestamp', '>=', yesterday)
    .get();

  const dailyStats = {
    totalEvents: eventsSnapshot.size,
    coughs: 0,
    sneezes: 0,
    snores: 0
  };

  eventsSnapshot.forEach(doc => {
    const event = doc.data();
    if (event.type === 'cough') dailyStats.coughs++;
    if (event.type === 'sneeze') dailyStats.sneezes++;
    if (event.type === 'snore') dailyStats.snores++;
  });

  console.log(`  📊 Daily stats: ${dailyStats.totalEvents} events`);
  console.log(`     Coughs: ${dailyStats.coughs}, Sneezes: ${dailyStats.sneezes}`);
}
```

**AQI Proxy Service Implementation:**

**File:** `server/src/api/services/aqiProxyService.js`

```javascript
const fetch = require('node-fetch');

class AQIProxyService {
  constructor() {
    this.apiToken = process.env.AQICN_TOKEN;
    this.baseUrl = 'https://api.waqi.info';
    this.cache = new Map(); // Simple in-memory cache
    this.cacheDuration = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Fetch AQI data by city name
   * @param {string} city - City name (e.g., "st.louis", "chicago")
   * @returns {Promise<Object>} AQI data
   */
  async fetchAQIByCity(city) {
    const cacheKey = `city:${city}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`📦 Using cached AQI data for ${city}`);
        return cached.data;
      }
    }

    try {
      const url = `${this.baseUrl}/feed/${city}/?token=${this.apiToken}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.status !== 'ok') {
        throw new Error(`AQICN API error: ${result.data}`);
      }

      const aqiData = result.data;

      // Cache the result
      this.cache.set(cacheKey, {
        data: aqiData,
        timestamp: Date.now()
      });

      return aqiData;
    } catch (error) {
      console.error(`Failed to fetch AQI for ${city}:`, error);
      throw error;
    }
  }

  /**
   * Fetch AQI data by GPS coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<Object>} AQI data
   */
  async fetchAQIByCoordinates(lat, lon) {
    const cacheKey = `geo:${lat},${lon}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        console.log(`📦 Using cached AQI data for ${lat},${lon}`);
        return cached.data;
      }
    }

    try {
      const url = `${this.baseUrl}/feed/geo:${lat};${lon}/?token=${this.apiToken}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.status !== 'ok') {
        throw new Error(`AQICN API error: ${result.data}`);
      }

      const aqiData = result.data;

      // Cache the result
      this.cache.set(cacheKey, {
        data: aqiData,
        timestamp: Date.now()
      });

      return aqiData;
    } catch (error) {
      console.error(`Failed to fetch AQI for ${lat},${lon}:`, error);
      throw error;
    }
  }
}

module.exports = new AQIProxyService();
```

### Scheduler Configuration

**File:** `server/src/api/index.js` (or create `server/src/api/cron.js`)

```javascript
const cron = require('node-cron');
const { runMidnightRoutine } = require('./scripts/midnightRoutine');

// Run every hour (checks all timezones for midnight window)
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running midnight routine check...');
  try {
    await runMidnightRoutine();
  } catch (error) {
    console.error('❌ Midnight routine failed:', error);
  }
});

console.log('✓ Cron scheduler initialized (runs every hour)');
```

**Alternative: Heroku Scheduler Add-on (Recommended)**

Instead of node-cron, use Heroku Scheduler (free):

1. Add Heroku Scheduler: `heroku addons:create scheduler:standard`
2. Configure job via Heroku dashboard:
   - Command: `npm run midnight`
   - Frequency: Every hour
3. The script checks internally if it's midnight for any timezone

---

## Frontend PWA Specification

### Overview

A Progressive Web App that allows users to:
- Register and manage devices
- View real-time sensor data
- Control device settings remotely
- View event history and notifications

### Technology Stack (Recommended)

- **Framework:** React 18+ or Vue 3
- **Firebase SDK:** Firebase JS SDK 10.x
- **Authentication:** Firebase Auth
- **Real-time Data:** Firestore Web SDK with listeners
- **UI Library:** Material-UI or Tailwind CSS
- **Charts:** Chart.js or Recharts for data visualization

### Authentication Flow

```
Step 1: User Signs Up/In
  ┌─────────────┐
  │ Frontend    │  firebase.auth().signInWithEmailAndPassword()
  │ PWA         │  or firebase.auth().createUserWithEmailAndPassword()
  └──────┬──────┘
         │
         │ HTTPS request to Firebase Auth servers
         ▼
  ┌─────────────┐
  │ Firebase    │  Verify credentials
  │ Auth        │  Generate ID token (JWT)
  └──────┬──────┘
         │
         │ Returns: { uid, email, idToken }
         ▼
  ┌─────────────┐
  │ Frontend    │  Store user object in state
  │ PWA         │  Use idToken for backend API calls
  └─────────────┘

Step 2: Register Device
  ┌─────────────┐
  │ Frontend    │  User enters device ID: "TEST-DEVICE-001"
  │ PWA         │  POST /api/devices/register
  └──────┬──────┘  Header: Authorization: Bearer {idToken}
         │
         │ HTTPS request
         ▼
  ┌─────────────┐
  │ Heroku      │  1. Verify idToken with Firebase Admin
  │ Backend     │  2. Extract user UID from token
  └──────┬──────┘  3. Register device in Firestore
         │
         │ Firestore write
         ▼
  ┌─────────────┐
  │ Firestore   │  devices/TEST-DEVICE-001 created
  │ Database    │  linkedUserID = user.uid
  └─────────────┘

Step 3: Setup Real-time Listeners
  ┌─────────────┐
  │ Frontend    │  const deviceRef = db.collection('devices').doc('TEST-DEVICE-001')
  │ PWA         │  deviceRef.onSnapshot(snapshot => {
  └──────┬──────┘    const data = snapshot.data()
         │            updateUI(data)
         │          })
         │
         │ WebSocket connection to Firestore
         ▼
  ┌─────────────┐
  │ Firestore   │  Push updates when data changes
  │ Database    │  (from device or backend)
  └─────────────┘
```

### Key Components

#### 1. Device Dashboard

```jsx
import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

function DeviceDashboard({ deviceId }) {
  const [deviceData, setDeviceData] = useState(null);
  const db = getFirestore();

  useEffect(() => {
    // Setup real-time listener
    const deviceRef = doc(db, 'devices', deviceId);
    const unsubscribe = onSnapshot(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        setDeviceData(snapshot.data());
      }
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, [deviceId]);

  if (!deviceData) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h2>{deviceData.data.name}</h2>
      <div className="status">
        Status: {deviceData.status.online ? '🟢 Online' : '🔴 Offline'}
      </div>

      {/* Sensor Readings */}
      <SensorPanel measurements={deviceData.data.measurements} />

      {/* Settings Control */}
      <SettingsControl
        deviceId={deviceId}
        settings={deviceData.settings}
      />

      {/* Event History */}
      <EventLog deviceId={deviceId} />
    </div>
  );
}
```

#### 2. Settings Control

```jsx
import { getAuth } from 'firebase/auth';

function SettingsControl({ deviceId, settings }) {
  const [fanSpeed, setFanSpeed] = useState(settings.fanSpeed);
  const [autoMode, setAutoMode] = useState(settings.autoMode);
  const [loading, setLoading] = useState(false);

  const updateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/settings`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(newSettings)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // Firestore listener will update UI automatically
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-panel">
      <h3>Device Settings</h3>

      <div className="setting">
        <label>Fan Speed: {fanSpeed}</label>
        <input
          type="range"
          min="0"
          max="5"
          value={fanSpeed}
          onChange={(e) => setFanSpeed(Number(e.target.value))}
          onMouseUp={() => updateSettings({ fanSpeed })}
          disabled={loading}
        />
      </div>

      <div className="setting">
        <label>
          <input
            type="checkbox"
            checked={autoMode}
            onChange={(e) => {
              const newValue = e.target.checked;
              setAutoMode(newValue);
              updateSettings({ autoMode: newValue });
            }}
            disabled={loading}
          />
          Auto Mode
        </label>
      </div>
    </div>
  );
}
```

#### 3. Event Log with Real-time Updates

```jsx
import { useEffect, useState } from 'react';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

function EventLog({ deviceId }) {
  const [events, setEvents] = useState([]);
  const db = getFirestore();

  useEffect(() => {
    // Setup real-time listener for events sub-collection
    const eventsRef = collection(db, 'devices', deviceId, 'events');
    const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventList = [];
      snapshot.forEach(doc => {
        eventList.push({ id: doc.id, ...doc.data() });
      });
      setEvents(eventList);
    });

    return () => unsubscribe();
  }, [deviceId]);

  return (
    <div className="event-log">
      <h3>Recent Events</h3>
      <ul>
        {events.map(event => (
          <li key={event.id}>
            <span className="timestamp">
              {new Date(event.timestamp.toDate()).toLocaleTimeString()}
            </span>
            <span className={`event-type ${event.type}`}>
              {event.type === 'cough' ? '🤧' : event.type === 'sneeze' ? '🤧' : '😴'}
              {event.type}
            </span>
            <span className="confidence">
              {(event.confidence * 100).toFixed(0)}% confidence
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Firestore Security Rules

**File:** `firestore.rules` (in Firebase Console)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isDeviceOwner(deviceId) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/devices/$(deviceId)).data.linkedUserID == request.auth.uid;
    }

    // User documents
    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }

    // Device documents
    match /devices/{deviceId} {
      // Anyone can read unclaimed devices (for registration)
      allow read: if isAuthenticated();

      // Device owners can read/write their devices
      allow read, write: if isDeviceOwner(deviceId);

      // Device simulators need write access to update measurements
      // Option 1: Use service account (recommended)
      // Option 2: Create custom claim for device authentication

      // Events sub-collection
      match /events/{eventId} {
        allow read: if isDeviceOwner(deviceId);
        allow write: if isDeviceOwner(deviceId); // Device writes events
      }
    }

    // Master device list (for registration)
    match /masterDeviceList/{deviceId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only backend can write
    }

    // Timezones (read-only for clients)
    match /timezones/{timezone} {
      allow read: if isAuthenticated();
      allow write: if false; // Only backend can write
    }

    // Location air quality (public read)
    match /locationAirQuality/{city} {
      allow read: if isAuthenticated();
      allow write: if false; // Only backend can write
    }
  }
}
```

---

## Implementation Guide

### Phase 1: Setup Firebase Project

#### Step 1.1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Name: "PuriCare-AirPurifier"
4. Disable Google Analytics (optional)
5. Click "Create Project"

#### Step 1.2: Enable Firestore

1. In Firebase Console, click "Firestore Database"
2. Click "Create Database"
3. Choose "Start in **test mode**" (we'll add security rules later)
4. Select location: `us-central1` (or closest to you)
5. Click "Enable"

#### Step 1.3: Enable Authentication

1. In Firebase Console, click "Authentication"
2. Click "Get Started"
3. Click "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

#### Step 1.4: Generate Service Account Keys

**For Backend (Heroku):**

1. In Firebase Console, click ⚙️ (Settings) → "Project settings"
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download JSON file (e.g., `serviceAccountKey.json`)
5. **Keep this file secure! Don't commit to Git!**

**For Device Simulator (Laptop):**

Option A: Use same service account as backend (easier)
Option B: Create separate service account with limited permissions (more secure)

We'll use Option A for simplicity.

#### Step 1.5: Get Firebase Config for Frontend

1. In Firebase Console, click ⚙️ → "Project settings"
2. Scroll down to "Your apps"
3. Click web icon `</>`
4. Register app: "PuriCare PWA"
5. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "puricare-airpurifier.firebaseapp.com",
  projectId: "puricare-airpurifier",
  storageBucket: "puricare-airpurifier.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

### Phase 2: Setup Python Simulator

#### Step 2.1: Install Python Dependencies

**File:** `hardware/requirements.txt`

```txt
firebase-admin==6.2.0
sounddevice==0.4.6
numpy==1.24.3
scipy==1.11.1
librosa==0.10.0
pynput==1.7.6
python-dotenv==1.0.0
```

Install:
```bash
cd hardware
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Step 2.2: Configure Firebase Credentials

**File:** `hardware/.env`

```env
DEVICE_ID=TEST-DEVICE-001
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

Copy your `serviceAccountKey.json` to `hardware/` directory.

**File:** `hardware/.gitignore`

```
venv/
serviceAccountKey.json
.env
*.pyc
__pycache__/
```

#### Step 2.3: Create Simulator Main File

**File:** `hardware/simulator.py`

```python
import os
import time
import threading
import random
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from pynput import keyboard

# Load environment variables
load_dotenv()

# Firebase initialization
DEVICE_ID = os.getenv('DEVICE_ID', 'TEST-DEVICE-001')
SERVICE_ACCOUNT_PATH = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')

cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

print(f"🔥 Firebase initialized")
print(f"📱 Device ID: {DEVICE_ID}")


class SensorSimulator:
    """Simulates environmental sensors"""

    def __init__(self):
        self.base_temp = 23.0
        self.base_humidity = 45.0
        self.base_pm25 = 12.0
        self.base_pm10 = 25.0
        self.base_co = 0.3
        self.base_tvoc = 150

    def read_sensors(self):
        """Generate realistic sensor readings"""
        return {
            'temp': round(self.base_temp + random.uniform(-0.5, 0.5), 1),
            'RH': round(self.base_humidity + random.uniform(-2, 2), 1),
            'pm25': max(0, round(self.base_pm25 + random.uniform(-3, 3))),
            'pm10': max(0, round(self.base_pm10 + random.uniform(-5, 5))),
            'co': round(max(0, self.base_co + random.uniform(-0.1, 0.1)), 2),
            'no2': None,
            'tvoc': max(0, round(self.base_tvoc + random.uniform(-20, 20)))
        }

    def respond_to_event(self, event_type):
        """Simulate air quality degradation after respiratory event"""
        if event_type in ['cough', 'sneeze']:
            self.base_pm25 += 5
            self.base_pm10 += 8
            self.base_tvoc += 30

    def apply_fan_speed(self, fan_speed):
        """Simulate air purification"""
        cleaning_rate = fan_speed * 0.5
        self.base_pm25 = max(5, self.base_pm25 - cleaning_rate)
        self.base_pm10 = max(10, self.base_pm10 - cleaning_rate * 1.5)
        self.base_tvoc = max(50, self.base_tvoc - cleaning_rate * 10)


class DeviceSimulator:
    """Main device simulator"""

    def __init__(self):
        self.device_id = DEVICE_ID
        self.device_ref = db.collection('devices').document(self.device_id)
        self.running = True
        self.sensor_sim = SensorSimulator()

        # Local state (synced with Firestore)
        self.settings = {
            'fanSpeed': 0,
            'autoMode': False,
            'sensitivity': 1
        }

        self.event_log = []
        self.uptime_start = time.time()

        # Setup Firestore listener
        self.setup_listeners()

    def setup_listeners(self):
        """Setup real-time Firestore listeners"""

        def on_snapshot(doc_snapshot, changes, read_time):
            """Callback when device document changes"""
            for doc in doc_snapshot:
                if doc.exists:
                    data = doc.to_dict()
                    new_settings = data.get('settings', {})

                    # Check if settings changed
                    if new_settings != self.settings:
                        self.log_event(f"⚙️  Settings updated from Firestore")

                        # Fan speed changed
                        if new_settings.get('fanSpeed') != self.settings.get('fanSpeed'):
                            old_speed = self.settings.get('fanSpeed')
                            new_speed = new_settings.get('fanSpeed')
                            self.log_event(f"🌀 Fan speed: {old_speed} → {new_speed}")

                        # Auto mode toggled
                        if new_settings.get('autoMode') != self.settings.get('autoMode'):
                            auto_enabled = new_settings.get('autoMode')
                            status = "ENABLED" if auto_enabled else "DISABLED"
                            self.log_event(f"🤖 Auto mode: {status}")

                        self.settings = new_settings

                        # Acknowledge command
                        self.device_ref.update({
                            'status.lastCommandAck': 'settings_update',
                            'status.commandAckedAt': firestore.SERVER_TIMESTAMP
                        })

        # Start listening
        self.watch = self.device_ref.on_snapshot(on_snapshot)
        self.log_event("✓ Firestore listener started")

    def publish_sensor_data(self):
        """Publish sensor readings to Firestore (every 10 seconds)"""
        while self.running:
            try:
                # Read sensors
                measurements = self.sensor_sim.read_sensors()

                # Apply fan speed effect
                self.sensor_sim.apply_fan_speed(self.settings['fanSpeed'])

                # Update Firestore
                self.device_ref.update({
                    'data.measurements': measurements,
                    'status.lastSeen': firestore.SERVER_TIMESTAMP,
                    'status.online': True
                })

                self.log_event(f"📊 Published sensor data (temp: {measurements['temp']}°C)")

            except Exception as e:
                self.log_event(f"❌ Error publishing data: {e}")

            time.sleep(10)

    def simulate_event(self, event_type):
        """Simulate respiratory event (cough, sneeze, snore)"""
        confidence = random.uniform(0.75, 0.95)

        # Create event document in sub-collection
        event_data = {
            'type': event_type,
            'confidence': confidence,
            'timestamp': firestore.SERVER_TIMESTAMP
        }

        # If auto mode, increase fan speed
        if self.settings['autoMode']:
            old_speed = self.settings['fanSpeed']
            new_speed = min(5, old_speed + 1)

            event_data['autoModeResponse'] = {
                'previousFanSpeed': old_speed,
                'newFanSpeed': new_speed,
                'reason': 'Respiratory event detected'
            }

            # Update fan speed
            self.device_ref.update({
                'settings.fanSpeed': new_speed
            })

            self.settings['fanSpeed'] = new_speed

        # Publish event to Firestore
        self.device_ref.collection('events').add(event_data)

        # Simulate air quality degradation
        self.sensor_sim.respond_to_event(event_type)

        emoji = '🤧' if event_type in ['cough', 'sneeze'] else '😴'
        self.log_event(f"{emoji} {event_type.capitalize()} detected (confidence: {confidence:.2f})")

    def log_event(self, message):
        """Add event to local log"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        log_entry = f"[{timestamp}] {message}"
        self.event_log.append(log_entry)

        # Keep only last 10 events
        if len(self.event_log) > 10:
            self.event_log.pop(0)

        print(log_entry)

    def get_uptime(self):
        """Get uptime string"""
        seconds = int(time.time() - self.uptime_start)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def display_dashboard(self):
        """Render terminal dashboard"""
        os.system('cls' if os.name == 'nt' else 'clear')

        measurements = self.sensor_sim.read_sensors()

        print("╔══════════════════════════════════════════════════════════════╗")
        print("║                 PureCare Device Simulator                    ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print(f"║ Device: {self.device_id:<20} Status: ● ONLINE            ║")
        print(f"║ Uptime: {self.get_uptime():<20} Firestore: ✓ Connected      ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print("║ DEVICE SETTINGS (Two-way sync)                               ║")
        print("║ ┌────────────────────────────────────────────────────────┐   ║")

        fan_bar = "█" * self.settings['fanSpeed'] + "░" * (5 - self.settings['fanSpeed'])
        print(f"║ │ Fan Speed:     {fan_bar} {self.settings['fanSpeed']}/5                    │   ║")

        auto_status = "✓ ENABLED " if self.settings['autoMode'] else "✗ DISABLED"
        print(f"║ │ Auto Mode:     {auto_status:<36}│   ║")

        sens_map = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
        print(f"║ │ Sensitivity:   {sens_map.get(self.settings['sensitivity'], 'UNKNOWN'):<36}│   ║")
        print("║ └────────────────────────────────────────────────────────┘   ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print("║ SENSOR READINGS (Simulated)         Last Updated: 1s ago     ║")
        print("║ ┌────────────────────────────────────────────────────────┐   ║")
        print(f"║ │ Temperature:   {measurements['temp']:<7}°C   [████████████░░░░] NORMAL   │   ║")
        print(f"║ │ Humidity:      {measurements['RH']:<7}%    [██████████░░░░░░] NORMAL   │   ║")
        print(f"║ │ PM2.5:         {measurements['pm25']:<7}µg/m³ [████░░░░░░░░░░░░] GOOD     │   ║")
        print(f"║ │ PM10:          {measurements['pm10']:<7}µg/m³ [████░░░░░░░░░░░░] GOOD     │   ║")
        print(f"║ │ CO:            {measurements['co']:<7}ppm  [██░░░░░░░░░░░░░░] GOOD     │   ║")
        print("║ └────────────────────────────────────────────────────────┘   ║")
        print("╠══════════════════════════════════════════════════════════════╣")
        print("║ EVENT LOG (Last 10 events)                                   ║")

        for log in self.event_log[-10:]:
            print(f"║ {log:<60} ║")

        # Pad with empty lines
        for _ in range(10 - len(self.event_log)):
            print("║" + " " * 62 + "║")

        print("╚══════════════════════════════════════════════════════════════╝")
        print("\nPress 'q' to quit | 'c' for cough | 's' for sneeze | 'n' for snore")

    def run(self):
        """Main run loop"""
        # Start sensor publishing thread
        sensor_thread = threading.Thread(target=self.publish_sensor_data, daemon=True)
        sensor_thread.start()

        # Start keyboard listener
        def on_press(key):
            try:
                if hasattr(key, 'char'):
                    if key.char == 'q':
                        self.running = False
                        return False  # Stop listener
                    elif key.char == 'c':
                        self.simulate_event('cough')
                    elif key.char == 's':
                        self.simulate_event('sneeze')
                    elif key.char == 'n':
                        self.simulate_event('snore')
            except AttributeError:
                pass

        listener = keyboard.Listener(on_press=on_press)
        listener.start()

        # Main loop - update dashboard
        while self.running:
            self.display_dashboard()
            time.sleep(1)

        # Cleanup
        self.log_event("Shutting down...")
        self.device_ref.update({'status.online': False})
        print("\n✓ Simulator stopped")


if __name__ == '__main__':
    simulator = DeviceSimulator()
    simulator.run()
```

#### Step 2.4: Run the Simulator

```bash
cd hardware
source venv/bin/activate  # On Windows: venv\Scripts\activate
python simulator.py
```

You should see the terminal dashboard!

---

### Phase 3: Setup Heroku Backend

#### Step 3.1: Configure Environment Variables

Add to `server/src/api/.env`:

```env
FIREBASE_API_PORT=3020
NODE_ENV=production

# Firebase (paste your service account values)
FIREBASE_PROJECT_ID=puricare-airpurifier
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@puricare-airpurifier.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Or use service account file (not recommended for Heroku)
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json

# API Keys
DEVICE_API_KEY=your-secure-random-key-here
AQICN_TOKEN=your-aqicn-api-token-here
```

**Get AQICN Token:**
1. Go to https://aqicn.org/data-platform/token/
2. Request free API token
3. Add to `.env`

#### Step 3.2: Deploy to Heroku

```bash
cd server
heroku login
heroku create puricare-backend

# Set environment variables
heroku config:set FIREBASE_PROJECT_ID=puricare-airpurifier
heroku config:set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY..."
heroku config:set AQICN_TOKEN=your-token

# Deploy
git push heroku main

# Add Heroku Scheduler
heroku addons:create scheduler:standard

# Configure scheduler (in Heroku dashboard)
# Command: npm run midnight
# Frequency: Every hour
```

#### Step 3.3: Test Backend

```bash
# Health check
curl https://puricare-backend.herokuapp.com/health

# Register device (requires Firebase ID token)
curl -X POST https://puricare-backend.herokuapp.com/api/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -d '{
    "deviceID": "TEST-DEVICE-001",
    "customLocation": "Living Room",
    "timezone": "America/Chicago",
    "geo": [38.6270, -90.1994],
    "name": "My Air Purifier"
  }'
```

---

### Phase 4: Implement Missing Backend Endpoints

#### Step 4.1: Add Settings Endpoint

**File:** `server/src/api/routes/devices.js`

Add after existing routes:

```javascript
// PATCH /api/devices/:deviceId/settings
router.patch('/:deviceId/settings', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { fanSpeed, autoMode, sensitivity } = req.body;

    // Validate device exists and user owns it
    const deviceRef = db.collection('devices').doc(deviceId);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (deviceDoc.data().linkedUserID !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate inputs
    const updates = {};

    if (fanSpeed !== undefined) {
      if (fanSpeed < 0 || fanSpeed > 5) {
        return res.status(400).json({ error: 'fanSpeed must be 0-5' });
      }
      updates['settings.fanSpeed'] = fanSpeed;
    }

    if (autoMode !== undefined) {
      if (typeof autoMode !== 'boolean') {
        return res.status(400).json({ error: 'autoMode must be boolean' });
      }
      updates['settings.autoMode'] = autoMode;
    }

    if (sensitivity !== undefined) {
      if (sensitivity < 0 || sensitivity > 2) {
        return res.status(400).json({ error: 'sensitivity must be 0-2' });
      }
      updates['settings.sensitivity'] = sensitivity;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    // Update Firestore
    await deviceRef.update(updates);

    // Get updated settings
    const updatedDoc = await deviceRef.get();
    const updatedSettings = updatedDoc.data().settings;

    res.json({
      success: true,
      settings: updatedSettings
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Step 4.2: Complete Midnight Routine

Replace TODO section in `server/src/api/scripts/midnightRoutine.js` (line 102-109) with implementation from Backend API Specification section above.

#### Step 4.3: Implement AQI Proxy Service

Replace empty file `server/src/api/services/aqiProxyService.js` with implementation from Backend API Specification section above.

---

### Phase 5: Testing the System

#### Test 1: End-to-End Settings Update

1. **Start simulator:**
   ```bash
   cd hardware
   python simulator.py
   ```

2. **Update settings via API:**
   ```bash
   curl -X PATCH https://puricare-backend.herokuapp.com/api/devices/TEST-DEVICE-001/settings \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"fanSpeed": 4}'
   ```

3. **Watch simulator dashboard** - should update within 1-2 seconds!

#### Test 2: Event Detection

1. Press 'c' in simulator (simulate cough)
2. Check Firestore Console - should see new event in `devices/TEST-DEVICE-001/events`
3. If auto mode enabled, fan speed should increase automatically

#### Test 3: Midnight Routine

1. Manually trigger:
   ```bash
   heroku run npm run midnight --app puricare-backend
   ```

2. Check logs:
   ```bash
   heroku logs --tail --app puricare-backend
   ```

3. Check Firestore `locationAirQuality` collection for new data

---

### Debugging Tips

**Simulator not receiving updates?**
- Check Firestore security rules
- Verify service account permissions
- Check Python console for errors
- Test Firestore connection: `db.collection('devices').document(DEVICE_ID).get()`

**Backend can't connect to Firestore?**
- Verify environment variables: `heroku config --app puricare-backend`
- Check service account credentials
- Test locally first: `npm run dev`

**Midnight routine not fetching AQI?**
- Verify AQICN token: `curl "https://api.waqi.info/feed/beijing/?token=YOUR_TOKEN"`
- Check Heroku Scheduler is configured
- Test manually: `heroku run npm run midnight`

**Frontend not updating?**
- Open browser console (F12)
- Check Firestore listener errors
- Verify authentication token is valid
- Test Firestore rules in Firebase Console

---

## Summary

This architecture uses **Firebase Firestore as a message broker** to enable real-time bidirectional communication between:

1. **Python Simulator (localhost)** - Listens for settings changes, publishes sensor data
2. **Heroku Backend (cloud)** - Provides REST API, runs midnight routine, fetches external AQI
3. **Frontend PWA (browser)** - Controls device, displays real-time data

**Key Technologies:**
- **Firestore Real-time Listeners** - WebSocket-based automatic updates
- **Firebase Admin SDK** - Backend and device authentication
- **Firebase Auth** - User authentication for frontend
- **Heroku Scheduler** - Cron jobs for midnight routine
- **AQICN API** - External air quality data

**Benefits:**
- ✅ Works on Spark (free) plan
- ✅ No port forwarding or public IP needed
- ✅ Sub-second latency for updates
- ✅ Automatic reconnection handling
- ✅ Scales easily to multiple devices

**Total Cost:** $0/month (stays within Spark plan limits)
