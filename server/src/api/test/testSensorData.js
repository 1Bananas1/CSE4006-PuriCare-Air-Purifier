/**
 * Sensor Data API Test Script
 * Tests the sensor data endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3020';
const DEVICE_ID = 'SIM001'; // Must exist in Firebase devices collection

// Test sensor data
const mockSensorData = {
  RH: 45.5,
  CO: 0.8,
  CO2: 650,
  NO2: 12,
  PM10: 25,
  PM25: 15,
  TEMP: 22.5,
  TVOC: 120,
};

async function testSensorDataEndpoints() {
  console.log('='.repeat(60));
  console.log('Testing Sensor Data API Endpoints');
  console.log('='.repeat(60));

  try {
    // Test 1: Health check
    console.log('\n[Test 1] Health Check');
    console.log('-'.repeat(40));

    const healthResponse = await axios.get(
      `${BASE_URL}/api/sensor-data/health`
    );
    console.log('✅ Health check passed');
    console.log('Status:', healthResponse.data.status);
    console.log('Message:', healthResponse.data.message);

    // Test 2: Submit sensor data
    console.log('\n[Test 2] Submit Sensor Data');
    console.log('-'.repeat(40));

    const submitResponse = await axios.post(`${BASE_URL}/api/sensor-data`, {
      deviceId: DEVICE_ID,
      timestamp: new Date().toISOString(),
      sensors: mockSensorData,
    });

    console.log('✅ Sensor data submitted');
    console.log('Response:', JSON.stringify(submitResponse.data, null, 2));

    // Test 3: Get latest reading
    console.log('\n[Test 3] Get Latest Reading');
    console.log('-'.repeat(40));

    const latestResponse = await axios.get(
      `${BASE_URL}/api/sensor-data/${DEVICE_ID}/latest`
    );

    console.log('✅ Latest reading retrieved');
    console.log('PM2.5:', latestResponse.data.data.pm25);
    console.log('CO2:', latestResponse.data.data.co2);
    console.log('Temperature:', latestResponse.data.data.temp);

    // Test 4: Get historical data
    console.log('\n[Test 4] Get Historical Data');
    console.log('-'.repeat(40));

    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    const historyResponse = await axios.get(
      `${BASE_URL}/api/sensor-data/${DEVICE_ID}/history?startTime=${startTime}&endTime=${endTime}&limit=10`
    );

    console.log('✅ Historical data retrieved');
    console.log('Count:', historyResponse.data.count);
    console.log('Sample:', historyResponse.data.data[0]);

    // Test 5: Get alerts
    console.log('\n[Test 5] Get Alerts');
    console.log('-'.repeat(40));

    const alertsResponse = await axios.get(
      `${BASE_URL}/api/sensor-data/${DEVICE_ID}/alerts?limit=5`
    );

    console.log('✅ Alerts retrieved');
    console.log('Count:', alertsResponse.data.count);

    if (alertsResponse.data.count > 0) {
      console.log('Latest alert:', alertsResponse.data.alerts[0]);
    }

    // Test 6: Submit high PM2.5 to trigger alert
    console.log('\n[Test 6] Test Alert Generation (High PM2.5)');
    console.log('-'.repeat(40));

    const highPM25Data = {
      ...mockSensorData,
      PM25: 85, // Very unhealthy level
    };

    const alertResponse = await axios.post(`${BASE_URL}/api/sensor-data`, {
      deviceId: DEVICE_ID,
      sensors: highPM25Data,
    });

    console.log('✅ High PM2.5 data submitted');
    console.log('Alerts generated:', alertResponse.data.alertsGenerated);

    if (alertResponse.data.alerts.length > 0) {
      console.log('\n🚨 Generated Alerts:');
      alertResponse.data.alerts.forEach((alert) => {
        console.log(`  [${alert.severity}] ${alert.message}`);
        console.log(`  Value: ${alert.sensorValue}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run tests
testSensorDataEndpoints();
