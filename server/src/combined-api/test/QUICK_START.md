# Quick Start: Testing Device Registration

## The Problem

Your service account doesn't have permission to create Firebase Auth users programmatically. This is why the original test failed with "insufficient permission" error.

## The Solution

Use Firebase's REST API to authenticate with a real user account and get a valid ID token.

## Setup (One-Time)

### 1. Enable Email/Password Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (cse4006)
3. Click **Authentication** in the left menu
4. Click **Sign-in method** tab
5. Enable **Email/Password** if not already enabled

### 2. Create a Test User

In Firebase Console → Authentication → Users:
- Click **Add user**
- Email: `test@puricare.com` (or any email you want)
- Password: Choose a password (e.g., `TestPassword123!`)
- Click **Add user**

### 3. Get Your Web API Key

1. Firebase Console → Project Settings (gear icon)
2. Scroll to **Your apps** section
3. Find **Web API Key**
4. Copy it

### 4. Add API Key to .env

Open your `.env` file and add:

```env
FIREBASE_WEB_API_KEY=your-web-api-key-here
```

## Running the Test

### Step 1: Set up test data (creates test devices)

```bash
npm run test:setup
```

This creates three test devices in your Firebase Firestore:
- TEST-DEVICE-001
- TEST-DEVICE-002
- TEST-DEVICE-003

### Step 2: Run the registration test

```bash
npm run test:register test@puricare.com TestPassword123!
```

Replace with the email and password you created in Firebase.

### Full Example

```bash
# Setup test devices
npm run test:setup

# Test registration
npm run test:register test@puricare.com MySecretPassword

# Test with specific device
npm run test:register test@puricare.com MySecretPassword TEST-DEVICE-002
```

## What the Test Does

1. Signs in to Firebase Auth using REST API
2. Gets a valid ID token
3. Sends POST request to `/api/devices/register` with the token
4. Verifies the device was registered in Firestore

## Expected Output (Success)

```
============================================================
DEVICE REGISTRATION TEST (Firebase REST API)
============================================================

📧 Email: test@puricare.com
🔑 Device ID: TEST-DEVICE-001

1️⃣  Getting ID token from Firebase Auth REST API...

✅ Successfully authenticated!
   User ID: abc123xyz...
   Token expires in: 3600 seconds

2️⃣  Testing device registration endpoint...

Request payload:
{
  "deviceID": "TEST-DEVICE-001",
  "name": "Test Air Purifier",
  "geo": [38.627, -90.1994],
  "timezone": "America/Chicago"
}

✅ SUCCESS! Device registered!

Response:
{
  "success": true,
  "deviceId": "TEST-DEVICE-001"
}

============================================================
✅ TEST PASSED
============================================================
```

## Troubleshooting

### "Missing FIREBASE_WEB_API_KEY"
→ Add your Web API Key to `.env` file

### "EMAIL_NOT_FOUND" or "INVALID_PASSWORD"
→ Create the user in Firebase Console → Authentication

### "Invalid device ID"
→ Run `npm run test:setup` to create test devices

### "Device already registered" (409 error)
→ The device has been claimed. Either:
  - Use a different device ID (TEST-DEVICE-002 or TEST-DEVICE-003)
  - Run `npm run test:setup` again to reset devices

### Server not responding
→ Make sure server is running: `npm run dev`

## Testing from Your App

Once you verify the API works, you can test from your mobile app or frontend:

```javascript
// In your app, after user signs in with Firebase Auth
const idToken = await firebase.auth().currentUser.getIdToken();

// Make request to your API
const response = await fetch('http://your-server:3020/api/devices/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    deviceID: 'REAL-DEVICE-ID',
    name: 'My Air Purifier',
    geo: [latitude, longitude],
    timezone: 'America/Chicago'
  })
});
```
