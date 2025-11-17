const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const initialRegistrationCall = require('../../scripts/aqiScripts');

async function test() {
  try {
    console.log('API Token:', process.env.AQICN_TOKEN ? 'Found' : 'Missing');
    const coords = [37.5559101, 127.0493059];
    const result = await initialRegistrationCall(coords);
    console.log('Success!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

test();
