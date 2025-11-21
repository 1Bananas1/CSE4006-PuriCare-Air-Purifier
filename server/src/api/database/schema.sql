-- PuriCare Sensor Data Schema for TimescaleDB
-- This schema handles real-time sensor data from air purifier devices

-- ============================================
-- SENSOR READINGS TABLE (TimescaleDB Hypertable)
-- ============================================

CREATE TABLE IF NOT EXISTS sensor_readings (
  time TIMESTAMPTZ NOT NULL,
  device_id VARCHAR(50) NOT NULL,

  -- Sensor measurements
  rh FLOAT,           -- Relative Humidity (%)
  co FLOAT,           -- Carbon Monoxide (ppm)
  co2 FLOAT,          -- Carbon Dioxide (ppm)
  no2 FLOAT,          -- Nitrogen Dioxide (ppb)
  pm10 FLOAT,         -- Particulate Matter 10µm (µg/m³)
  pm25 FLOAT,         -- Particulate Matter 2.5µm (µg/m³)
  temp FLOAT,         -- Temperature (°C)
  tvoc FLOAT,         -- Total Volatile Organic Compounds (ppb)

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable (only if TimescaleDB extension is available)
-- Run this manually after creating the table:
-- SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for fast device-specific queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_sensor_device_time
ON sensor_readings (device_id, time DESC);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_sensor_time
ON sensor_readings (time DESC);

-- ============================================
-- SENSOR ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sensor_alerts (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,  -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  sensor_value FLOAT,
  threshold_value FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ
);

-- Index for fetching recent alerts per device
CREATE INDEX IF NOT EXISTS idx_alerts_device_time
ON sensor_alerts (device_id, created_at DESC);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged
ON sensor_alerts (device_id, acknowledged, created_at DESC)
WHERE acknowledged = FALSE;

-- ============================================
-- DEVICE SENSOR STATUS (Current state cache)
-- ============================================

CREATE TABLE IF NOT EXISTS device_sensor_status (
  device_id VARCHAR(50) PRIMARY KEY,

  -- Latest sensor values (cached for fast access)
  latest_rh FLOAT,
  latest_co FLOAT,
  latest_co2 FLOAT,
  latest_no2 FLOAT,
  latest_pm10 FLOAT,
  latest_pm25 FLOAT,
  latest_temp FLOAT,
  latest_tvoc FLOAT,

  -- Previous values (for change detection)
  previous_pm25 FLOAT,
  previous_co2 FLOAT,
  previous_tvoc FLOAT,
  previous_temp FLOAT,

  -- Timestamps
  last_reading_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTINUOUS AGGREGATES (TimescaleDB)
-- ============================================

-- These are created after the hypertable is set up
-- Run manually for TimescaleDB optimization:

/*
-- Hourly aggregates (for historical charts)
CREATE MATERIALIZED VIEW sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  AVG(rh) as avg_rh,
  AVG(co) as avg_co,
  AVG(co2) as avg_co2,
  AVG(no2) as avg_no2,
  AVG(pm10) as avg_pm10,
  AVG(pm25) as avg_pm25,
  AVG(temp) as avg_temp,
  AVG(tvoc) as avg_tvoc,
  MAX(pm25) as max_pm25,
  MAX(co2) as max_co2,
  MIN(temp) as min_temp,
  MAX(temp) as max_temp
FROM sensor_readings
GROUP BY bucket, device_id;

-- Daily aggregates (for long-term trends)
CREATE MATERIALIZED VIEW sensor_readings_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  device_id,
  AVG(pm25) as avg_pm25,
  MAX(pm25) as max_pm25,
  AVG(co2) as avg_co2,
  MAX(co2) as max_co2,
  AVG(temp) as avg_temp,
  MIN(temp) as min_temp,
  MAX(temp) as max_temp
FROM sensor_readings
GROUP BY bucket, device_id;

-- Refresh policies (auto-update aggregates)
SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('sensor_readings_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');
*/

-- ============================================
-- RETENTION POLICY (Auto-delete old data)
-- ============================================

-- Run manually after hypertable creation:
/*
-- Keep raw data for 30 days (increased from 7 for debugging)
SELECT add_retention_policy('sensor_readings', INTERVAL '30 days');
*/

-- ============================================
-- SAMPLE QUERIES (For reference)
-- ============================================

/*
-- Get latest reading for a device
SELECT * FROM sensor_readings
WHERE device_id = 'ABC123'
ORDER BY time DESC
LIMIT 1;

-- Get last 24 hours of data
SELECT * FROM sensor_readings
WHERE device_id = 'ABC123'
  AND time > NOW() - INTERVAL '24 hours'
ORDER BY time DESC;

-- Get hourly averages for the last week
SELECT * FROM sensor_readings_hourly
WHERE device_id = 'ABC123'
  AND bucket > NOW() - INTERVAL '7 days'
ORDER BY bucket DESC;

-- Get unacknowledged alerts
SELECT * FROM sensor_alerts
WHERE device_id = 'ABC123'
  AND acknowledged = FALSE
ORDER BY created_at DESC;
*/
