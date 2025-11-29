-- Device events table
CREATE TABLE IF NOT EXISTS device_events (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_events_device_time
ON device_events (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_device_events_user_time
ON device_events (user_id, timestamp DESC);