# Device Registration Testing Guide

This directory contains scripts to test the device registration functionality.

## Quick Start

Follow these steps to test device registration:

### 1. Make sure your server is running

```bash
cd server/src/combined-api
npm run dev
```

The server should be running on `http://localhost:3020`

### 2. Set up test data in Firebase

This creates test devices in the `masterDeviceList` collection:

```bash
node test/setupTestData.js
```

This will create three test devices:

- `TEST-DEVICE-001` (PuriCare X1)
- `TEST-DEVICE-002` (PuriCare X2 Pro)
- `TEST-DEVICE-003` (PuriCare Mini)

### 3. Run the registration test

```bash
node test/testDeviceRegistration.js
```

This will:

- Create a test user (if needed)
- Generate an auth token
- Attempt to register `TEST-DEVICE-001` to that user
- Show you the results

### Advanced Usage

#### Test with a specific user and device:

```bash
node test/testDeviceRegistration.js my-user-123 TEST-DEVICE-002
```

#### Create a test user first:

```bash
node test/createTestUser.js test@example.com
```

Then use the returned User ID with the test script:

```bash
node test/testDeviceRegistration.js <user-id-from-above> TEST-DEVICE-001
```

## Test Scripts

### `setupTestData.js`

Creates test devices in Firebase's `masterDeviceList` collection. Run this first!

**Usage:**

```bash
node test/setupTestData.js
```

### `testDeviceRegistration.js`

Tests the `/api/devices/register` endpoint end-to-end.

**Usage:**

```bash
node test/testDeviceRegistration.js [user-id] [device-id]
```

**Examples:**

```bash
# Use defaults
node test/testDeviceRegistration.js

# Specify user ID
node test/testDeviceRegistration.js john-doe-123

# Specify both user and device
node test/testDeviceRegistration.js john-doe-123 TEST-DEVICE-002
```

### `createTestUser.js`

Creates a test user in Firebase Authentication.

**Usage:**

```bash
node test/createTestUser.js [email]
```

**Examples:**

```bash
# Generate a random test user
node test/createTestUser.js

# Create user with specific email
node test/createTestUser.js test@example.com
```

### `generateTestToken.js`

Generates a custom Firebase token for a user ID (advanced usage).

**Usage:**

```bash
node test/generateTestToken.js [user-id]
```

## Expected Test Results

### ✅ Success (Status 201)

```json
{
  "success": true,
  "deviceId": "TEST-DEVICE-001"
}
```

### ❌ Device Already Claimed (Status 409)

```json
{
  "error": "This device has already been registered."
}
```

### ❌ Invalid Device ID (Status 400)

```json
{
  "error": "Invalid device ID. The device does not exist in our system."
}
```

### ❌ Unauthorized (Status 401)

```json
{
  "error": "Unauthorized"
}
```

## Troubleshooting

### "Device not found" error

- Run `node test/setupTestData.js` to create test devices
- Check that the device ID exists in Firebase Console → Firestore → `masterDeviceList`

### "Already registered" error

- Run `node test/setupTestData.js` again to reset the devices
- Or manually set `claimedAt: null` in Firebase Console

### "Unauthorized" error

- Check that your `.env` file has correct Firebase credentials
- Make sure the auth middleware in `middleware/auth.js` is working correctly

### Server not responding

- Make sure the server is running: `npm run dev`
- Check that it's running on port 3020 (or update `API_URL` in the test script)

## Manual Testing with cURL

If you prefer to test manually:

1. Get a token:

```bash
node test/generateTestToken.js my-user-id
```

2. Use the token with cURL:

```bash
curl -X POST http://localhost:3020/api/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "deviceID": "TEST-DEVICE-001",
    "name": "My Test Device",
    "geo": [38.6270, -90.1994],
    "timezone": "America/Chicago"
  }'
```

## What Gets Created in Firebase

When a device is successfully registered:

1. **In `devices` collection:**
   - Document ID: `TEST-DEVICE-001`
   - Contains: `data` object with device info and `linkedUserID`

2. **In `masterDeviceList` collection:**
   - The device's `claimedAt` field is updated to current timestamp
   - The device's `linkedUserID` field is set to the user's ID

## Next Steps

After successful testing:

1. Test with your actual mobile app or frontend
2. Create real device entries in `masterDeviceList` (not TEST- prefixed)
3. Set up proper user authentication in your app
4. Test error cases (invalid devices, already claimed, etc.)
