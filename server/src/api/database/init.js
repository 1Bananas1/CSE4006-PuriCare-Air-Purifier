/**
 * Database Initialization
 * Handles PostgreSQL connection and TimescaleDB setup
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 */
function initializeDatabase() {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL not set - sensor data features disabled');
    console.warn('   Set DATABASE_URL to enable sensor data storage');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === 'production'
          ? {
              rejectUnauthorized: false,
            }
          : false,
      max: 20, // Maximum number of clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
      } else {
        console.log('✅ PostgreSQL connected successfully');

        // Check if TimescaleDB extension is available
        pool.query(
          "SELECT extname FROM pg_extension WHERE extname = 'timescaledb'",
          (err, res) => {
            if (err) {
              console.warn('⚠️  Could not check for TimescaleDB extension');
            } else if (res.rows.length > 0) {
              console.log('✅ TimescaleDB extension detected');
            } else {
              console.warn(
                '⚠️  TimescaleDB extension not installed (optional)'
              );
              console.warn(
                '   Run: CREATE EXTENSION IF NOT EXISTS timescaledb;'
              );
            }
          }
        );
      }
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });

    return pool;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

/**
 * Run database migrations/schema setup
 */
async function runMigrations() {
  if (!pool) {
    console.warn('⚠️  Skipping migrations - database not initialized');
    return;
  }

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema (creates tables if they don't exist)
    await pool.query(schema);
    console.log('✅ Database schema initialized');

    // Try to create hypertable (will fail gracefully if already exists or TimescaleDB not available)
    try {
      await pool.query(`
        SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);
      `);
      console.log('✅ TimescaleDB hypertable created');
    } catch (error) {
      if (error.message.includes('already a hypertable')) {
        console.log('ℹ️  Hypertable already exists');
      } else if (error.message.includes('function create_hypertable')) {
        console.warn(
          '⚠️  TimescaleDB not available - using regular PostgreSQL table'
        );
      } else {
        console.warn('⚠️  Could not create hypertable:', error.message);
      }
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

/**
 * Get database connection pool
 */
function getDatabase() {
  if (!pool) {
    console.warn(
      '⚠️  Database not initialized - call initializeDatabase() first'
    );
  }
  return pool;
}

/**
 * Check if database is available
 */
function isDatabaseAvailable() {
  return pool !== null;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  runMigrations,
  getDatabase,
  isDatabaseAvailable,
  closeDatabase,
};
