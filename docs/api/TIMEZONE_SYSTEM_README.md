# Timezone-Based Device Management System

## Overview

This system implements an efficient timezone-based approach to managing devices across different geographic locations. Instead of checking every device individually for midnight routines, devices are grouped by timezone, reducing computational complexity from **O(n devices)** to **O(n timezones)**.

## Architecture

### Collections

#### 1. **timezones** Collection

Stores timezone information and device groupings.

```javascript
{
  id: "America/Chicago",              // Document ID (timezone name)
  timezone: "America/Chicago",        // Timezone identifier
  deviceIds: ["device1", "device2"],  // Array of device IDs in this timezone
  cityNames: ["Chicago", "Dallas"],   // Unique city names (for reference)
  deviceCount: 2,                     // Number of devices
  lastMidnightRun: Timestamp,         // Last time midnight routine ran
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 2. **devices** Collection

Stores individual device information (existing collection, enhanced).

```javascript
{
  id: "device-001",
  deviceId: "device-001",
  cityName: "Chicago",
  timezone: "America/Chicago",        // Denormalized for quick access
  latitude: 41.8781,                  // Optional
  longitude: -87.6298,                // Optional
  userId: "user123",
  metadata: { model: "PuriCare-X1" },
  status: "active",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Performance Benefits

### Complexity Reduction

| Scenario                       | Old Approach | New Approach | Improvement     |
| ------------------------------ | ------------ | ------------ | --------------- |
| 100 devices in 5 timezones     | O(100)       | O(5)         | **20x faster**  |
| 1,000 devices in 10 timezones  | O(1000)      | O(10)        | **100x faster** |
| 10,000 devices in 38 timezones | O(10000)     | O(38)        | **263x faster** |

### Why It's Faster

1. **Fewer timezone checks**: Only check ~38 timezones instead of thousands of devices
2. **Batch processing**: All devices in a timezone are processed together
3. **Single timestamp**: One `lastMidnightRun` per timezone instead of per device
4. **Efficient queries**: Direct lookup by timezone ID instead of scanning all devices

## Components

### 1. TimezoneService ([timezoneService.js](services/timezoneService.js))

Manages timezone collection and device groupings.

**Key Methods:**

- `addDeviceToTimezone(deviceId, cityName, timezone)` - Add device to timezone group
- `removeDeviceFromTimezone(deviceId, timezone)` - Remove device from timezone group
- `updateDeviceTimezone(deviceId, oldTz, newTz, cityName)` - Move device between timezones
- `getDevicesInTimezone(timezone)` - Get all devices in a timezone
- `getAllTimezones()` - Get all timezone documents
- `getTimezoneStats()` - Get distribution statistics

**Static Methods:**

- `getTimezoneFromCity(cityName, lat, lng)` - Convert city/coordinates to timezone

### 2. DeviceRegistrationHelper ([deviceRegistrationHelper.js](services/deviceRegistrationHelper.js))

Handles device registration with automatic timezone management.

**Key Methods:**

- `registerDevice(deviceData)` - Register new device (auto-adds to timezone)
- `unregisterDevice(deviceId)` - Unregister device (auto-removes from timezone)
- `bulkRegisterDevices(devicesArray)` - Register multiple devices at once
- `migrateExistingDevices()` - Migrate existing devices to timezone system

### 3. Midnight Routine ([midnightRoutine.js](scripts/midnightRoutine.js))

Timezone-aware midnight execution system.

**Features:**

- Checks timezones instead of individual devices
- Detects midnight in 30-minute window (23:45-00:14)
- Prevents duplicate executions on the same day
- Processes all devices in midnight timezones
- Detailed logging and error handling

## Usage

### Register a Device

```javascript
const DeviceRegistrationHelper = require('./services/deviceRegistrationHelper');

const helper = new DeviceRegistrationHelper();

await helper.registerDevice({
  deviceId: 'device-seoul-001',
  cityName: 'Seoul',
  latitude: 37.5665, // Optional
  longitude: 126.978, // Optional
  userId: 'user123',
  metadata: { model: 'PuriCare-X1' },
});
```

### Get Devices in a Timezone

```javascript
const TimezoneService = require('./services/timezoneService');

const service = new TimezoneService();

const result = await service.getDevicesInTimezone('America/Chicago');
console.log(result.devices); // ["device1", "device2"]
console.log(result.cityNames); // ["Chicago", "Dallas"]
console.log(result.deviceCount); // 2
```

### Run Midnight Routine

```bash
# Check for midnight in all timezones
npm run midnight
```

Output:

```
=== MIDNIGHT ROUTINE CHECK ===
Started at: 2025-11-08T10:00:00.000Z

Found 3 timezones to check:

[1/3] America/Chicago:
    Local Time: 2025-11-08 00:00:30 CST
    Devices: 5
    Cities: Chicago, Dallas
    Is Midnight Window: ✓ YES
    🌙 EXECUTING MIDNIGHT ROUTINE for America/Chicago
    → Processing 5 devices...
      • Device device-chicago-001 in Chicago
      • Device device-chicago-002 in Chicago
      ...
    ✓ Processed 5 devices
    ✓ Updated lastMidnightRun timestamp

=== SUMMARY ===
Total timezones checked: 3
Timezones at midnight: 1
Devices processed: 5
```

### Migrate Existing Devices

If you already have devices in your database without timezone information:

```javascript
const helper = new DeviceRegistrationHelper();

// This will:
// 1. Read all devices
// 2. Determine their timezones
// 3. Add them to timezone collection
// 4. Update device documents with timezone field
await helper.migrateExistingDevices();
```

### Test the System

```bash
# Run comprehensive test suite
npm run test-timezones
```

This will:

1. Register sample devices across multiple timezones
2. Display timezone distribution
3. Test device relocation (timezone changes)
4. Show performance metrics

## Supported Timezones

Currently supports major cities in:

**North America**: Chicago, New York, Los Angeles, Denver, Phoenix, Seattle, Miami, Dallas, Houston

**Europe**: London, Paris, Berlin, Madrid, Rome

**Asia**: Seoul, Tokyo, Beijing, Shanghai, Hong Kong, Singapore, Bangkok, Mumbai, Delhi

**Australia**: Sydney, Melbourne, Brisbane

**South America**: São Paulo, Buenos Aires, Santiago

### Adding More Cities

Edit [timezoneService.js:27-70](services/timezoneService.js#L27-L70) and add to `cityTimezoneMap`:

```javascript
'your city': 'Continent/City_Name',
```

### Using Coordinates (Recommended)

For precise timezone detection, install `geo-tz`:

```bash
npm install geo-tz
```

Then uncomment lines in [timezoneService.js:20-23](services/timezoneService.js#L20-L23).

## Midnight Routine Window

The system considers it "midnight" during a **30-minute window**:

- **23:45 - 23:59** (15 minutes before midnight)
- **00:00 - 00:14** (15 minutes after midnight)

This provides:

- **Flexibility** for cron jobs that don't run exactly at midnight
- **Reliability** if a check fails and retries within the window
- **Single execution** per day via `lastMidnightRun` tracking

### Customize the Window

Edit [midnightRoutine.js:39-41](scripts/midnightRoutine.js#L39-L41):

```javascript
const isMidnight =
  (hour === 23 && minute >= 45) || (hour === 0 && minute <= 14);
// Change minutes as needed
```

## Adding Midnight Routine Logic

Edit [midnightRoutine.js:84-95](scripts/midnightRoutine.js#L84-L95) to add your business logic:

```javascript
// Process each device in this timezone
for (const deviceId of deviceIds) {
  const deviceDoc = await db.collection('devices').doc(deviceId).get();
  const deviceData = deviceDoc.data();
  const cityName = deviceData.cityName;

  // YOUR LOGIC HERE:

  // Example 1: Reset daily counters
  await deviceDoc.ref.update({
    dailyAirQualityReadings: 0,
    dailyFilterUsage: 0,
  });

  // Example 2: Generate daily report
  await generateDailyReport(deviceId, cityName);

  // Example 3: City-specific actions
  if (cityName === 'Seoul') {
    await sendKoreanLanguageNotification(deviceId);
  }

  // Example 4: Clean up old data
  await db
    .collection('sensorReadings')
    .where('deviceId', '==', deviceId)
    .where('timestamp', '<', thirtyDaysAgo)
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => doc.ref.delete());
    });
}
```

## Setting Up Cron Jobs

### Option 1: Node-cron (in-process)

Add to [index.js](index.js):

```javascript
const cron = require('node-cron');
const { runMidnightRoutine } = require('./scripts/midnightRoutine');

// Run every minute (routine will check if it's midnight anywhere)
cron.schedule('* * * * *', async () => {
  try {
    await runMidnightRoutine();
  } catch (error) {
    console.error('Cron job failed:', error);
  }
});
```

### Option 2: System Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add line (runs every minute)
* * * * * cd /path/to/combined-api && npm run midnight >> /var/log/midnight.log 2>&1
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 11:00 PM
4. Action: Start a program
   - Program: `node`
   - Arguments: `C:\path\to\combined-api\scripts\midnightRoutine.js`
5. Set to repeat every 1 minute for 2 hours

## API Endpoints (Future)

Consider adding these routes to [index.js](index.js):

```javascript
// Get timezone statistics
app.get('/api/timezones/stats', async (req, res) => {
  const service = new TimezoneService();
  const stats = await service.getTimezoneStats();
  res.json(stats);
});

// Register device
app.post('/api/devices/register', async (req, res) => {
  const helper = new DeviceRegistrationHelper();
  const result = await helper.registerDevice(req.body);
  res.json(result);
});

// Get devices in timezone
app.get('/api/timezones/:timezone/devices', async (req, res) => {
  const service = new TimezoneService();
  const devices = await service.getDevicesInTimezone(req.params.timezone);
  res.json(devices);
});
```

## Troubleshooting

### No timezones found

**Problem**: Midnight routine shows "No timezones found"

**Solution**: Register devices using `DeviceRegistrationHelper.registerDevice()` or run migration:

```javascript
const helper = new DeviceRegistrationHelper();
await helper.migrateExistingDevices();
```

### Device in wrong timezone

**Problem**: Device shows incorrect timezone

**Solution**: Re-register the device with correct city name or coordinates:

```javascript
await helper.registerDevice({
  deviceId: 'device-001',
  cityName: 'Correct City Name',
  latitude: correctLat,
  longitude: correctLng,
});
```

### Midnight routine runs multiple times

**Problem**: Routine executes multiple times on same day

**Solution**: Check `lastMidnightRun` is being updated properly. Verify Firestore permissions allow writes.

### Unknown city warning

**Problem**: `⚠️ Unknown city "XYZ", defaulting to UTC`

**Solution**: Add the city to `cityTimezoneMap` in [timezoneService.js](services/timezoneService.js) or use coordinates.

## Future Enhancements

### Binary Search Optimization

For extremely large numbers of timezones (unlikely, max ~38 worldwide):

```javascript
// Sort timezones by UTC offset
const sortedTimezones = timezones.sort((a, b) => {
  return moment.tz(a.timezone).utcOffset() - moment.tz(b.timezone).utcOffset();
});

// Binary search for timezones near current midnight
// This could reduce O(38) to O(log 38) ≈ O(5)
```

**Note**: For 38 timezones, linear search is already very fast (~milliseconds). Binary search adds complexity with minimal performance gain.

### Geo-timezone Library

Install `geo-tz` for automatic timezone detection from coordinates:

```bash
npm install geo-tz
```

Then update `getTimezoneFromCity()` to use it.

### Timezone Change Notifications

Track when devices move timezones:

```javascript
// In DeviceRegistrationHelper.registerDevice()
if (oldTimezone !== newTimezone) {
  await notificationService.send({
    type: 'timezone_changed',
    deviceId,
    oldTimezone,
    newTimezone,
  });
}
```

## Files Created

- ✅ [services/timezoneService.js](services/timezoneService.js) - Timezone management
- ✅ [services/deviceRegistrationHelper.js](services/deviceRegistrationHelper.js) - Device registration
- ✅ [scripts/midnightRoutine.js](scripts/midnightRoutine.js) - Midnight execution (updated)
- ✅ [scripts/testTimezoneSystem.js](scripts/testTimezoneSystem.js) - Test suite
- ✅ [TIMEZONE_SYSTEM_README.md](TIMEZONE_SYSTEM_README.md) - This file

## Quick Commands

```bash
# Test midnight detection
npm run midnight

# Test timezone system
npm run test-timezones

# Start API server
npm start

# Development mode
npm run dev
```

## Questions?

This system is designed to scale efficiently as your device network grows. The timezone-based approach ensures that midnight routines remain fast even with thousands of devices worldwide.
