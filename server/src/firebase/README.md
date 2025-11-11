# PuriCare Firebase API

A Firebase-based API for managing PuriCare Air Purifier users, devices, and environment data.

## Features

- **Firebase Authentication**: Secure user authentication and authorization
- **Firestore Database**: NoSQL cloud database for storing user data, devices, and environment readings
- **Device Management**: Register and manage IoT air purifier devices
- **Environment Data**: Store and retrieve air quality and sensor data from devices
- **External API Integration**: Support for external air quality APIs

## Architecture

```
server/src/firebase/
├── config/
│   └── firebase.js          # Firebase Admin SDK initialization
├── middleware/
│   └── auth.js              # Firebase authentication middleware
├── routes/
│   ├── auth.js              # User authentication endpoints
│   ├── devices.js           # Device management endpoints
│   └── data.js              # Environment data upload endpoints
├── services/
│   ├── userService.js       # User operations
│   ├── deviceService.js     # Device operations
│   └── environmentService.js # Environment data operations
├── index.js                 # Main server entry point
├── package.json
└── README.md
```

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password provider
4. Enable **Firestore Database**:
   - Go to Firestore Database
   - Create database (start in production mode)
   - Set up security rules (see below)

### 2. Generate Firebase Service Account Key

1. Go to Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Place it in a secure location (e.g., `server/src/firebase/serviceAccountKey.json`)
5. **IMPORTANT**: Add this file to `.gitignore` to prevent committing secrets

### 3. Environment Variables

Create a `.env` file in `server/src/firebase/`:

```env
# Server Configuration
FIREBASE_API_PORT=3001
NODE_ENV=development

# Firebase Configuration - Option 1: Service Account File
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com

# Firebase Configuration - Option 2: Individual Credentials
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"

# Device API Key (for IoT devices to upload data)
DEVICE_API_KEY=your-secure-random-api-key-here

# External API Integration (Optional)
AQICN_TOKEN=your-air-quality-api-token
```

### 4. Firestore Security Rules

In Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Devices collection
    match /devices/{deviceId} {
      allow read, update, delete: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }

    // Environment data collection
    match /environmentData/{dataId} {
      allow read: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if true; // Devices can write using API key
    }

    // Health check
    match /_health/{document=**} {
      allow read: if true;
    }
  }
}
```

### 5. Install Dependencies

```bash
cd server/src/firebase
npm install
```

### 6. Run the Server

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

### Authentication

#### Register User

**Note**: Users should first register using Firebase Auth SDK on the client, then call this endpoint to create their Firestore profile.

```http
POST /auth/register
Content-Type: application/json

{
  "uid": "firebase-user-uid",
  "email": "user@example.com",
  "username": "johndoe"
}
```

#### Get User Profile

```http
GET /auth/me
Authorization: Bearer <firebase-id-token>
```

#### Update User Profile

```http
PUT /auth/me
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "username": "newusername"
}
```

#### Verify Token

```http
GET /auth/verify
Authorization: Bearer <firebase-id-token>
```

### Device Management

#### Register Device

```http
POST /api/devices
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "deviceId": "DEVICE-001",
  "name": "Living Room Purifier",
  "location": {
    "name": "Living Room",
    "city": "St. Louis",
    "latitude": 38.6270,
    "longitude": -90.1994
  }
}
```

#### Get All User Devices

```http
GET /api/devices
Authorization: Bearer <firebase-id-token>
```

#### Get Specific Device

```http
GET /api/devices/:id
Authorization: Bearer <firebase-id-token>
```

#### Update Device

```http
PUT /api/devices/:id
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "name": "Bedroom Purifier",
  "settings": {
    "autoMode": true,
    "fanSpeed": 3,
    "sensitivity": 2
  }
}
```

#### Update Device Location

```http
PUT /api/devices/:id/location
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "name": "Office",
  "city": "St. Louis",
  "latitude": 38.6270,
  "longitude": -90.1994
}
```

#### Delete Device

```http
DELETE /api/devices/:id
Authorization: Bearer <firebase-id-token>
```

### Environment Data

#### Upload Data from Device

**Note**: This endpoint uses API key authentication for IoT devices.

```http
POST /api/data/upload
X-API-Key: <device-api-key>
Content-Type: application/json

{
  "deviceId": "DEVICE-001",
  "data": {
    "aqi": 45,
    "pm25": 12.5,
    "pm10": 18.3,
    "temperature": 22.5,
    "humidity": 45.2,
    "o3": 0.05,
    "no2": 0.02,
    "so2": 0.01,
    "co": 0.3,
    "dominantPollutant": "PM2.5"
  }
}
```

#### Batch Upload (Multiple Readings)

```http
POST /api/data/upload/batch
X-API-Key: <device-api-key>
Content-Type: application/json

{
  "deviceId": "DEVICE-001",
  "readings": [
    {
      "aqi": 45,
      "pm25": 12.5,
      "temperature": 22.5,
      "humidity": 45.2
    },
    {
      "aqi": 47,
      "pm25": 13.1,
      "temperature": 22.7,
      "humidity": 44.8
    }
  ]
}
```

#### Device Ping (Health Check)

```http
POST /api/data/ping
X-API-Key: <device-api-key>
Content-Type: application/json

{
  "deviceId": "DEVICE-001"
}
```

#### Get Latest Environment Data

```http
GET /api/devices/:id/environment/latest
Authorization: Bearer <firebase-id-token>
```

#### Get Environment Data History

```http
GET /api/devices/:id/environment/history?days=7&limit=100
Authorization: Bearer <firebase-id-token>
```

#### Get Device Statistics

```http
GET /api/devices/:id/statistics?days=7
Authorization: Bearer <firebase-id-token>
```

#### Get Dashboard (All Devices Latest Data)

```http
GET /api/devices/all/environment
Authorization: Bearer <firebase-id-token>
```

### External API

#### Fetch Air Quality for City

```http
GET /api/external/airquality/:city
Authorization: Bearer <firebase-id-token>
```

## Client Integration

### Web/Mobile App (Firebase Auth)

```javascript
// 1. Sign up user with Firebase Auth
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await createUserWithEmailAndPassword(
  auth,
  email,
  password
);
const user = userCredential.user;

// 2. Register user in Firestore via API
const response = await fetch('http://localhost:3001/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uid: user.uid,
    email: user.email,
    username: 'johndoe',
  }),
});

// 3. Make authenticated requests
const idToken = await user.getIdToken();

const devicesResponse = await fetch('http://localhost:3001/api/devices', {
  headers: {
    Authorization: `Bearer ${idToken}`,
  },
});
```

### IoT Device (API Key)

```python
# Python example for IoT device
import requests
import json

API_URL = "http://your-server:3001/api/data/upload"
API_KEY = "your-device-api-key"
DEVICE_ID = "DEVICE-001"

# Read sensor data
sensor_data = {
    "aqi": 45,
    "pm25": 12.5,
    "pm10": 18.3,
    "temperature": 22.5,
    "humidity": 45.2
}

# Upload to Firebase API
response = requests.post(
    API_URL,
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    },
    json={
        "deviceId": DEVICE_ID,
        "data": sensor_data
    }
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

## Firestore Data Structure

### Users Collection

```
users/{userId}
  ├── uid: string
  ├── email: string
  ├── username: string
  ├── deviceCount: number
  ├── createdAt: timestamp
  └── updatedAt: timestamp
```

### Devices Collection

```
devices/{deviceId}
  ├── userId: string
  ├── deviceId: string (hardware ID)
  ├── name: string
  ├── location: {
  │     name: string
  │     city: string
  │     latitude: number
  │     longitude: number
  │     lastUpdated: timestamp
  │   }
  ├── settings: {
  │     autoMode: boolean
  │     fanSpeed: number
  │     sensitivity: number
  │   }
  ├── status: {
  │     online: boolean
  │     lastSeen: timestamp
  │   }
  ├── createdAt: timestamp
  └── updatedAt: timestamp
```

### Environment Data Collection

```
environmentData/{dataId}
  ├── deviceId: string (Firestore doc ID)
  ├── deviceHardwareId: string
  ├── userId: string
  ├── data: {
  │     aqi: number
  │     pm25: number
  │     pm10: number
  │     temperature: number
  │     humidity: number
  │     o3: number
  │     no2: number
  │     so2: number
  │     co: number
  │     dominantPollutant: string
  │     raw: object
  │   }
  ├── location: object
  ├── timestamp: timestamp
  └── createdAt: timestamp
```

## Migration from MongoDB

If you're migrating from the existing MongoDB API:

1. Keep both APIs running on different ports
2. Gradually migrate users to Firebase Auth
3. Export MongoDB data and import to Firestore
4. Update client applications to use Firebase API
5. Once complete, deprecate MongoDB API

## Security Best Practices

1. **Never commit service account keys** - Add to `.gitignore`
2. **Use environment variables** for all sensitive data
3. **Enable Firestore security rules** to restrict access
4. **Use HTTPS** in production
5. **Rotate API keys** regularly
6. **Monitor usage** in Firebase Console
7. **Set up billing alerts** to prevent unexpected costs

## Troubleshooting

### Error: "Firebase initialization error"

- Check service account key path
- Verify environment variables are set correctly
- Ensure Firebase project exists

### Error: "Invalid or expired token"

- Token may be expired (Firebase tokens expire after 1 hour)
- User needs to re-authenticate
- Verify token is being sent correctly

### Error: "Device not found"

- Ensure device is registered first
- Check deviceId matches exactly
- Verify user owns the device

## License

ISC
