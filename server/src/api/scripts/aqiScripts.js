require('dotenv').config();

async function initialRegistrationCall([lat, long]) {
  console.log('Retrieving first time data...');
  const token = process.env.AQICN_TOKEN;
  const response = await fetch(
    `https://api.waqi.info/feed/geo:${lat};${long}/?token=${token}`
  );

  if (!response.ok) {
    throw new Error(`HTTP Error, status: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

module.exports = initialRegistrationCall;
