# Requirements for Python Simulator

# Abstract

The goal for the python simulator is to act as a stand in for an actual air purifier. My initial thoughts were to use an API and firebase DB for all of this but as I continue looking into features, the limits of firebase DB even with bucket collections is becoming unmanageable. 

## Thoughts on Connectivity

One major thing I am struggling with is for state management. I could control and save states in the database which I already somewhat have. As of right now the front end gets its statistics from the database such as fanSpeed, autoMode, sensitivity, and whether the device is online. This is nice and all but I fear is a bit intensive for my free tier of a database with limited read and writes. The alternative for this is that I use MQTT, which I have never used in my life. I'm also realizing that getting real time data and summaries will reach over 144,000 reads per day for a single device which is just not reasonable. The current API is useful for getting simple data like whether the simulator is on or off or the current AQI but getting lots of data for historical measurements is just not feasible.

## Controls

The simulator should be able to do these functions:

- Change fan speed (scale from 0-10)
- Enable and disable auto mode
- Change the sensitivity (low-high)

When any of these events are changed on the simulator, the front end app should update it's settings accordingly (if the fan speed is changed on the simulator, the front end should reflect the new and updated fan speed). When any of these controls are changed on the front end, the simulator should update it's settings accordingly (if the fan speed is changed on the app, the simulator should update it's state accordingly).

## Measurements

The simulator shall make mock measurements that can be changed on the simulator.

The following measurements shall be recorded on the simulator every 5 minutes:

- RH: Relative Humidity
- CO: Carbon Monoxide
- CO2: Carbon Dioxide
- NO2: Nitrogen Dioxide
- PM10: Particulate Matter (10 micrometers)
- PM25: Particulate Matter (2.5 micrometers)
- TEMP: Temperature (Measured in celsius)
- TVOC: Total Volatile Organic Compounds

## Connectivity

The front end will need data the measurements from the emulator preferably with real time updates (every 5 minutes for simulator sake of not blowing up my laptop).

---

## Architecture Decision: Heroku Backend with WebSockets + TimescaleDB

### Problem Statement

Initial concerns with Firebase:
- 144,000+ reads per day for a single device (far exceeds 50k free tier limit)
- Real-time data requirements (8 sensors × 12 readings/hour)
- Bidirectional communication needed (sensor data + device controls)
- Historical data queries for charts/analytics
- State management overhead (fanSpeed, autoMode, sensitivity, online status)

### Available Resources

- $312 in Heroku credits
- Existing Heroku backend infrastructure
- React/PWA frontend
- Python simulator

### Evaluated Options

#### Option 1: Firebase Firestore (Current - Not Sustainable)
- **Problem:** 50k reads/day limit easily exceeded with real-time listeners
- **Verdict:** Not viable for production

#### Option 2: Firebase Realtime Database
- **Pros:** Better for real-time than Firestore, listeners don't count as reads
- **Cons:** Still limited bandwidth on free tier
- **Verdict:** Could work with aggressive aggregation, but not optimal

#### Option 3: MQTT + InfluxDB
- **Pros:** Industry-standard IoT pattern, excellent time-series support
- **Cons:** Requires backend API wrapper for frontend security, more complex setup
- **Verdict:** Great for learning, but adds complexity

#### Option 4: Supabase (PostgreSQL + TimescaleDB)
- **Pros:** Direct frontend SDK, built-in real-time, time-series optimized
- **Cons:** Another service to manage
- **Verdict:** Good alternative to Firebase

#### Option 5: Heroku-Centric Architecture (SELECTED)
- **Pros:** Leverage existing $312 credit (~21 months runtime), unified backend, production-ready
- **Cons:** None (we have the budget)
- **Verdict:** Best choice given available resources

### Selected Architecture

**Hybrid: Firebase Auth + Heroku Backend with WebSockets + TimescaleDB + Redis**

**Note:** Firebase will continue to handle:
- User authentication (login/signup)
- Device authorization (which users own which devices)
- Device registration/pairing
- User profiles and settings
- Static device metadata

**Heroku/TimescaleDB will handle:**
- Real-time sensor data streaming (via WebSockets)
- Historical sensor measurements storage
- Time-series queries and aggregations
- Device control commands routing

```text
┌──────────────────────────────────────────────────────────────────┐
│                    FIREBASE                                      │
│  - User Authentication (login/signup)                            │
│  - Device Ownership (userId ↔ deviceId mapping)                 │
│  - User Profiles & Settings                                      │
│  - Device Metadata (name, location, model)                       │
└──────────────────────────────────────────────────────────────────┘
           ↕ Auth Token Validation              ↕ Auth & Device Mgmt
           ↓                                     ↓
┌─────────────────────────────────────────────────────┐
│           HEROKU BACKEND                            │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Django/Flask App                            │  │
│  │  - REST API endpoints                        │  │
│  │  - WebSocket server (Socket.io/Channels)     │  │
│  │  - Firebase token verification               │  │
│  │  - Device ownership check (via Firebase)     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Heroku Postgres + TimescaleDB               │  │
│  │  - Time-series sensor data ONLY              │  │
│  │  - Auto-aggregation (5min → hourly → daily)  │  │
│  │  - 7-day retention for raw data              │  │
│  │  - NO user/auth data (that's in Firebase)    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Heroku Redis                                │  │
│  │  - WebSocket pub/sub                         │  │
│  │  - Real-time message queue                   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
           ↕                              ↕
    WebSocket/HTTPS              WebSocket/HTTPS (with Firebase token)
           ↕                              ↕
┌──────────────────┐            ┌──────────────────┐
│  Python          │            │  React PWA       │
│  Simulator       │            │  Frontend        │
│                  │            │                  │
│ - Mock sensors   │            │ - Firebase Auth  │
│ - Send every     │            │ - View sensors   │
│   5 minutes      │            │ - Send controls  │
│ - Receive cmds   │            │ - View history   │
└──────────────────┘            └──────────────────┘
```

### Component Breakdown

#### 1. Sensor Data Flow (Simulator → Frontend)

**Simulator:**
- Connects to Heroku WebSocket endpoint via Socket.io client
- Generates mock sensor readings every 5 minutes (8 sensors)
- Emits `sensor_update` event with readings
- Maintains bidirectional connection for receiving commands

**Backend:**
- Receives sensor data via WebSocket
- Validates Firebase auth token from client
- Checks device ownership via Firebase (verifies user owns this device)
- Broadcasts to all connected frontends watching that device (real-time)
- Stores aggregated data in TimescaleDB (not every reading)
- Uses Redis pub/sub for efficient multi-client broadcasting

**Frontend:**
- Authenticates with Firebase (gets auth token)
- Connects to Heroku WebSocket endpoint via Socket.io client (sends Firebase token)
- Joins device-specific room (after auth verification)
- Receives real-time sensor updates (no polling needed)
- Queries REST API for historical data/charts
- Uses Firebase for device management UI (add/remove devices)

#### 2. Control Flow (Frontend → Simulator)

**Frontend:**
- User adjusts controls (fan speed, auto mode, sensitivity)
- Emits `device_command` event via WebSocket
- Receives acknowledgment from simulator

**Backend:**
- Validates Firebase auth token
- Checks device ownership via Firebase API (does user own this device?)
- Forwards command to device-specific room via Redis
- Optionally updates device state in Firebase (for persistence)
- Broadcasts state change to all connected clients

**Simulator:**
- Receives command via WebSocket
- Updates internal state (fan_speed, auto_mode, etc.)
- Sends acknowledgment back to backend
- Reflects new state in next sensor update (5-minute intervals)
- Generates **realistic mock sensor data** based on device state and environmental simulation

#### 3. Database Schema (TimescaleDB)

**Hypertable: `sensor_readings`**
- `time` (TIMESTAMPTZ, indexed)
- `device_id` (VARCHAR)
- `sensor_type` (VARCHAR: RH, CO, CO2, NO2, PM10, PM25, TEMP, TVOC)
- `value` (DOUBLE PRECISION)
- `unit` (VARCHAR)

**Continuous Aggregate: `sensor_readings_hourly`**
- Auto-aggregates 5-minute readings into hourly averages
- Stores: avg, max, min for each sensor type
- Reduces storage by ~95%

**Retention Policy:**
- Raw data: 7 days (then auto-deleted)
- Hourly aggregates: 30 days
- Daily aggregates: 1 year

### Technology Stack

**Backend:**
- Django or Flask (Python web framework)
- Django Channels or Flask-SocketIO (WebSocket support)
- psycopg2 (PostgreSQL driver)
- channels-redis (Redis integration)
- firebase-admin (Python SDK for Firebase token verification)

**Database:**
- Heroku Postgres Mini ($5/month) with TimescaleDB extension
- TimescaleDB optimizations: hypertables, continuous aggregates, retention policies

**Caching/Pub-Sub:**
- Heroku Redis Mini ($3/month)
- Used for WebSocket channel layer and session storage

**Hosting:**
- Heroku Hobby Dyno ($7/month)
- Always-on (no sleeping)
- 512MB RAM

**Frontend:**
- React PWA (existing)
- Firebase SDK (for authentication and device management)
- Socket.io-client (WebSocket library, sends Firebase token on connect)
- Chart library for historical data visualization (Chart.js, Recharts, etc.)

**Simulator:**
- Python 3.11+
- python-socketio (WebSocket client)
- asyncio for async/await patterns

### Cost Analysis

| Service | Monthly Cost | Coverage with $312 |
|---------|--------------|-------------------|
| Heroku Hobby Dyno | $7 | 44 months |
| Heroku Postgres Mini | $5 | 62 months |
| Heroku Redis Mini | $3 | 104 months |
| **Total** | **$15/month** | **~21 months** |

### Data Volume Estimates

**Per Device:**
- Sensors: 8 types
- Frequency: Every 5 minutes (288 readings/day per sensor)
- Total readings/day: 2,304
- Total readings/week: 16,128

**Storage (with TimescaleDB compression):**
- Raw data (7 days): ~110k rows = ~5MB
- Hourly aggregates (30 days): ~5.7k rows = ~500KB
- Daily aggregates (1 year): ~2.9k rows = ~200KB
- **Total per device:** ~6MB

**For 10 devices:** ~60MB (well within 10GB Postgres Mini limit)

### Key Advantages

1. **Real-time Bidirectional Communication:** WebSockets eliminate polling overhead
2. **Cost-Effective:** 21 months of runtime with existing Heroku credit
3. **Production-Ready:** Industry-standard architecture, scalable
4. **Time-Series Optimized:** TimescaleDB provides efficient queries and auto-aggregation
5. **Unified Backend:** Single codebase handles API, WebSockets, and database
6. **Secure:** Backend validates all commands, enforces device ownership
7. **Always Responsive:** Hobby dyno never sleeps (critical for device controls)

### Implementation Priority

1. **Phase 1:** Set up Heroku Postgres with TimescaleDB extension
2. **Phase 2:** Add WebSocket support to existing Heroku backend (Django Channels/Flask-SocketIO)
3. **Phase 3:** Configure Heroku Redis for pub/sub
4. **Phase 4:** Build Python simulator with Socket.io client
5. **Phase 5:** Integrate Socket.io into React frontend
6. **Phase 6:** Create REST API endpoints for historical queries
7. **Phase 7:** Implement TimescaleDB continuous aggregates and retention policies

### Simulator Mock Data Specifications

The Python simulator generates **realistic but fake** sensor data to simulate an actual air purifier environment.

#### Sensor Ranges and Behavior

| Sensor | Unit | Typical Range | Behavior Pattern |
|--------|------|---------------|------------------|
| **RH** (Humidity) | % | 30-70% | Slow changes, slight daily cycle |
| **CO** (Carbon Monoxide) | ppm | 0-9 ppm | Usually 0-2, spikes occasionally (cooking) |
| **CO2** (Carbon Dioxide) | ppm | 400-2000 ppm | Increases with occupancy, decreases with ventilation |
| **NO2** (Nitrogen Dioxide) | ppb | 0-100 ppb | Low indoors, spikes near gas appliances |
| **PM10** | µg/m³ | 0-150 | Affected by outdoor air, fan speed |
| **PM25** | µg/m³ | 0-100 | More sensitive than PM10, decreases with purifier use |
| **TEMP** | °C | 18-28°C | Slow daily cycle, room temperature |
| **TVOC** (Volatile Compounds) | ppb | 0-1000 ppb | Spikes from cleaning products, cooking |

#### Simulation Logic

**Base Behavior (When Idle):**
- Sensors drift slowly with random noise
- CO2 slowly increases (simulated occupancy)
- PM2.5/PM10 slowly increase (dust accumulation)
- Temperature follows a gentle sinusoidal daily cycle

**When Air Purifier is ON:**
- PM2.5 and PM10 **decrease** exponentially based on fan speed
- Higher fan speed = faster decrease
- TVOC gradually decreases
- CO2 slightly decreases (simulated air circulation)

**Random Events (Realistic Scenarios):**
- **Cooking event** (random chance): CO, NO2, PM2.5, TVOC spike
- **Window opening** (random): Outdoor AQI influences indoor levels
- **Occupancy changes**: CO2 increases when "people home"
- **Cleaning products**: TVOC spike

**Update Frequency:**
- Generate new readings every **5 minutes**
- Apply smooth transitions (no sudden jumps unless event occurs)
- Add gaussian noise to simulate real sensor variance (±2-5%)

#### Example Realistic Scenarios

**Scenario 1: Morning (7 AM - 9 AM)**
- Temperature: 20°C → 22°C (gradual warming)
- CO2: 450 ppm → 800 ppm (family wakes up)
- PM2.5: 15 µg/m³ → 25 µg/m³ (cooking breakfast)
- Air purifier auto-activates → PM2.5 drops to 8 µg/m³

**Scenario 2: Afternoon (Empty House)**
- CO2: Slowly decreases to ~450 ppm (baseline)
- PM2.5: Stays stable around 10-15 µg/m³
- Air purifier in low power mode or off

**Scenario 3: Cooking Dinner**
- CO: 0.5 ppm → 3 ppm (gas stove)
- PM2.5: 12 µg/m³ → 65 µg/m³ (frying/cooking)
- TVOC: 100 ppb → 450 ppb
- Air purifier detects spike → fan speed increases → levels drop

### Next Steps

- Review and approve architecture
- Set up Firebase authentication integration with Heroku backend
- Set up development environment
- Begin Phase 1 implementation
- Implement realistic sensor simulation logic
- Test with single simulator instance
- Scale to multiple devices
- Add monitoring and logging

#
