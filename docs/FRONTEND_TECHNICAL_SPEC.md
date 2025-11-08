# PureCare Air Purifier - Frontend Technical Specification

**Project:** CSE4006 PureCare Air Purifier PWA
**Created:** November 3, 2025
**For:** Soobin Yim (Frontend Lead)
**By:** Jimmy MacDonald, Yeonwoo Kim

---

## 1. PROJECT OVERVIEW

**What We're Building:**
A Progressive Web App (PWA) that provides a user interface to control and monitor smart air purifier devices. The PWA connects to a backend API to manage user authentication, device registration, real-time air quality monitoring, and device control settings.

**Architecture Pattern:**
- **Frontend:** Next.js PWA
- **Backend:** Node.js/Express API (already built)
- **Database:** MongoDB
- **UI Reference:** LG ThinQ design system ([https://ifdesign.com/en/winner-ranking/project/lg-thinq-ux-35/566320](https://ifdesign.com/en/winner-ranking/project/lg-thinq-ux-35/566320))

---

## 2. BACKEND API REFERENCE

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected endpoints require JWT bearer token in header:
```
Authorization: Bearer <token>
```

---

## 3. API ENDPOINTS & DATA CONTRACTS

### 3.1 Authentication Endpoints

#### POST `/auth/register`
**Purpose:** Create a new user account

**Request Body:**
```json
{
  "username": "string (required)",
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "string (MongoDB ObjectId)",
    "username": "string",
    "email": "string",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Error Responses:**
- `400`: Missing required fields
- `409`: Username or email already exists
- `500`: Server error

---

#### POST `/auth/login`
**Purpose:** Authenticate user and get JWT token

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "JWT_TOKEN_STRING",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string"
  }
}
```

**Error Responses:**
- `401`: Invalid credentials
- `500`: Server error

---

#### GET `/auth/verify`
**Purpose:** Validate current JWT token and return user info
**Authentication:** Required
**Query Parameters:** None

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Error Responses:**
- `401`: No token provided
- `403`: Invalid or expired token
- `500`: Server error

---

### 3.2 Device Management Endpoints

#### POST `/api/devices`
**Purpose:** Register a new air purifier device

**Request Body:**
```json
{
  "name": "string (required) - e.g., 'Living Room Purifier'",
  "deviceId": "string (required) - unique device identifier from QR code",
  "location": {
    "name": "string (optional) - e.g., 'Living Room'",
    "city": "string (optional)",
    "latitude": "number (optional)",
    "longitude": "number (optional)"
  }
}
```

**Response (201):**
```json
{
  "message": "Device registered successfully",
  "device": {
    "_id": "string (MongoDB ObjectId)",
    "userId": "string",
    "name": "string",
    "deviceId": "string",
    "location": {
      "name": "string",
      "city": "string",
      "latitude": "number",
      "longitude": "number",
      "lastUpdated": "ISO 8601 timestamp"
    },
    "settings": {
      "autoMode": "boolean (default: true)",
      "fanSpeed": "number (default: 1, range: 1-3)",
      "sensitivity": "number (default: 2, range: 1-5)"
    },
    "status": {
      "online": "boolean (default: false)",
      "lastSeen": "ISO 8601 timestamp"
    },
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Error Responses:**
- `400`: Missing required fields
- `409`: Device ID already registered
- `500`: Server error

---

#### GET `/api/devices`
**Purpose:** Get all devices owned by current user
**Authentication:** Required
**Query Parameters:** None

**Response (200):**
```json
[
  {
    "_id": "string",
    "userId": "string",
    "name": "string",
    "deviceId": "string",
    "location": { /* location object */ },
    "settings": { /* settings object */ },
    "status": { /* status object */ },
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
]
```

---

#### GET `/api/devices/:id`
**Purpose:** Get specific device details
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Response (200):**
```json
{
  "_id": "string",
  "userId": "string",
  "name": "string",
  "deviceId": "string",
  "location": { /* location object */ },
  "settings": { /* settings object */ },
  "status": { /* status object */ },
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

**Error Responses:**
- `404`: Device not found or doesn't belong to user
- `500`: Server error

---

#### PUT `/api/devices/:id`
**Purpose:** Update device settings and properties
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Request Body:** (all optional)
```json
{
  "name": "string",
  "location": {
    "name": "string",
    "city": "string",
    "latitude": "number",
    "longitude": "number"
  },
  "settings": {
    "autoMode": "boolean",
    "fanSpeed": "number (1-3)",
    "sensitivity": "number (1-5)"
  },
  "status": {
    "online": "boolean",
    "lastSeen": "ISO 8601 timestamp"
  }
}
```

**Response (200):**
```json
{
  "message": "Device updated successfully",
  "device": { /* updated device object */ }
}
```

**Error Responses:**
- `404`: Device not found
- `500`: Server error

---

#### DELETE `/api/devices/:id`
**Purpose:** Remove device from user's account
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Response (200):**
```json
{
  "message": "Device deleted successfully",
  "device": { /* deleted device object */ }
}
```

**Error Responses:**
- `404`: Device not found
- `500`: Server error

---

#### PUT `/api/devices/:id/location`
**Purpose:** Update device location (for air quality queries)
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Request Body:**
```json
{
  "name": "string (optional) - e.g., 'Living Room'",
  "city": "string (optional)",
  "latitude": "number (optional)",
  "longitude": "number (optional)"
}
```

**Response (200):**
```json
{
  "message": "Device location updated successfully",
  "device": { /* updated device object */ }
}
```

---

### 3.3 Air Quality Endpoints

#### GET `/api/devices/:id/airquality/latest`
**Purpose:** Get latest air quality data for a specific device
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Response (200):**
```json
{
  "_id": "string",
  "deviceId": "string",
  "userId": "string",
  "location": {
    "name": "string",
    "city": "string",
    "latitude": "number",
    "longitude": "number"
  },
  "data": {
    "aqi": "number - Air Quality Index (0-500)",
    "pm25": "number - PM2.5 particulates (µg/m³)",
    "pm10": "number - PM10 particulates (µg/m³)",
    "o3": "number - Ozone (ppb)",
    "no2": "number - Nitrogen Dioxide (ppb)",
    "so2": "number - Sulfur Dioxide (ppb)",
    "co": "number - Carbon Monoxide (ppm)",
    "dominentpol": "string - Dominant pollutant",
    "temperature": "number - Temperature (°C)",
    "humidity": "number - Humidity (%RH)"
  },
  "fetchedAt": "ISO 8601 timestamp",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

**Error Responses:**
- `404`: Device not found or no air quality data
- `500`: Server error

---

#### GET `/api/devices/:id/airquality/history`
**Purpose:** Get historical air quality data for a device
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Query Parameters:**
- `days` (number, optional, default: 7) - Number of days to retrieve

**Response (200):**
```json
[
  {
    "_id": "string",
    "deviceId": "string",
    "userId": "string",
    "location": { /* location object */ },
    "data": { /* data object */ },
    "fetchedAt": "ISO 8601 timestamp",
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
]
```

---

#### GET `/api/airquality/all`
**Purpose:** Get latest air quality data for ALL user's devices (dashboard view)
**Authentication:** Required
**Query Parameters:** None

**Response (200):**
```json
[
  {
    "_id": "string",
    "deviceId": "string",
    "userId": "string",
    "location": { /* location object */ },
    "data": { /* data object */ },
    "fetchedAt": "ISO 8601 timestamp",
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
]
```

---

#### POST `/api/devices/:id/airquality/fetch`
**Purpose:** Manually trigger air quality data fetch from external API
**Authentication:** Required
**Path Parameters:**
- `id` (string): Device MongoDB ObjectId

**Request Body:** None

**Response (200):**
```json
{
  "message": "Air quality data fetched successfully",
  "data": { /* latest air quality object */ }
}
```

**Error Responses:**
- `400`: Device location not set
- `404`: Device not found
- `500`: Server error

---

### 3.4 User Profile Endpoints

#### GET `/api/users/me`
**Purpose:** Get current user profile
**Authentication:** Required
**Query Parameters:** None

**Response (200):**
```json
{
  "_id": "string",
  "username": "string",
  "email": "string",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

---

## 4. REQUIRED UI PAGES & SCREENS

### 4.1 Authentication Flow

#### Page: `/auth/login`
**Components Needed:**
- Email/Username input field
- Password input field
- "Remember me" checkbox
- "Forgot Password?" link
- "Sign Up" link
- Submit button
- Error message display

**API Calls:**
- POST `/auth/login`

**On Success:**
- Store JWT token (localStorage or secure cookie)
- Redirect to home page

---

#### Page: `/auth/signup`
**Components Needed:**
- Full Name input
- Email input
- Password input
- Confirm Password input
- Terms & Conditions checkbox
- Submit button
- Login link

**Step 1 Fields:**
- Full Name
- Email
- Password
- Confirm Password
- Terms Agreement

**Step 2 Fields (optional):**
- Phone
- Profile Picture upload
- Date of Birth
- Country

**API Calls:**
- POST `/auth/register`

**On Success:**
- Redirect to login page

---

#### Page: `/auth/splash`
**Components Needed:**
- App logo
- App version
- Loading animation

**Duration:** 1-2 seconds (auto-redirect)

---

### 4.2 Device Management

#### Page: `/devices/register` (Add New Device)
**Components Needed:**
- QR Code scanner (camera access)
- Manual serial number entry option
- Permission requests (Camera, Notifications, Location)
- Device confirmation screen (show device image, name, serial)
- Device name input field
- Device location selection (room name or coordinates)
- Submit button

**API Calls:**
- POST `/api/devices`
- PUT `/api/devices/:id/location`

**On Success:**
- Redirect to home or device details

---

### 4.3 Main Navigation

#### Component: Bottom Navigation Bar
**Tabs:**
1. **Home** (house icon)
   - Route: `/home`

2. **Dashboard** (grid icon)
   - Route: `/dashboard`

3. **Control** (remote icon)
   - Route: `/control`

4. **Account** (profile icon)
   - Route: `/account`

**Behavior:**
- Persistent across all main pages
- Redirect to login if not authenticated

---

### 4.4 Home Page

#### Page: `/home`
**Components Needed:**
- User greeting: "Welcome back {username}"
- Current AQI status display
- Notification bell icon
- Settings gear icon
- Device list (grid/card view)

**Device Cards Display:**
- Device Name
- Device Model
- Status (online/offline)
- Last Active timestamp
- Quick Action button (power toggle?)
- "Add Device" floating action button

**API Calls:**
- GET `/api/devices`
- GET `/api/airquality/all`

**Refresh Behavior:**
- Auto-refresh every 30 seconds
- Manual refresh button
- Real-time status synchronization from IoT server

---

### 4.5 Dashboard Page

#### Page: `/dashboard`
**Components Needed:**
- Summary statistics cards:
  - Total Devices count
  - Active Devices count
  - Cumulative Usage Time
- Device overview section
  - Filter by health status
  - Quick controls for each device
- Usage history graph
- Active status graph

**API Calls:**
- GET `/api/devices`
- GET `/api/airquality/all`
- GET `/api/devices/:id/airquality/history?days=7`

**Chart Data:**
- X-axis: Time (hourly, daily, weekly view)
- Y-axis: AQI value or device usage
- Multi-line or stacked bar chart for multiple devices

---

### 4.6 Device Control Page

#### Page: `/control`
**Components Needed:**
- Device selector/dropdown
- Current air quality display
  - AQI value with color coding
  - PM2.5, PM10, O3, NO2, SO2, CO readings
  - Temperature (°C)
  - Humidity (%RH)
- Device status indicator (online/offline)
- Last updated timestamp

**Control Sliders/Toggles:**
- **Auto Mode** (toggle)
- **Fan Speed** (slider or buttons: 1-3)
- **Sensitivity** (slider or buttons: 1-5)

**Action Buttons:**
- Power On/Off
- Fetch latest air quality (manual trigger)
- View settings

**API Calls:**
- GET `/api/devices`
- GET `/api/devices/:id`
- GET `/api/devices/:id/airquality/latest`
- PUT `/api/devices/:id` (update settings)
- POST `/api/devices/:id/airquality/fetch` (manual refresh)

---

### 4.7 Account/Settings Page

#### Page: `/account`
**Components Needed:**
- User profile display
  - Username
  - Email
  - Account creation date
- Profile picture (if applicable)
- Logout button
- Delete account option (optional)
- Device management link (to device list)

**API Calls:**
- GET `/api/users/me`

---

## 5. DATA FLOW DIAGRAMS

### Authentication Flow
```
Login Page → POST /auth/login → Store JWT → Verify JWT → GET /auth/verify → Home Page
```

### Device Discovery & Registration
```
Add Device → QR Scan → POST /api/devices → Device Created → Set Location → PUT /api/devices/:id/location → Home Page
```

### Air Quality Monitoring
```
Home Page → GET /api/devices → GET /api/airquality/all → Display Cards → Auto-refresh every 30s
```

### Device Control
```
Control Page → GET /api/devices/:id → GET /api/devices/:id/airquality/latest → Display Sliders → PUT /api/devices/:id (on change)
```

---

## 6. AQI & POLLUTANT THRESHOLDS (for color coding)

Use these ranges to determine status colors:

**AQI Scale (0-500):**
- **0-50:** Good (Green)
- **51-100:** Moderate (Yellow)
- **101-150:** Unhealthy for Sensitive Groups (Orange)
- **151-200:** Unhealthy (Red)
- **201-300:** Very Unhealthy (Purple)
- **301+:** Hazardous (Maroon)

**PM2.5 (µg/m³):**
- **0-12:** Good
- **13-35:** Moderate
- **36-55:** Unhealthy for Sensitive Groups
- **56+:** Unhealthy

---

## 7. UI/UX DESIGN GUIDELINES

**Reference:** LG ThinQ Design System
- Clean, modern interface
- Rounded corners on cards
- Consistent color palette
- Large, readable fonts
- Accessible touch targets (minimum 44x44px)
- Dark mode support (optional, PWA feature)

**Responsive Design:**
- Mobile-first approach
- Breakpoints: 480px, 768px, 1024px
- Touch-friendly on mobile, mouse-friendly on desktop

---

## 8. AUTHENTICATION & SECURITY

**JWT Token Storage:**
- Recommended: Secure HTTP-only cookie or encrypted localStorage
- Include token in all API requests via `Authorization: Bearer` header
- Token expiration: 24 hours
- Implement token refresh logic if needed

**CORS & API Base URL:**
- Backend runs on `http://localhost:3000`
- Update base URL for production deployment

**Rate Limiting:**
- Auth endpoints: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes

---

## 9. OFFLINE & PWA FEATURES

**Service Worker:**
- Cache API responses for offline viewing
- Background sync for device updates
- Push notifications support

**Local Storage:**
- Store user JWT token
- Cache device list
- Cache latest air quality data

**Installation:**
- Add to Home Screen capability
- App manifest (manifest.json)

---

## 10. DEVELOPMENT TIMELINE

**Phase 1 (Week 1):** Authentication & Navigation
- Login/Signup pages
- Navigation bar setup
- Token management

**Phase 2 (Week 2):** Device Management
- Device registration flow
- Device list display
- Device cards on home page

**Phase 3 (Week 3):** Air Quality Display
- Dashboard with graphs
- Control page with sliders
- Real-time AQI display

**Phase 4 (Week 4):** Polish & Testing
- PWA configuration
- Testing across devices
- Performance optimization

---

## 11. QUESTIONS TO CLARIFY

Before starting implementation, please confirm:

1. ✅ **Login Methods:** Email/Username + Password only (no OAuth)
2. ✅ **UI Reference:** Follow LG ThinQ design system
3. ✅ **API Base URL:** `http://localhost:3000` for dev, will change for production
4. ✅ **Graph Library:** Recommendation: Chart.js, Recharts, or D3.js?
5. ✅ **Mobile Testing:** Test using Next.js PWA on phone via ngrok or local tunnel?

---

## 12. CONTACT & SUPPORT

**Backend/API Questions:** Yeonwoo Kim (yeonwoo@hanyang.ac.kr)
**Project Management:** Minjin Kim (minjin@hanyang.ac.kr)
**AI/ML Integration Questions:** Jimmy MacDonald (james.macdonald.1@slu.edu)

---

**Document Version:** 1.0
**Last Updated:** November 3, 2025
