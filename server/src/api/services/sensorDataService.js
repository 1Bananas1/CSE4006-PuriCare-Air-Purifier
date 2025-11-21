/**
 * Sensor Data Service
 * Handles sensor data storage, retrieval, and alert detection
 */

const { getDatabase, isDatabaseAvailable } = require('../database/init');

// Alert thresholds for significant changes
const ALERT_THRESHOLDS = {
  PM25_SPIKE: 1.5, // 50% increase
  PM25_HIGH: 75, // Unhealthy level (µg/m³)
  PM25_CRITICAL: 150, // Very unhealthy level
  CO2_HIGH: 1000, // Poor ventilation (ppm)
  CO2_CRITICAL: 2000, // Very poor ventilation
  CO_HIGH: 9, // Dangerous level (ppm)
  TEMP_CHANGE: 3, // ±3°C sudden change
  TVOC_SPIKE: 1.8, // 80% increase
  TVOC_HIGH: 500, // High VOC level (ppb)
};

/**
 * Store sensor reading in database
 * @param {string} deviceId - Device ID
 * @param {object} sensorData - Sensor measurements
 * @param {Date} timestamp - Reading timestamp (optional, defaults to now)
 */
async function storeSensorReading(
  deviceId,
  sensorData,
  timestamp = new Date()
) {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available');
  }

  const db = getDatabase();

  const query = `
    INSERT INTO sensor_readings (
      time, device_id, rh, co, co2, no2, pm10, pm25, temp, tvoc
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const values = [
    timestamp,
    deviceId,
    sensorData.RH || null,
    sensorData.CO || null,
    sensorData.CO2 || null,
    sensorData.NO2 || null,
    sensorData.PM10 || null,
    sensorData.PM25 || null,
    sensorData.TEMP || null,
    sensorData.TVOC || null,
  ];

  try {
    const result = await db.query(query, values);
    console.log(`✅ Sensor data stored for device ${deviceId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error storing sensor data:', error);
    throw error;
  }
}

/**
 * Get latest sensor reading for a device
 * @param {string} deviceId - Device ID
 */
async function getLatestReading(deviceId) {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available');
  }

  const db = getDatabase();

  const query = `
    SELECT * FROM sensor_readings
    WHERE device_id = $1
    ORDER BY time DESC
    LIMIT 1;
  `;

  try {
    const result = await db.query(query, [deviceId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error fetching latest reading:', error);
    throw error;
  }
}

/**
 * Get historical sensor readings for a device
 * @param {string} deviceId - Device ID
 * @param {object} options - Query options
 * @param {Date} options.startTime - Start time
 * @param {Date} options.endTime - End time
 * @param {number} options.limit - Max number of readings
 */
async function getHistoricalReadings(deviceId, options = {}) {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available');
  }

  const db = getDatabase();

  const {
    startTime = new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
    endTime = new Date(),
    limit = 100,
  } = options;

  const query = `
    SELECT * FROM sensor_readings
    WHERE device_id = $1
      AND time >= $2
      AND time <= $3
    ORDER BY time DESC
    LIMIT $4;
  `;

  try {
    const result = await db.query(query, [deviceId, startTime, endTime, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching historical readings:', error);
    throw error;
  }
}

/**
 * Update device sensor status cache
 * @param {string} deviceId - Device ID
 * @param {object} sensorData - Sensor measurements
 */
async function updateDeviceStatus(deviceId, sensorData) {
  if (!isDatabaseAvailable()) {
    return;
  }

  const db = getDatabase();

  // First, get previous values
  const previousQuery = `
    SELECT latest_pm25, latest_co2, latest_tvoc, latest_temp
    FROM device_sensor_status
    WHERE device_id = $1;
  `;

  let previousValues = null;
  try {
    const prevResult = await db.query(previousQuery, [deviceId]);
    previousValues = prevResult.rows[0] || null;
  } catch (error) {
    console.error('Error fetching previous values:', error);
  }

  // Upsert current values
  const query = `
    INSERT INTO device_sensor_status (
      device_id, latest_rh, latest_co, latest_co2, latest_no2,
      latest_pm10, latest_pm25, latest_temp, latest_tvoc,
      previous_pm25, previous_co2, previous_tvoc, previous_temp,
      last_reading_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      latest_rh = EXCLUDED.latest_rh,
      latest_co = EXCLUDED.latest_co,
      latest_co2 = EXCLUDED.latest_co2,
      latest_no2 = EXCLUDED.latest_no2,
      latest_pm10 = EXCLUDED.latest_pm10,
      latest_pm25 = EXCLUDED.latest_pm25,
      latest_temp = EXCLUDED.latest_temp,
      latest_tvoc = EXCLUDED.latest_tvoc,
      previous_pm25 = device_sensor_status.latest_pm25,
      previous_co2 = device_sensor_status.latest_co2,
      previous_tvoc = device_sensor_status.latest_tvoc,
      previous_temp = device_sensor_status.latest_temp,
      last_reading_at = NOW(),
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    deviceId,
    sensorData.RH || null,
    sensorData.CO || null,
    sensorData.CO2 || null,
    sensorData.NO2 || null,
    sensorData.PM10 || null,
    sensorData.PM25 || null,
    sensorData.TEMP || null,
    sensorData.TVOC || null,
    previousValues?.latest_pm25 || null,
    previousValues?.latest_co2 || null,
    previousValues?.latest_tvoc || null,
    previousValues?.latest_temp || null,
  ];

  try {
    const result = await db.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error updating device status:', error);
    throw error;
  }
}

/**
 * Detect significant changes and generate alerts
 * @param {string} deviceId - Device ID
 * @param {object} newData - New sensor readings
 * @param {object} oldData - Previous sensor readings
 */
function detectSignificantChanges(deviceId, newData, oldData) {
  const alerts = [];

  if (!oldData) {
    // No previous data to compare
    return alerts;
  }

  // PM2.5 spike detection
  if (
    newData.PM25 &&
    oldData.latest_pm25 &&
    newData.PM25 > oldData.latest_pm25 * ALERT_THRESHOLDS.PM25_SPIKE
  ) {
    alerts.push({
      type: 'PM25_SPIKE',
      severity: 'high',
      message: `Air quality deteriorating rapidly`,
      sensorValue: newData.PM25,
      previousValue: oldData.latest_pm25,
      change: (
        ((newData.PM25 - oldData.latest_pm25) / oldData.latest_pm25) *
        100
      ).toFixed(1),
    });
  }

  // PM2.5 absolute high level
  if (newData.PM25 >= ALERT_THRESHOLDS.PM25_CRITICAL) {
    alerts.push({
      type: 'PM25_CRITICAL',
      severity: 'critical',
      message: 'Very unhealthy air quality detected',
      sensorValue: newData.PM25,
      threshold: ALERT_THRESHOLDS.PM25_CRITICAL,
    });
  } else if (newData.PM25 >= ALERT_THRESHOLDS.PM25_HIGH) {
    alerts.push({
      type: 'PM25_HIGH',
      severity: 'medium',
      message: 'Unhealthy air quality detected',
      sensorValue: newData.PM25,
      threshold: ALERT_THRESHOLDS.PM25_HIGH,
    });
  }

  // CO2 high level
  if (newData.CO2 >= ALERT_THRESHOLDS.CO2_CRITICAL) {
    alerts.push({
      type: 'CO2_CRITICAL',
      severity: 'critical',
      message: 'Very poor ventilation - immediate action required',
      sensorValue: newData.CO2,
      threshold: ALERT_THRESHOLDS.CO2_CRITICAL,
    });
  } else if (newData.CO2 >= ALERT_THRESHOLDS.CO2_HIGH) {
    alerts.push({
      type: 'CO2_HIGH',
      severity: 'medium',
      message: 'Poor ventilation detected - consider opening windows',
      sensorValue: newData.CO2,
      threshold: ALERT_THRESHOLDS.CO2_HIGH,
    });
  }

  // Carbon monoxide danger
  if (newData.CO >= ALERT_THRESHOLDS.CO_HIGH) {
    alerts.push({
      type: 'CO_DANGER',
      severity: 'critical',
      message:
        'Dangerous CO levels detected - evacuate and ventilate immediately',
      sensorValue: newData.CO,
      threshold: ALERT_THRESHOLDS.CO_HIGH,
    });
  }

  // Temperature sudden change
  if (
    newData.TEMP &&
    oldData.latest_temp &&
    Math.abs(newData.TEMP - oldData.latest_temp) >= ALERT_THRESHOLDS.TEMP_CHANGE
  ) {
    alerts.push({
      type: 'TEMP_CHANGE',
      severity: 'low',
      message: `Sudden temperature change detected`,
      sensorValue: newData.TEMP,
      previousValue: oldData.latest_temp,
      change: (newData.TEMP - oldData.latest_temp).toFixed(1),
    });
  }

  // TVOC spike
  if (
    newData.TVOC &&
    oldData.latest_tvoc &&
    newData.TVOC > oldData.latest_tvoc * ALERT_THRESHOLDS.TVOC_SPIKE
  ) {
    alerts.push({
      type: 'TVOC_SPIKE',
      severity: 'medium',
      message: 'Volatile organic compounds spike detected',
      sensorValue: newData.TVOC,
      previousValue: oldData.latest_tvoc,
      change: (
        ((newData.TVOC - oldData.latest_tvoc) / oldData.latest_tvoc) *
        100
      ).toFixed(1),
    });
  } else if (newData.TVOC >= ALERT_THRESHOLDS.TVOC_HIGH) {
    alerts.push({
      type: 'TVOC_HIGH',
      severity: 'medium',
      message: 'High VOC levels detected',
      sensorValue: newData.TVOC,
      threshold: ALERT_THRESHOLDS.TVOC_HIGH,
    });
  }

  return alerts;
}

/**
 * Store alert in database
 * @param {string} deviceId - Device ID
 * @param {object} alert - Alert object
 */
async function storeAlert(deviceId, alert) {
  if (!isDatabaseAvailable()) {
    return;
  }

  const db = getDatabase();

  const query = `
    INSERT INTO sensor_alerts (
      device_id, alert_type, severity, message, sensor_value, threshold_value
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    deviceId,
    alert.type,
    alert.severity,
    alert.message,
    alert.sensorValue,
    alert.threshold || null,
  ];

  try {
    const result = await db.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error storing alert:', error);
    throw error;
  }
}

/**
 * Get recent alerts for a device
 * @param {string} deviceId - Device ID
 * @param {number} limit - Max number of alerts
 * @param {boolean} unacknowledgedOnly - Only return unacknowledged alerts
 */
async function getAlerts(deviceId, limit = 20, unacknowledgedOnly = false) {
  if (!isDatabaseAvailable()) {
    return [];
  }

  const db = getDatabase();

  let query = `
    SELECT * FROM sensor_alerts
    WHERE device_id = $1
  `;

  if (unacknowledgedOnly) {
    query += ` AND acknowledged = FALSE`;
  }

  query += `
    ORDER BY created_at DESC
    LIMIT $2;
  `;

  try {
    const result = await db.query(query, [deviceId, limit]);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching alerts:', error);
    throw error;
  }
}

/**
 * Process new sensor data (store + detect changes + generate alerts)
 * @param {string} deviceId - Device ID
 * @param {object} sensorData - Sensor measurements
 * @returns {object} { stored: boolean, alerts: [] }
 */
async function processSensorData(deviceId, sensorData) {
  try {
    // Get previous device status for comparison
    const db = getDatabase();
    const prevStatusQuery = `
      SELECT * FROM device_sensor_status WHERE device_id = $1;
    `;
    const prevResult = await db.query(prevStatusQuery, [deviceId]);
    const previousStatus = prevResult.rows[0] || null;

    // Store the reading
    await storeSensorReading(deviceId, sensorData);

    // Update device status cache
    await updateDeviceStatus(deviceId, sensorData);

    // Detect significant changes
    const alerts = detectSignificantChanges(
      deviceId,
      sensorData,
      previousStatus
    );

    // Store alerts in database
    for (const alert of alerts) {
      await storeAlert(deviceId, alert);
    }

    return {
      stored: true,
      alerts: alerts,
      hasAlerts: alerts.length > 0,
    };
  } catch (error) {
    console.error('❌ Error processing sensor data:', error);
    throw error;
  }
}

module.exports = {
  storeSensorReading,
  getLatestReading,
  getHistoricalReadings,
  updateDeviceStatus,
  detectSignificantChanges,
  storeAlert,
  getAlerts,
  processSensorData,
  ALERT_THRESHOLDS,
};
