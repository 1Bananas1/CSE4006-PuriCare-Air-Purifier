/**
 * Data Export Routes
 * Export sensor data as CSV
 */

const express = require('express');
const router = express.Router();
const { getDatabase, isDatabaseAvailable } = require('../database/init');
const { generalLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/export/:deviceId/csv
 * Export sensor data as CSV
 */
router.get('/:deviceId/csv', generalLimiter, async (req, res) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Export service not available',
      });
    }

    const { deviceId } = req.params;
    const { startTime, endTime, limit } = req.query;

    const db = getDatabase();

    // Build query
    const conditions = ['device_id = $1'];
    const values = [deviceId];

    if (startTime) {
      conditions.push(`time >= $${values.length + 1}`);
      values.push(new Date(startTime));
    }

    if (endTime) {
      conditions.push(`time <= $${values.length + 1}`);
      values.push(new Date(endTime));
    }

    const limitClause = limit
      ? `LIMIT ${Math.min(parseInt(limit), 10000)}`
      : 'LIMIT 10000';

    const query = `
      SELECT
        time,
        rh as humidity,
        co as carbon_monoxide,
        co2 as carbon_dioxide,
        no2 as nitrogen_dioxide,
        pm10,
        pm25,
        temp as temperature,
        tvoc as volatile_compounds
      FROM sensor_readings
      WHERE ${conditions.join(' AND ')}
      ORDER BY time DESC
      ${limitClause};
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No data available for export',
      });
    }

    // Convert to CSV
    const headers = Object.keys(result.rows[0]);
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const values = headers.map((header) => {
        const value = row[header];
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value != null ? value : '';
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Set headers for file download
    const filename = `sensor-data-${deviceId}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/export/:deviceId/json
 * Export sensor data as JSON
 */
router.get('/:deviceId/json', generalLimiter, async (req, res) => {
  try {
    if (!isDatabaseAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Export service not available',
      });
    }

    const { deviceId } = req.params;
    const { startTime, endTime, limit } = req.query;

    const db = getDatabase();

    const conditions = ['device_id = $1'];
    const values = [deviceId];

    if (startTime) {
      conditions.push(`time >= $${values.length + 1}`);
      values.push(new Date(startTime));
    }

    if (endTime) {
      conditions.push(`time <= $${values.length + 1}`);
      values.push(new Date(endTime));
    }

    const limitClause = limit
      ? `LIMIT ${Math.min(parseInt(limit), 10000)}`
      : 'LIMIT 1000';

    const query = `
      SELECT * FROM sensor_readings
      WHERE ${conditions.join(' AND ')}
      ORDER BY time DESC
      ${limitClause};
    `;

    const result = await db.query(query, values);

    const filename = `sensor-data-${deviceId}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      deviceId,
      exportedAt: new Date().toISOString(),
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

module.exports = router;
