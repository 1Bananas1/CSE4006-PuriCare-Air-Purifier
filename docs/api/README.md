# PuriCare Air Purifier API

A Node.js/Express REST API for managing IoT air purifier devices with Firebase integration, timezone-aware operations, and user authentication.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Services](#services)
- [Authentication](#authentication)
- [Timezone Management](#timezone-management)
- [Testing](#testing)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)

---

## Overview

This API provides:

- **Device Registration & Management**: Register air purifiers to user accounts
- **User Authentication**: Firebase-based authentication with ID token verification
- **Timezone-Aware Operations**: Automatic midnight routines grouped by timezone
- **Device Status Tracking**: Real-time device status monitoring
- **Settings Management**: Configure device fan speed, sensitivity, and auto mode

### Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5.1.0
- **Database**: Firebase Cloud Firestore
- **Authentication**: Firebase Admin SDK
- **Timezone Handling**: moment-timezone
- **Task Scheduling**: node-cron

---

## Quick Start

### Prerequisites

- Node.js 14+ installed
- Firebase project with service account credentials
- npm or yarn package manager

### Installation

```bash
cd server/src/api
npm install
```

### Configuration

1. Copy environment template:

```bash
cp .env.example .env
```

2. Add your Firebase credentials to `.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
PORT=3020
```

### Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will be available at `http://localhost:3020`

### Health Check

```bash
curl http://localhost:3020/health
```

---

## Architecture

### Directory Structure

```
server/src/api/
├── config/
│   └── firebase.js              # Firebase Admin SDK initialization
├── middleware/
│   └── auth.js                  # Authentication middleware
├── routes/
│   ├── auth.js                  # User authentication routes
│   └── deviceRoutes.js          # Device management routes
├── services/
│   ├── deviceService.js         # Device business logic
│   ├── timezoneService.js       # Timezone grouping logic
│   ├── aqiProxyService.js       # Air Quality Index API proxy (stub)
│   └── harwareSimulator.js      # Hardware simulation (stub)
├── scripts/
│   ├── midnightRoutine.js       # Daily timezone-aware routine
│   └── testTimezoneSystem.js    # Timezone testing utility
├── test/                        # Comprehensive test suite
├── index.js                     # Express app entry point
├── package.json                 # Dependencies and scripts
└── .env.example                 # Environment template
```

### Design Patterns

- **Service Layer Pattern**: Business logic separated from routes
- **Transaction Pattern**: Atomic operations for device claiming
- **Middleware Stack**: Modular authentication and logging
- **Timezone Grouping**: Denormalized device lists for efficient bulk operations

---

## API Endpoints

### Currently Active

#### Health Check

```http
GET /
GET /health
```

Returns API status and health information.

#### Device Registration

```http
POST /api/devices/register
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "deviceId": "TEST-DEVICE-001",
  "customLocation": "Living Room",
  "timezone": "America/Chicago"
}
```

**Response**: `201 Created`

```json
{
  "message": "Device registered successfully",
  "device": {
    "deviceId": "TEST-DEVICE-001",
    "linkedUserID": "user-uid-123",
    "data": { ... }
  }
}
```

**Error Responses**:

- `400`: Missing deviceId
- `403`: Unauthorized (invalid token)
- `404`: Device not found
- `409`: Device already claimed

#### Device Deletion

```http
DELETE /api/devices/devices/:deviceId
Authorization: Bearer <firebase-id-token>
```

**Response**: `200 OK`

```json
{
  "message": "Device unregistered and unclaimed successfully",
  "deviceId": "TEST-DEVICE-001"
}
```

**Error Responses**:

- `403`: Not authorized to delete this device
- `404`: Device not found

### Defined But Not Mounted

The following routes are implemented in [routes/auth.js](routes/auth.js) but not currently mounted in [index.js](index.js). To enable them, add:

```javascript
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

#### User Registration

```http
POST /api/auth/register
```

#### User Profile

```http
GET /api/auth/me
PUT /api/auth/me
DELETE /api/auth/me
```

#### Token Management

```http
GET /api/auth/verify
POST /api/auth/custom-token
```

---

## Database Schema

### Collections Overview

1. **users**: User profiles and metadata
2. **devices**: User-owned device instances
3. **masterDeviceList**: Global device registry
4. **timezones**: Timezone-grouped device lists
5. **cities**: City cached weather data
6. **locationAirQuality**: Detailed weather station AQI

### Device Document (`devices/{deviceId}`)

```javascript
{
  linkedUserID: "user-uid",
  data: {
    version: "1.0.0",
    customLocation: "Bedroom",
    deviceID: "123456789",
    geo: [latitude, longitude],
    measurements: {
      RH: 22,
      co: null,
      no2: null,
      pm10: 0,
      pm25: 0,
      temp: 23,
      tvoc: 0,
    },
    name: "My Air Purifier",
    timezone: "America/Chicago"
  },
  settings: {
    autoMode: false,
    fanSpeed: 0,
    sensitivity: 0
  },
  status: {
    lastSeen: Timestamp,
    online: false
  }
}
```

### Master Device List (`masterDeviceList/{deviceId}`)

```javascript
{
  model: "PuriCare Air Purifier",
  claimedAt: null,          // null = unclaimed, Timestamp = claimed
}
```

### Timezone Document (`timezones/{encodedTimezoneId}`)

```javascript
{
  timezone: "America_Chicago",
  deviceIds: ["device-1", "device-2"],
  cityNames: ["Chicago", "Dallas"],
  deviceCount: 2,
  lastMidnightRun: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### locationAirQuality (locationAirQuality/city)

```javascript
{
  aqi: 57,
  city: {
    geo: [latitude, longitude],
    name: "Shanghai"
  },
  dominentpol: String,
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
  iqx: 1437,
  time: {
    iso: Timestamp,
    s: string,
    tz: string,
    y: string
  }
}
```

---

## Services

### Device Service ([services/deviceService.js](services/deviceService.js))

Handles device registration, deletion, and management.

**Key Methods**:

- `registerDevice(userId, deviceId, customLocation, timezone)`: Register device to user
- `deleteDevice(deviceId, userId)`: Unregister and unclaim device
- `renameDevice(deviceId, newName)`: Update device display name

**Features**:

- Atomic transactions for claiming
- Authorization checks
- Timezone service integration
- Prevents duplicate claims

### Timezone Service ([services/timezoneService.js](services/timezoneService.js))

Groups devices by timezone for efficient midnight routine execution.

**Key Methods**:

- `addDeviceToTimezone(deviceId, timezone, cityName)`: Add device to timezone group
- `removeDeviceFromTimezone(deviceId, timezone)`: Remove device from timezone group
- `updateDeviceTimezone(deviceId, oldTimezone, newTimezone)`: Move device between timezones
- `getDevicesInTimezone(timezone)`: Fetch all devices in a timezone
- `getAllTimezones()`: List all timezone groups
- `updateLastMidnightRun(timezone)`: Update execution timestamp
- `getTimezoneStats()`: Get device distribution analytics

**Built-in City Mapping**:
Supports 30+ major cities including:

- New York, Los Angeles, Chicago (USA)
- London, Paris, Berlin (Europe)
- Tokyo, Seoul, Beijing (Asia)
- Sydney, Melbourne (Australia)
- Dubai, Mumbai, Singapore (Middle East/Asia)

---

## Authentication

### Firebase ID Token Authentication

All protected endpoints require a valid Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

### Middleware Implementation

The [middleware/auth.js](middleware/auth.js) middleware:

1. Extracts token from `Authorization: Bearer <token>` header
2. Verifies token with Firebase Admin SDK
3. Decodes user information (UID, email)
4. Attaches `req.user` object to the request

### User Object

```javascript
req.user = {
  uid: 'user-uid-123',
  email: 'user@example.com',
  emailVerified: true,
};
```

### Error Responses

- `401`: No token provided
- `403`: Invalid or expired token

---

## Timezone Management

### Midnight Routine ([scripts/midnightRoutine.js](scripts/midnightRoutine.js))

Executes daily tasks at midnight in each timezone.

**How It Works**:

1. Fetches all timezone groups from Firestore
2. Calculates local time for each timezone
3. Checks if current time is in midnight window (23:45-00:14)
4. Verifies routine hasn't run today
5. Processes all devices in the timezone
6. Updates `lastMidnightRun` timestamp

**Midnight Window**: 30 minutes (23:45 PM - 00:14 AM)

**Running Manually**:

```bash
npm run midnight
```

**Scheduling with Cron**:

```javascript
const cron = require('node-cron');
const { executeMidnightRoutine } = require('./scripts/midnightRoutine');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await executeMidnightRoutine();
});
```

### Testing Timezone System

```bash
npm run test-timezones
```

This script:

- Displays all timezone groups
- Shows device counts per timezone
- Calculates current local time for each timezone
- Identifies which timezones are in midnight window

---

## Testing

### Test Suite Structure

```
test/
├── device/
│   ├── setupTestData.js            # Create test devices
│   ├── testDeviceRegistration.js   # Registration tests
│   ├── testDeviceRename.js         # Rename tests
│   └── testUnregister.js           # Deletion tests
├── user/
│   ├── createTestUser.js           # Create Firebase Auth users
│   └── generateTestToken.js        # Generate custom tokens
├── testWithRestAPI.js              # End-to-end REST API tests
├── testWithMockAuth.js             # Mock authentication tests
├── README.md                       # Comprehensive testing guide
└── QUICK_START.md                  # Quick start guide
```

### Setup Test Data

```bash
npm run test:setup
```

Creates test devices in `masterDeviceList` collection:

- TEST-DEVICE-001
- TEST-DEVICE-002
- TEST-DEVICE-003

### Run Device Registration Test

```bash
npm run test:register <email> <password>
```

Example:

```bash
npm run test:register test@example.com password123
```

### Manual Testing with cURL

#### Register Device

```bash
curl -X POST http://localhost:3020/api/devices/register \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-DEVICE-001",
    "customLocation": "Living Room",
    "timezone": "America/Chicago"
  }'
```

#### Delete Device

```bash
curl -X DELETE http://localhost:3020/api/devices/devices/TEST-DEVICE-001 \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## Environment Configuration

### Required Variables

```env
# Firebase Service Account (Option 1: File path)
FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json

# Firebase Service Account (Option 2: Individual credentials)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Database
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

### Optional Variables

```env
# Server Configuration
PORT=3020
NODE_ENV=development

# API Keys
DEVICE_API_KEY=your-device-api-key
AQICN_TOKEN=your-air-quality-api-token
FIREBASE_WEB_API_KEY=your-web-api-key
```

### Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file and reference it in `FIREBASE_SERVICE_ACCOUNT_PATH`

---

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production Firebase credentials
- [ ] Enable CORS for your frontend domain
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Schedule midnight routine with cron
- [ ] Mount authentication routes if needed
- [ ] Configure firewall rules
- [ ] Set up error tracking (e.g., Sentry)

### Available NPM Scripts

```json
{
  "start": "node index.js", // Production server
  "dev": "nodemon index.js", // Development with auto-reload
  "test:setup": "node test/device/setupTestData.js", // Setup test devices
  "test:register": "node test/testWithRestAPI.js", // Test registration
  "midnight": "node scripts/midnightRoutine.js", // Run midnight routine
  "test-timezones": "node scripts/testTimezoneSystem.js" // Test timezone system
}
```

### Docker Deployment (Optional)

Example `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3020

CMD ["npm", "start"]
```

---

## Known Issues & Future Enhancements

### Current Limitations

1. **Auth Routes Not Mounted**: User authentication routes defined but not active
2. **Incomplete Services**: AQI proxy and hardware simulator are stubs
3. **Midnight Routine Logic**: Framework exists but business logic is TODO
4. **Device Rename**: Endpoint incomplete (DELETE route issues)
5. **No Rate Limiting**: Production deployment should add rate limiting

### Planned Enhancements

- [ ] Implement user profile management service
- [ ] Add air quality index proxy integration
- [ ] Complete hardware simulator for testing
- [ ] Implement midnight routine business logic
- [ ] Add real-time database listeners for device status
- [ ] Implement device measurement data persistence
- [ ] Add comprehensive input validation
- [ ] Set up API documentation (Swagger/OpenAPI)
- [ ] Add WebSocket support for real-time updates
- [ ] Implement device command queue

---

## Troubleshooting

### Firebase Connection Issues

**Error**: `Failed to load Firebase configuration`

**Solution**: Verify your `.env` file contains valid Firebase credentials and the service account file exists.

### Device Already Claimed

**Error**: `409 Conflict - Device is already claimed by another user`

**Solution**: The device is already registered. Unregister it first using the DELETE endpoint.

### Authentication Failures

**Error**: `403 Forbidden - Invalid or expired token`

**Solutions**:

1. Verify the token is a valid Firebase ID token
2. Check token hasn't expired (1 hour default lifetime)
3. Ensure Firebase project matches the token issuer

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3020`

**Solution**: Change the port in `.env` or kill the process using port 3020:

```bash
# Windows
netstat -ano | findstr :3020
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3020 | xargs kill -9
```

---

## Support & Contributing

### Documentation

- [Test Suite Guide](test/README.md)
- [Quick Start Guide](test/QUICK_START.md)

### Key Files Reference

- Entry Point: [index.js](index.js:1)
- Firebase Config: [config/firebase.js](config/firebase.js:1)
- Auth Middleware: [middleware/auth.js](middleware/auth.js:1)
- Device Routes: [routes/deviceRoutes.js](routes/deviceRoutes.js:1)
- Device Service: [services/deviceService.js](services/deviceService.js:1)
- Timezone Service: [services/timezoneService.js](services/timezoneService.js:1)

---

## License

[Add your license information here]

---

## Contact

[Add contact information here]
