# PuriCare Firebase API - Developer Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Google Sign-In Integration](#google-sign-in-integration)
4. [Authentication Flow](#authentication-flow)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Frontend Integration Guide](#frontend-integration-guide)
8. [Raspberry Pi Integration](#raspberry-pi-integration)
9. [Error Handling](#error-handling)

---

## Overview

The PuriCare Firebase API is a RESTful backend service that manages:
- User authentication (Google Sign-In, Email/Password)
- Device registration and management (max 6 devices per user)
- Environment data storage from Raspberry Pi sensors
- Health event tracking (cough, sneeze, sniff, snore detection)
- User health preferences and respiratory sensitivities

**Base URL**: `http://localhost:3001` (development)

**Tech Stack**:
- Firebase Admin SDK
- Firestore Database
- Express.js
- Node.js

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                      │
│  (React PWA / React Native / Mobile Apps)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Firebase ID Token
                 │
┌────────────────▼────────────────────────────────────────────┐
│              Firebase Authentication                        │
│  (Handles: Google OAuth, Email/Password, Token Validation) │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ UID, Email, Display Name
                 │
┌────────────────▼────────────────────────────────────────────┐
│              PuriCare Firebase API                          │
│                 (server/src/firebase/)                      │
│                                                             │
│  Routes:                                                    │
│  ├── /auth/*          - User authentication & profile      │
│  ├── /api/devices/*   - Device management                  │
│  └── /api/data/*      - Environment data upload            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  Firestore Database                         │
│                                                             │
│  Collections:                                               │
│  ├── users/              - User profiles & preferences     │
│  ├── devices/            - Registered devices              │
│  └── environmentData/    - Sensor readings & health events │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Raspberry Pi (Edge Device)                     │
│  - Runs ML model for cough/sneeze detection                │
│  - Uploads health events via API (X-API-Key)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Google Sign-In Integration

### Why Google Sign-In?

Google Sign-In provides:
- ✅ Trusted authentication without password management
- ✅ User profile data (email, name, photo)
- ✅ Multi-user household support
- ✅ Better UX (one-tap sign-in)

### Two-Database Architecture

**Firebase Authentication** (Managed by Firebase):
- Handles OAuth flow with Google
- Stores authentication tokens
- Validates ID tokens
- Visible in: Firebase Console > Authentication > Users

**Firestore Database** (Managed by your API):
- Stores user profile and health preferences
- Stores devices and environment data
- You control the schema and data
- Visible in: Firebase Console > Firestore Database

### Important Note

When a user signs in with Google:
1. ✅ Firebase Auth **automatically** creates a user record
2. ❌ Firestore Database **does NOT** automatically create a user document
3. ✅ You **must** call `/auth/register` to create the Firestore user profile

---

## Authentication Flow

### New User Registration (Google Sign-In)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Click "Sign in with Google"
       │
       ▼
┌──────────────────────────────────────┐
│  Firebase Auth SDK (Frontend)        │
│  - Opens Google OAuth popup          │
│  - User authenticates with Google    │
│  - Returns: UID, email, name, photo  │
└──────┬───────────────────────────────┘
       │
       │ 2. Get Firebase ID Token
       │    const idToken = await user.getIdToken()
       │
       ▼
┌──────────────────────────────────────┐
│  Frontend: Check if user exists      │
│  GET /auth/me                         │
│  Authorization: Bearer <idToken>     │
└──────┬───────────────────────────────┘
       │
       ├─── 200 OK (user exists in Firestore)
       │    └──> Navigate to Home Page
       │
       └─── 404 Not Found (new user)
            │
            ▼
       ┌──────────────────────────────────┐
       │  Show "Complete Profile" Screens │
       │  - Page 1: Location, Country     │
       │  - Page 2: Phone, DOB (optional) │
       │  - Page 3: Health Preferences    │
       └──────┬───────────────────────────┘
              │
              │ 3. User fills out profile
              │
              ▼
       ┌──────────────────────────────────┐
       │  POST /auth/register              │
       │  Authorization: Bearer <idToken> │
       │  {                                │
       │    uid, email, username,          │
       │    photoURL, location,            │
       │    respiratorySensitivities,      │
       │    quietHours, preferredTemp, ... │
       │  }                                │
       └──────┬───────────────────────────┘
              │
              │ 4. API creates Firestore document
              │
              ▼
       ┌──────────────────────────────────┐
       │  201 Created                      │
       │  User now exists in BOTH:        │
       │  - Firebase Auth                  │
       │  - Firestore Database             │
       └──────┬───────────────────────────┘
              │
              ▼
       Navigate to Home Page
```

### Returning User Login (Google Sign-In)

```
User clicks "Sign in with Google"
  ↓
Firebase Auth SDK handles OAuth
  ↓
Get Firebase ID Token
  ↓
GET /auth/me
  ↓
200 OK (user profile loaded)
  ↓
Navigate to Home Page
```

### Email/Password Registration (Alternative)

```
User fills out signup form
  ↓
Frontend: Firebase Auth SDK
  createUserWithEmailAndPassword(email, password)
  ↓
Returns: UID, email
  ↓
POST /auth/register
  { uid, email, username, ... }
  ↓
201 Created
  ↓
Navigate to Home Page
```

---

## API Endpoints

### Authentication Endpoints

#### 1. Register User Profile

**Endpoint**: `POST /auth/register`

**Description**: Creates user profile in Firestore after Firebase Auth registration

**Authentication**: Optional (but recommended to include Firebase ID token)

**Request Body**:
```json
{
  "uid": "firebase-user-uid",
  "email": "user@example.com",
  "username": "John Doe",
  "photoURL": "https://lh3.googleusercontent.com/...",
  "location": {
    "city": "Seoul",
    "country": "South Korea",
    "latitude": 37.5665,
    "longitude": 126.9780
  },
  "phone": "+82-10-1234-5678",
  "dob": "1990-01-15",
  "country": "South Korea",
  "respiratorySensitivities": ["pollen", "dust", "pet dander"],
  "quietHours": {
    "start": "22:00",
    "end": "07:00"
  },
  "preferredTemp": {
    "min": 20,
    "max": 24,
    "unit": "celsius"
  },
  "preferredHumidity": {
    "min": 40,
    "max": 60
  }
}
```

**Required Fields**:
- `uid` (string) - Firebase user ID
- `email` (string) - User email address

**Optional Fields**:
- `username` (string) - Display name (defaults to email prefix)
- `photoURL` (string) - Profile photo URL
- `location` (object) - User's home location
- `phone` (string) - Phone number
- `dob` (string) - Date of birth (ISO format)
- `country` (string) - Country name
- `respiratorySensitivities` (array) - Health sensitivities
- `quietHours` (object) - Do not disturb hours
- `preferredTemp` (object) - Preferred temperature range
- `preferredHumidity` (object) - Preferred humidity range

**Response** (201 Created):
```json
{
  "message": "User registered successfully",
  "user": {
    "uid": "abc123",
    "email": "user@example.com",
    "username": "John Doe",
    "photoURL": "https://...",
    "location": {...},
    "deviceCount": 0,
    "createdAt": "2025-01-07T10:30:00.000Z",
    "updatedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing required fields (uid, email)
- `409 Conflict` - User already exists
- `500 Internal Server Error` - Database error

---

#### 2. Get User Profile

**Endpoint**: `GET /auth/me`

**Description**: Retrieves current user's profile from Firestore

**Authentication**: Required (Firebase ID Token)

**Headers**:
```
Authorization: Bearer <firebase-id-token>
```

**Response** (200 OK):
```json
{
  "id": "abc123",
  "uid": "abc123",
  "email": "user@example.com",
  "username": "John Doe",
  "photoURL": "https://...",
  "location": {
    "city": "Seoul",
    "country": "South Korea",
    "latitude": 37.5665,
    "longitude": 126.9780
  },
  "phone": "+82-10-1234-5678",
  "respiratorySensitivities": ["pollen", "dust"],
  "quietHours": {
    "start": "22:00",
    "end": "07:00"
  },
  "preferredTemp": {
    "min": 20,
    "max": 24,
    "unit": "celsius"
  },
  "preferredHumidity": {
    "min": 40,
    "max": 60
  },
  "deviceCount": 2,
  "createdAt": "2025-01-07T10:30:00.000Z",
  "updatedAt": "2025-01-07T10:30:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - No token provided
- `403 Forbidden` - Invalid or expired token
- `404 Not Found` - User profile not found in Firestore
- `500 Internal Server Error` - Database error

---

#### 3. Update User Profile

**Endpoint**: `PUT /auth/me`

**Description**: Updates user profile information

**Authentication**: Required (Firebase ID Token)

**Headers**:
```
Authorization: Bearer <firebase-id-token>
```

**Request Body** (all fields optional):
```json
{
  "username": "New Name",
  "location": {
    "city": "Busan",
    "country": "South Korea"
  },
  "respiratorySensitivities": ["pollen"],
  "quietHours": {
    "start": "23:00",
    "end": "08:00"
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Profile updated successfully",
  "user": {
    "uid": "abc123",
    "email": "user@example.com",
    "username": "New Name",
    "updatedAt": "2025-01-07T11:00:00.000Z",
    ...
  }
}
```

---

#### 4. Verify Token

**Endpoint**: `GET /auth/verify`

**Description**: Verifies Firebase ID token validity

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "valid": true,
  "user": {
    "uid": "abc123",
    "email": "user@example.com",
    "emailVerified": true,
    "username": "John Doe",
    ...
  }
}
```

---

### Device Management Endpoints

#### 5. Register Device

**Endpoint**: `POST /api/devices`

**Description**: Registers a new IoT device to user's account (max 6 devices)

**Authentication**: Required (Firebase ID Token)

**Request Body**:
```json
{
  "deviceId": "DEVICE-001",
  "name": "Living Room Purifier",
  "location": {
    "name": "Living Room",
    "city": "Seoul",
    "latitude": 37.5665,
    "longitude": 126.9780
  }
}
```

**Response** (201 Created):
```json
{
  "message": "Device registered successfully",
  "device": {
    "id": "firestore-doc-id",
    "userId": "abc123",
    "deviceId": "DEVICE-001",
    "name": "Living Room Purifier",
    "location": {...},
    "settings": {
      "autoMode": true,
      "fanSpeed": 1,
      "sensitivity": 2
    },
    "status": {
      "online": false,
      "lastSeen": null
    },
    "createdAt": "2025-01-07T12:00:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing deviceId or name
- `409 Conflict` - Device ID already registered
- `500 Internal Server Error` - Database error

---

#### 6. Get All User Devices

**Endpoint**: `GET /api/devices`

**Description**: Retrieves all devices registered to the user

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "count": 2,
  "devices": [
    {
      "id": "device-doc-id-1",
      "userId": "abc123",
      "deviceId": "DEVICE-001",
      "name": "Living Room Purifier",
      "location": {...},
      "settings": {...},
      "status": {
        "online": true,
        "lastSeen": "2025-01-07T12:30:00.000Z"
      }
    },
    {
      "id": "device-doc-id-2",
      "deviceId": "DEVICE-002",
      "name": "Bedroom Purifier",
      ...
    }
  ]
}
```

---

#### 7. Get Specific Device

**Endpoint**: `GET /api/devices/:id`

**Description**: Retrieves a specific device by Firestore document ID

**Authentication**: Required (Firebase ID Token)

**URL Parameters**:
- `id` - Firestore document ID (not hardware deviceId)

**Response** (200 OK):
```json
{
  "id": "device-doc-id-1",
  "userId": "abc123",
  "deviceId": "DEVICE-001",
  "name": "Living Room Purifier",
  "location": {...},
  "settings": {...},
  "status": {...}
}
```

**Error Responses**:
- `403 Forbidden` - Device does not belong to user
- `404 Not Found` - Device not found

---

#### 8. Update Device

**Endpoint**: `PUT /api/devices/:id`

**Description**: Updates device settings or name

**Authentication**: Required (Firebase ID Token)

**Request Body**:
```json
{
  "name": "Master Bedroom Purifier",
  "settings": {
    "autoMode": false,
    "fanSpeed": 3,
    "sensitivity": 1
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Device updated successfully",
  "device": {...}
}
```

---

#### 9. Update Device Location

**Endpoint**: `PUT /api/devices/:id/location`

**Description**: Updates device's physical location

**Authentication**: Required (Firebase ID Token)

**Request Body**:
```json
{
  "name": "Office",
  "city": "Seoul",
  "latitude": 37.5665,
  "longitude": 126.9780
}
```

**Response** (200 OK):
```json
{
  "message": "Device location updated successfully",
  "device": {...}
}
```

---

#### 10. Delete Device

**Endpoint**: `DELETE /api/devices/:id`

**Description**: Removes device from user's account

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "message": "Device deleted successfully",
  "device": {...}
}
```

---

### Environment Data Endpoints

#### 11. Upload Environment Data (IoT Device)

**Endpoint**: `POST /api/data/upload`

**Description**: Uploads sensor readings and health events from Raspberry Pi

**Authentication**: API Key (X-API-Key header)

**Headers**:
```
X-API-Key: your-device-api-key
Content-Type: application/json
```

**Request Body**:
```json
{
  "deviceId": "DEVICE-001",
  "data": {
    "aqi": 45,
    "pm25": 12.5,
    "pm10": 18.3,
    "o3": 0.05,
    "no2": 0.02,
    "so2": 0.01,
    "co": 0.3,
    "temperature": 22.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "dominantPollutant": "PM2.5",
    "eventType": "cough",
    "confidence": 0.87,
    "raw": {...}
  }
}
```

**Health Event Fields** (from ML model):
- `eventType` (string) - "cough", "sneeze", "sniff", "snore", or null
- `confidence` (number) - ML model confidence score (0-1)

**Response** (201 Created):
```json
{
  "message": "Environment data stored successfully",
  "id": "env-data-doc-id",
  "timestamp": "2025-01-07T14:30:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid API key
- `404 Not Found` - Device not registered

---

#### 12. Batch Upload (Multiple Readings)

**Endpoint**: `POST /api/data/upload/batch`

**Description**: Uploads multiple sensor readings in one request

**Authentication**: API Key (X-API-Key header)

**Request Body**:
```json
{
  "deviceId": "DEVICE-001",
  "readings": [
    {
      "aqi": 45,
      "pm25": 12.5,
      "temperature": 22.5,
      "eventType": "cough",
      "confidence": 0.87
    },
    {
      "aqi": 47,
      "pm25": 13.1,
      "temperature": 22.7,
      "eventType": null
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "message": "Stored 2 of 2 readings",
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "success": true,
      "id": "env-data-1",
      "timestamp": "2025-01-07T14:30:00.000Z"
    },
    {
      "success": true,
      "id": "env-data-2",
      "timestamp": "2025-01-07T14:31:00.000Z"
    }
  ]
}
```

---

#### 13. Device Ping (Health Check)

**Endpoint**: `POST /api/data/ping`

**Description**: Updates device online status

**Authentication**: API Key (X-API-Key header)

**Request Body**:
```json
{
  "deviceId": "DEVICE-001"
}
```

**Response** (200 OK):
```json
{
  "message": "Ping received",
  "timestamp": "2025-01-07T14:35:00.000Z"
}
```

---

#### 14. Get Latest Environment Data

**Endpoint**: `GET /api/devices/:id/environment/latest`

**Description**: Gets the most recent sensor reading for a device

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "id": "env-data-id",
  "deviceId": "device-doc-id",
  "deviceHardwareId": "DEVICE-001",
  "userId": "abc123",
  "data": {
    "aqi": 45,
    "pm25": 12.5,
    "temperature": 22.5,
    "humidity": 45.2,
    "eventType": "cough",
    "confidence": 0.87
  },
  "location": {...},
  "timestamp": "2025-01-07T14:30:00.000Z"
}
```

---

#### 15. Get Environment Data History

**Endpoint**: `GET /api/devices/:id/environment/history?days=7&limit=100`

**Description**: Gets historical sensor readings for a device

**Authentication**: Required (Firebase ID Token)

**Query Parameters**:
- `days` (number, default: 7) - Number of days to retrieve
- `limit` (number, default: 100) - Maximum number of records

**Response** (200 OK):
```json
{
  "count": 42,
  "history": [
    {
      "id": "env-1",
      "data": {...},
      "timestamp": "2025-01-07T14:30:00.000Z"
    },
    ...
  ]
}
```

---

#### 16. Get Device Statistics

**Endpoint**: `GET /api/devices/:id/statistics?days=7`

**Description**: Gets aggregated statistics (averages, min, max) for a device

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "count": 42,
  "period": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-07T14:30:00.000Z"
  },
  "averages": {
    "aqi": 47.3,
    "pm25": 13.8,
    "pm10": 19.2,
    "temperature": 22.4,
    "humidity": 44.8
  },
  "min": {
    "aqi": 28,
    "pm25": 8.1,
    "temperature": 20.5,
    "humidity": 38.2
  },
  "max": {
    "aqi": 89,
    "pm25": 24.3,
    "temperature": 25.1,
    "humidity": 52.6
  }
}
```

---

#### 17. Get Dashboard (All Devices)

**Endpoint**: `GET /api/devices/all/environment`

**Description**: Gets latest data for all user's devices

**Authentication**: Required (Firebase ID Token)

**Response** (200 OK):
```json
{
  "count": 2,
  "devices": [
    {
      "device": {
        "id": "device-1",
        "name": "Living Room Purifier",
        ...
      },
      "data": {
        "aqi": 45,
        "pm25": 12.5,
        ...
      }
    },
    {
      "device": {
        "id": "device-2",
        "name": "Bedroom Purifier",
        ...
      },
      "data": null
    }
  ]
}
```

---

## Data Models

### User Document (Firestore)

**Collection**: `users`

**Document ID**: Firebase UID

```javascript
{
  uid: string,                    // Firebase user ID
  email: string,                  // User email (required)
  username: string,               // Display name
  photoURL: string,               // Profile photo URL

  // Location
  location: {
    city: string,
    country: string,
    latitude: number,
    longitude: number
  },

  // Contact
  phone: string,
  dob: string,                    // ISO date string
  country: string,

  // Health Preferences
  respiratorySensitivities: [     // Array of strings
    "pollen",
    "dust",
    "pet dander",
    "smoke",
    "mold"
  ],

  quietHours: {
    start: string,                // "22:00" (24-hour format)
    end: string                   // "07:00"
  },

  preferredTemp: {
    min: number,                  // Celsius
    max: number,
    unit: "celsius"
  },

  preferredHumidity: {
    min: number,                  // Percentage
    max: number
  },

  // System Fields
  deviceCount: number,            // Incremented/decremented automatically
  createdAt: string,              // ISO timestamp
  updatedAt: string               // ISO timestamp
}
```

---

### Device Document (Firestore)

**Collection**: `devices`

**Document ID**: Auto-generated

```javascript
{
  userId: string,                 // Reference to user
  deviceId: string,               // Hardware device ID (unique)
  name: string,                   // User-defined name

  location: {
    name: string,                 // "Living Room"
    city: string,
    latitude: number,
    longitude: number,
    lastUpdated: string           // ISO timestamp
  },

  settings: {
    autoMode: boolean,            // true = Auto, false = Manual
    fanSpeed: number,             // 1-10 or percentage
    sensitivity: number           // 1-5
  },

  status: {
    online: boolean,
    lastSeen: string              // ISO timestamp
  },

  createdAt: string,
  updatedAt: string
}
```

---

### Environment Data Document (Firestore)

**Collection**: `environmentData`

**Document ID**: Auto-generated

**Retention**: 1 year

```javascript
{
  deviceId: string,               // Firestore device document ID
  deviceHardwareId: string,       // Physical device ID
  userId: string,                 // Reference to user

  data: {
    // Air Quality
    aqi: number,                  // Air Quality Index
    pm25: number,                 // PM2.5 (μg/m³)
    pm10: number,                 // PM10 (μg/m³)
    o3: number,                   // Ozone (ppm)
    no2: number,                  // Nitrogen dioxide (ppm)
    so2: number,                  // Sulfur dioxide (ppm)
    co: number,                   // Carbon monoxide (ppm)
    dominantPollutant: string,    // "PM2.5", "O3", etc.

    // Environmental
    temperature: number,          // Celsius
    humidity: number,             // Percentage
    pressure: number,             // hPa

    // Health Events (from ML model on Raspberry Pi)
    eventType: string,            // "cough", "sneeze", "sniff", "snore", null
    confidence: number,           // 0.0 - 1.0 (ML confidence)

    // Raw sensor data (optional)
    raw: object                   // Any additional sensor data
  },

  location: object,               // Copy of device location at time of reading
  timestamp: string,              // ISO timestamp (when data was recorded)
  createdAt: string               // ISO timestamp (when stored in DB)
}
```

---

## Frontend Integration Guide

### Step 1: Install Firebase SDK

```bash
npm install firebase
```

### Step 2: Initialize Firebase (Frontend)

```javascript
// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### Step 3: Implement Google Sign-In

```javascript
// src/auth/GoogleSignIn.jsx
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

async function handleGoogleSignIn() {
  try {
    // Step 1: Google OAuth via Firebase
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Step 2: Get Firebase ID token
    const idToken = await user.getIdToken();

    // Step 3: Check if user exists in Firestore
    const response = await fetch('http://localhost:3001/auth/me', {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      // User exists, go to home page
      const userData = await response.json();
      console.log('User profile:', userData);
      navigate('/home');

    } else if (response.status === 404) {
      // New user, show profile completion
      navigate('/complete-profile', {
        state: {
          uid: user.uid,
          email: user.email,
          username: user.displayName,
          photoURL: user.photoURL,
          idToken
        }
      });
    } else {
      throw new Error('Authentication failed');
    }

  } catch (error) {
    console.error('Sign-in error:', error);
    alert('Sign-in failed. Please try again.');
  }
}
```

### Step 4: Complete Profile Screen

```javascript
// src/auth/CompleteProfile.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

function CompleteProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const { uid, email, username, photoURL, idToken } = location.state;

  const [formData, setFormData] = useState({
    city: '',
    country: '',
    respiratorySensitivities: [],
    quietHours: { start: '22:00', end: '07:00' },
    preferredTemp: { min: 20, max: 24 },
    preferredHumidity: { min: 40, max: 60 }
  });

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3001/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid,
          email,
          username,
          photoURL,
          location: {
            city: formData.city,
            country: formData.country
          },
          respiratorySensitivities: formData.respiratorySensitivities,
          quietHours: formData.quietHours,
          preferredTemp: formData.preferredTemp,
          preferredHumidity: formData.preferredHumidity
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User registered:', data);
        navigate('/home');
      } else {
        throw new Error('Registration failed');
      }

    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to complete profile. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields for profile completion */}
      <input
        type="text"
        placeholder="City"
        value={formData.city}
        onChange={(e) => setFormData({...formData, city: e.target.value})}
      />
      {/* ... other fields ... */}
      <button type="submit">Save & Continue</button>
    </form>
  );
}
```

### Step 5: Making Authenticated API Calls

```javascript
// src/api/devices.js
import { auth } from '../firebase';

async function getDevices() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();

  const response = await fetch('http://localhost:3001/api/devices', {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });

  if (!response.ok) throw new Error('Failed to fetch devices');

  return await response.json();
}

async function registerDevice(deviceId, name, location) {
  const user = auth.currentUser;
  const idToken = await user.getIdToken();

  const response = await fetch('http://localhost:3001/api/devices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deviceId, name, location })
  });

  if (!response.ok) throw new Error('Failed to register device');

  return await response.json();
}
```

---

## Raspberry Pi Integration

### Python Example: Upload Environment Data

```python
#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime

# Configuration
API_URL = "http://your-server:3001/api/data/upload"
API_KEY = "your-device-api-key"
DEVICE_ID = "DEVICE-001"

def upload_sensor_data(sensor_readings, ml_event=None):
    """
    Upload sensor data to Firebase API

    Args:
        sensor_readings: dict with sensor values
        ml_event: dict with ML detection results (optional)
            {
                "eventType": "cough" | "sneeze" | "sniff" | "snore",
                "confidence": 0.87
            }
    """
    payload = {
        "deviceId": DEVICE_ID,
        "data": {
            "aqi": sensor_readings.get("aqi"),
            "pm25": sensor_readings.get("pm25"),
            "pm10": sensor_readings.get("pm10"),
            "temperature": sensor_readings.get("temperature"),
            "humidity": sensor_readings.get("humidity"),
            "pressure": sensor_readings.get("pressure"),
        }
    }

    # Add ML event if detected
    if ml_event:
        payload["data"]["eventType"] = ml_event["eventType"]
        payload["data"]["confidence"] = ml_event["confidence"]

    try:
        response = requests.post(
            API_URL,
            headers={
                "X-API-Key": API_KEY,
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=10
        )

        if response.status_code == 201:
            print(f"✅ Data uploaded successfully: {response.json()}")
            return True
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False


def send_health_check():
    """Send periodic ping to update device status"""
    ping_url = API_URL.replace("/upload", "/ping")

    try:
        response = requests.post(
            ping_url,
            headers={
                "X-API-Key": API_KEY,
                "Content-Type": "application/json"
            },
            json={"deviceId": DEVICE_ID},
            timeout=5
        )

        if response.status_code == 200:
            print("💚 Device online status updated")
            return True

    except requests.exceptions.RequestException:
        print("❌ Failed to update device status")
        return False


# Main loop
if __name__ == "__main__":
    print(f"🚀 Starting PuriCare sensor upload for {DEVICE_ID}")

    while True:
        # Read sensor data (replace with actual sensor code)
        sensor_readings = {
            "aqi": 45,
            "pm25": 12.5,
            "pm10": 18.3,
            "temperature": 22.5,
            "humidity": 45.2,
            "pressure": 1013.25
        }

        # Check for ML detection (replace with actual ML inference)
        ml_event = None
        # if cough_detected:
        #     ml_event = {"eventType": "cough", "confidence": 0.87}

        # Upload data
        upload_sensor_data(sensor_readings, ml_event)

        # Send health check every 5 minutes
        if int(time.time()) % 300 == 0:
            send_health_check()

        # Wait 15 seconds (or whatever interval you need)
        time.sleep(15)
```

### Batch Upload Example

```python
def batch_upload_readings(readings_list):
    """
    Upload multiple readings at once

    Args:
        readings_list: list of dicts with sensor data
    """
    batch_url = API_URL.replace("/upload", "/upload/batch")

    payload = {
        "deviceId": DEVICE_ID,
        "readings": readings_list
    }

    response = requests.post(
        batch_url,
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=payload
    )

    result = response.json()
    print(f"✅ Uploaded {result['successful']}/{len(readings_list)} readings")

    if result['failed'] > 0:
        print(f"❌ Failed readings: {result.get('errors', [])}")
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Valid authentication but insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

### Common Error Responses

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

### Frontend Error Handling Example

```javascript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`http://localhost:3001${endpoint}`, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    if (error.message.includes('token')) {
      // Token expired, redirect to login
      window.location.href = '/login';
    } else {
      console.error('API error:', error);
      throw error;
    }
  }
}
```

---

## Environment Variables

Create `.env` file in `server/src/firebase/`:

```bash
# Server Configuration
FIREBASE_API_PORT=3001
NODE_ENV=development

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com

# Device API Key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
DEVICE_API_KEY=your-secure-random-api-key-here

# External API (Optional)
AQICN_TOKEN=your-air-quality-api-token
```

---

## Quick Start Checklist

### Backend Setup

- [ ] Create Firebase project at https://console.firebase.google.com/
- [ ] Enable Authentication > Google Sign-In provider
- [ ] Enable Firestore Database
- [ ] Generate service account key
- [ ] Place key file in `server/src/firebase/serviceAccountKey.json`
- [ ] Copy `.env.example` to `.env` and configure
- [ ] Run `npm install` in `server/src/firebase/`
- [ ] Run `npm run dev` to start server

### Frontend Setup

- [ ] Install Firebase SDK: `npm install firebase`
- [ ] Get Firebase config from Firebase Console
- [ ] Initialize Firebase in your app
- [ ] Implement Google Sign-In flow
- [ ] Create "Complete Profile" screens
- [ ] Call `/auth/register` after profile completion
- [ ] Use Firebase ID tokens for all authenticated API calls

### Raspberry Pi Setup

- [ ] Get device API key from backend team
- [ ] Install Python requests: `pip install requests`
- [ ] Implement sensor reading code
- [ ] Integrate ML model for health event detection
- [ ] Upload data every 15 seconds (or as needed)
- [ ] Send health check ping every 5 minutes

---

## Support

For questions or issues:
- Backend API: [Contact backend team]
- Firebase Console: https://console.firebase.google.com/
- API Documentation: This file
- Firestore Data Browser: Firebase Console > Firestore Database

---

**Last Updated**: January 7, 2025
**API Version**: 1.0.0
**Maintained by**: PuriCare Development Team
