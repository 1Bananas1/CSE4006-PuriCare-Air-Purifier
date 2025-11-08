# PuriCare Server Codebase Analysis

## Overview

You currently have **TWO separate backend services** with overlapping functionality. Here's what exists:

```
server/
├── src/api/          ← MongoDB + JWT (Traditional REST API)
└── src/firebase/     ← Firebase + Firestore (New Architecture)
```

---

## Current State Summary

### ✅ What You Have Built

| Component | Status | Technology | Port | Description |
|-----------|--------|------------|------|-------------|
| **Firebase API** | ✅ Complete | Firebase Admin SDK + Firestore | 3001 | Main backend with Google Auth |
| **MongoDB API** | ⚠️ Legacy | MongoDB + Mongoose + JWT | 3000 | Old REST API (pre-Firebase decision) |
| **AQI Service** | 🟡 Partial | Integrated in MongoDB API | - | Air quality fetching service |
| **locationAirQuality Route** | 🔴 Empty | - | - | Only 2 lines, needs implementation |
| **Hardware Simulator** | 🔴 Missing | - | - | Not yet created |

---

## Detailed Analysis

### 1. Firebase API (`server/src/firebase/`)

**Status**: ✅ **PRODUCTION READY** - This is your main backend

**Technology Stack**:
- Firebase Admin SDK (for Firestore database)
- Firebase Authentication (Google OAuth, Email/Password)
- Express.js (REST API framework)
- Node.js

**Port**: 3001

**Features Implemented**:
- ✅ User authentication (Firebase Auth with Google Sign-In)
- ✅ User profile management (`/auth/register`, `/auth/me`, `/auth/verify`)
- ✅ Device registration & management (max 6 per user)
- ✅ Environment data upload (sensor readings from IoT devices)
- ✅ Device status tracking (online/offline, lastSeen)
- ✅ API key authentication for devices (`X-API-Key`)
- ✅ Rate limiting & security (Helmet, CORS)
- ✅ Comprehensive documentation ([FIREBASE_API_GUIDE.md](FIREBASE_API_GUIDE.md))

**Key Files**:
```
server/src/firebase/
├── index.js                     - Main server entry point
├── config/firebase.js           - Firebase initialization
├── middleware/auth.js           - Firebase token verification
├── routes/
│   ├── auth.js                  - User authentication routes
│   ├── devices.js               - Device management routes
│   └── data.js                  - Environment data routes
├── services/
│   ├── userService.js          - User CRUD operations
│   ├── deviceService.js        - Device CRUD operations
│   └── environmentService.js   - Environment data operations
└── package.json                - Dependencies (firebase-admin, express)
```

**Firestore Collections**:
- `users/` - User profiles
- `devices/` - Device registrations
- `environmentData/` - Sensor readings & health events
- `locationAirQuality/` - **External AQI data (NOT YET POPULATED)**

**Authentication**:
1. **Firebase ID Token** (users): `Authorization: Bearer <token>`
2. **API Key** (devices): `X-API-Key: <key>`

**What's Missing**:
- ❌ No external AQI data fetching (Firebase free tier can't make external API calls)
- ❌ `locationAirQuality/` collection is empty
- ❌ No scheduled jobs to update air quality data
- ❌ No hardware simulator to test device behavior

---

### 2. MongoDB API (`server/src/api/`)

**Status**: ⚠️ **LEGACY / TO BE REFACTORED OR REMOVED**

**Technology Stack**:
- MongoDB + Mongoose (traditional NoSQL database)
- JWT Authentication (manual token management)
- Express.js
- Node.js

**Port**: 3000

**Why It Exists**:
You built this **BEFORE** deciding to use Firebase. It has similar functionality but uses:
- MongoDB instead of Firestore
- JWT tokens instead of Firebase Auth
- bcryptjs for password hashing
- mongoose for database modeling

**Features Implemented**:
- ✅ User registration & login (JWT-based)
- ✅ User management
- ✅ Device registration & management
- ✅ Generic data CRUD operations
- ✅ **Air quality fetching service** (this is the key part we need!)
- ✅ External API integration (WAQI)
- ✅ Scheduled updates capability (node-cron installed)

**Key Files**:
```
server/src/api/
├── index.js                        - Main server (632 lines)
├── models/
│   ├── Users.js                    - User schema (MongoDB)
│   ├── Device.js                   - Device schema (MongoDB)
│   ├── Data.js                     - Generic data schema
│   └── AirQuality.js              - Air quality cache schema ⭐
├── services/
│   └── airQuaityService.js        - Air quality fetching logic ⭐⭐⭐
├── routes/
│   └── locationAirQuality.js      - EMPTY (only 2 lines)
└── package.json                   - Dependencies (mongoose, axios, node-cron)
```

**What's Valuable Here**:
- ⭐⭐⭐ **`airQuaityService.js`** - Complete air quality fetching service:
  - Fetches from WAQI API by city or coordinates
  - Saves to MongoDB cache
  - Updates all devices on schedule
  - Handles rate limiting
  - **THIS IS EXACTLY WHAT YOU NEED FOR API 1!**

- ⭐ **`AirQuality.js` model** - Schema for caching air quality data
- ⭐ External API endpoints in `index.js`:
  - `/api/external/airquality/:city`
  - `/api/devices/:id/airquality/fetch`
  - `/api/admin/airquality/update-all`

**What's Redundant**:
- ❌ User authentication (duplicate of Firebase API)
- ❌ Device management (duplicate of Firebase API)
- ❌ Generic data operations (not needed for your use case)
- ❌ MongoDB dependency (you chose Firebase instead)

---

### 3. Air Quality Service (`server/src/api/services/airQuaityService.js`)

**Status**: ✅ **COMPLETE AND REUSABLE**

This is a **well-implemented service** that does exactly what API 1 needs to do:

**Features**:
```javascript
class AirQualityService {
  // Fetch by city name
  async fetchAirQuality(city)

  // Fetch by coordinates
  async fetchAirQualityByCoords(lat, lon)

  // Save to database (currently MongoDB)
  async saveAirQuality(deviceId, userId, location, apiData)

  // Update single device
  async updateDeviceAirQuality(deviceId)

  // Update ALL devices (scheduled job)
  async updateAllDevicesAirQuality()
}
```

**How It Works**:
1. Fetches from WAQI API: `https://api.waqi.info/feed/{city}/?token={token}`
2. Parses response: `{ aqi, pm25, pm10, o3, no2, so2, co, dominentpol, iaqi }`
3. Saves to database cache
4. Adds 1-second delay between requests to avoid rate limiting

**Current Implementation** (MongoDB):
```javascript
const airQuality = new AirQuality({
  deviceId,
  userId,
  location,
  data: {
    aqi: apiData.aqi,
    pm25: apiData.iaqi?.pm25?.v,
    pm10: apiData.iaqi?.pm10?.v,
    // ... etc
  },
  fetchedAt: new Date()
});
await airQuality.save();
```

**What Needs to Change for Firebase**:
Instead of saving to MongoDB `AirQuality` collection, it should save to Firestore `locationAirQuality/` collection.

---

### 4. Location Air Quality Route (`server/src/api/routes/locationAirQuality.js`)

**Status**: 🔴 **EMPTY - NEEDS IMPLEMENTATION**

**Current Content**:
```javascript
const express = require("express");
// That's it. Only 2 lines.
```

This was **intended** to be your API 1 (AQI Proxy), but you never finished it.

---

## What You Need: The Solution

### Option A: Refactor Existing Code (RECOMMENDED)

**Approach**: Take the working `airQuaityService.js` and adapt it for Firebase.

**Steps**:
1. Copy `server/src/api/services/airQuaityService.js` → `server/src/firebase/services/airQualityProxyService.js`
2. Replace MongoDB calls with Firestore calls
3. Create scheduled job to run `updateAllDevicesAirQuality()` every 2 hours
4. Upload data to Firestore `locationAirQuality/` collection
5. Remove MongoDB dependency

**Pros**:
- ✅ Reuse existing, tested code
- ✅ Air quality logic already works
- ✅ Minimal new code needed
- ✅ Stay within Firebase ecosystem

**Cons**:
- ❌ Still can't run scheduled jobs in Firebase (free tier limitation)

**Workaround**:
Run scheduled job as a separate Node.js script that:
- Uses Firebase Admin SDK
- Runs on your local machine or a free server (Render, Railway, etc.)
- Updates Firestore every 2 hours

---

### Option B: Create Standalone API 1 (MORE FLEXIBLE)

**Approach**: Create a separate Express service (`server/src/aqi-proxy/`) that runs independently.

**Steps**:
1. Create new project: `server/src/aqi-proxy/`
2. Copy `airQuaityService.js` as-is
3. Add Firebase Admin SDK to write to Firestore
4. Add in-memory caching (Redis optional)
5. Run on port 3002
6. Add scheduled job (node-cron)

**Pros**:
- ✅ Can make external API calls
- ✅ Can run scheduled jobs
- ✅ Independent from Firebase API
- ✅ Easy to deploy separately
- ✅ Can use Redis for better caching

**Cons**:
- ❌ Need to deploy another service
- ❌ More infrastructure to maintain

---

### Option C: Keep Both APIs (NOT RECOMMENDED)

**Approach**: Keep MongoDB API for air quality, Firebase API for everything else.

**Pros**:
- ✅ Minimal changes needed
- ✅ Air quality service already works

**Cons**:
- ❌ Two databases (MongoDB + Firestore) - complexity
- ❌ Duplicate code (users, devices in both)
- ❌ Higher costs (2 databases)
- ❌ Confusing architecture

---

## Recommended Solution

### 🎯 **Option A + Standalone Script** (Best of Both Worlds)

**Architecture**:
```
┌────────────────────────────────────────────────────────┐
│  Firebase API (server/src/firebase/)                   │
│  Port: 3001                                            │
│  - User authentication                                 │
│  - Device management                                   │
│  - Environment data upload                             │
│  - READ from locationAirQuality/                       │
└────────────────────────────────────────────────────────┘
                        ▲
                        │ Read
                        │
┌────────────────────────────────────────────────────────┐
│  Firestore Database                                    │
│  - users/                                              │
│  - devices/                                            │
│  - environmentData/                                    │
│  - locationAirQuality/ ◄─── WRITTEN BY AQI SCRIPT     │
└────────────────────────────────────────────────────────┘
                        ▲
                        │ Write (every 2 hours)
                        │
┌────────────────────────────────────────────────────────┐
│  AQI Update Script (server/src/scripts/updateAQI.js)  │
│  - Standalone Node.js script                          │
│  - Uses Firebase Admin SDK                            │
│  - Fetches from WAQI API                              │
│  - Writes to locationAirQuality/                      │
│  - Run with: node-cron or system cron                 │
└────────────────────────────────────────────────────────┘
```

**Implementation**:

1. **Create AQI Update Script**:
```javascript
// server/src/scripts/updateAQI.js
const admin = require('firebase-admin');
const axios = require('axios');
const cron = require('node-cron');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(require('../firebase/cse4006-c9446422bcd5.json'))
});

const db = admin.firestore();

async function fetchAndCacheAQI(city) {
  try {
    // Fetch from WAQI API
    const response = await axios.get(
      `https://api.waqi.info/feed/${city}/?token=${process.env.AQICN_TOKEN}`
    );

    const data = response.data.data;

    // Save to Firestore locationAirQuality/
    await db.collection('locationAirQuality').doc(city).set({
      aqi: data.aqi,
      city: data.city,
      dominentpol: data.dominentpol,
      iaqi: data.iaqi,
      time: data.time,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Updated AQI for ${city}: ${data.aqi}`);
  } catch (error) {
    console.error(`❌ Failed to update ${city}:`, error.message);
  }
}

async function updateAllLocations() {
  console.log('🔄 Starting AQI update...');

  // Get unique user locations
  const usersSnapshot = await db.collection('users').get();
  const cities = new Set();

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    if (user.location && user.location.city) {
      cities.add(user.location.city);
    }
  });

  console.log(`📍 Found ${cities.size} unique locations`);

  for (const city of cities) {
    await fetchAndCacheAQI(city);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit delay
  }

  console.log('✅ AQI update complete');
}

// Run every 2 hours
cron.schedule('0 */2 * * *', updateAllLocations);

// Run once on startup
updateAllLocations();

console.log('🚀 AQI Update Script Running');
console.log('⏰ Updates every 2 hours');
```

2. **Run the Script**:
```bash
cd server/src/scripts
node updateAQI.js
```

3. **Deploy Options**:
- **Local**: Run on your development machine
- **Render/Railway**: Free tier with persistent container
- **GitHub Actions**: Scheduled workflow every 2 hours
- **Heroku**: Free dyno (deprecated) or Eco plan ($5/month)
- **Vercel/Netlify**: Scheduled functions (limited free tier)

---

## What to Keep vs Remove

### ✅ Keep (Production Code)

**Firebase API** (`server/src/firebase/`):
- ✅ All files - this is your main backend
- ✅ Continue development here

**MongoDB API** (`server/src/api/`):
- ✅ `services/airQuaityService.js` - **COPY this to Firebase API**
- ✅ `models/AirQuality.js` - **REFERENCE for Firestore schema**

### 🗑️ Remove (Legacy Code)

**MongoDB API** (`server/src/api/`):
- ❌ `index.js` - duplicate of Firebase API functionality
- ❌ `models/Users.js` - superseded by Firebase Auth
- ❌ `models/Device.js` - superseded by Firestore
- ❌ `models/Data.js` - not needed
- ❌ `routes/locationAirQuality.js` - empty file
- ❌ `package.json` - remove mongoose dependency after migration

**Action Plan**:
1. Extract `airQuaityService.js` → Adapt for Firebase
2. Delete `server/src/api/` folder
3. Keep only Firebase API going forward

---

## Hardware Simulator (API 2)

**Status**: 🔴 **MISSING - NEEDS TO BE CREATED**

This doesn't exist yet. You'll need to create it from scratch.

**Recommended Location**: `server/src/hardware-simulator/`

**What It Should Do**:
1. Read device config from Firestore on startup
2. Simulate realistic sensor readings (AQI, PM2.5, temp, humidity)
3. Upload data to Firebase API every 15 seconds
4. Simulate air quality improvement when device is running
5. Respond to control commands (future)

**Implementation**: See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for detailed specs.

---

## Next Steps - Recommendations

### Immediate (This Week)

1. **✅ Create AQI Update Script** (Option A + Standalone Script)
   - Copy `airQuaityService.js` logic
   - Adapt for Firestore writes
   - Add scheduled execution
   - Test with Shanghai, Seoul, Busan

2. **✅ Test Firebase API Endpoints**
   - Verify user registration works
   - Register a test device
   - Confirm locationAirQuality data appears

3. **✅ Remove MongoDB API**
   - After confirming AQI script works
   - Delete `server/src/api/` folder
   - Clean up repository

### Next Week

4. **✅ Create Hardware Simulator**
   - New project: `server/src/hardware-simulator/`
   - Simulate DEVICE-001 sending data
   - Console output for debugging
   - Integration with Firebase API

5. **✅ End-to-End Testing**
   - User registers → Device registered → Simulator uploads → Frontend displays

---

## Summary Table

| Component | Current Status | Action Required | Priority |
|-----------|---------------|-----------------|----------|
| Firebase API | ✅ Complete | Keep & maintain | High |
| MongoDB API | ⚠️ Legacy | Extract AQI service → Delete | High |
| AQI Service | ✅ Exists (MongoDB) | Adapt for Firestore | **CRITICAL** |
| AQI Proxy API | 🔴 Missing | Create standalone script | **CRITICAL** |
| Hardware Simulator | 🔴 Missing | Create from scratch | High |
| locationAirQuality route | 🔴 Empty | Not needed (use script instead) | Low |

---

## Questions to Answer

1. **Do you want to keep MongoDB API for any reason?**
   - If NO → We'll extract AQI service and delete the rest
   - If YES → Tell me which features to keep

2. **Where do you want to run the AQI update script?**
   - Local machine (development)
   - Free cloud service (Render, Railway)
   - Scheduled GitHub Action
   - Something else

3. **Which technology for Hardware Simulator?**
   - Node.js + Express (consistent with Firebase API)
   - Python + Flask (you have Python expertise)

4. **Do you have a WAQI API token?**
   - If NO → Sign up at https://aqicn.org/data-platform/token/
   - If YES → Great, we can start immediately

---

**Ready to proceed?** Let me know your answers and we'll start implementing!
