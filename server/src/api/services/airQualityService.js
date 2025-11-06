// services/airQualityService.js
const axios = require("axios");
const AirQuality = require("../models/AirQuality");
const Device = require("../models/Device");
const { producer } = require("./kafka");

class AirQualityService {
  // Fetch air quality for a specific location
  async fetchAirQuality(city) {
    try {
      const token = process.env.AQICN_TOKEN;
      const response = await axios.get(
        `https://api.waqi.info/feed/${city}/?token=${token}`
      );

      if (response.data.status !== "ok") {
        throw new Error("Failed to fetch air quality data");
      }

      return response.data.data;
    } catch (error) {
      console.error(`Error fetching air quality for ${city}:`, error.message);
      throw error;
    }
  }

  // Fetch by coordinates
  async fetchAirQualityByCoords(lat, lon) {
    try {
      const token = process.env.AQICN_TOKEN;
      const response = await axios.get(
        `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`
      );

      if (response.data.status !== "ok") {
        throw new Error("Failed to fetch air quality data");
      }

      return response.data.data;
    } catch (error) {
      console.error(
        `Error fetching air quality for coords ${lat},${lon}:`,
        error.message
      );
      throw error;
    }
  }

  // Save air quality data to database
  async saveAirQuality(deviceId, userId, location, apiData) {
    try {
      const airQuality = new AirQuality({
        deviceId,
        userId,
        location,
        data: {
          aqi: apiData.aqi,
          pm25: apiData.iaqi?.pm25?.v,
          pm10: apiData.iaqi?.pm10?.v,
          o3: apiData.iaqi?.o3?.v,
          no2: apiData.iaqi?.no2?.v,
          so2: apiData.iaqi?.so2?.v,
          co: apiData.iaqi?.co?.v,
          dominentpol: apiData.dominentpol,
          temperature: apiData.iaqi?.t?.v,
          humidity: apiData.iaqi?.h?.v,
          raw: apiData,
        },
        fetchedAt: new Date(),
      });

      await airQuality.save();

      // Publish to Kafka (best-effort)
      try {
        const topic = process.env.TOPIC_AIRQUALITY || "airpurifier.airquality";
        await producer.send({
          topic,
          messages: [
            {
              key: String(deviceId),
              value: JSON.stringify({
                id: String(airQuality._id),
                deviceId: String(deviceId),
                userId: String(userId),
                location,
                data: airQuality.data,
                fetchedAt: airQuality.fetchedAt,
              }),
            },
          ],
        });
      } catch (e) {
        console.error("Kafka produce failed:", e.message);
      }

      console.log(`??Saved air quality data for device ${deviceId}`);
      return airQuality;
    } catch (error) {
      console.error(`Error saving air quality:`, error.message);
      throw error;
    }
  }

  // Fetch and cache air quality for a single device
  async updateDeviceAirQuality(deviceId) {
    try {
      const device = await Device.findById(deviceId);

      if (!device || !device.location) {
        console.log(`??��  Skipping device ${deviceId}: No location set`);
        return null;
      }

      let apiData;

      // Fetch by city or coordinates
      if (device.location.city) {
        apiData = await this.fetchAirQuality(device.location.city);
      } else if (device.location.latitude && device.location.longitude) {
        apiData = await this.fetchAirQualityByCoords(
          device.location.latitude,
          device.location.longitude
        );
      } else {
        console.log(`??��  Skipping device ${deviceId}: Invalid location data`);
        return null;
      }

      // Save to database
      return await this.saveAirQuality(
        deviceId,
        device.userId,
        device.location,
        apiData
      );
    } catch (error) {
      console.error(
        `Error updating air quality for device ${deviceId}:`,
        error.message
      );
      return null;
    }
  }

  // Update air quality for ALL devices with locations
  async updateAllDevicesAirQuality() {
    try {
      console.log(
        "?�� Starting scheduled air quality update for all devices..."
      );

      // Find all devices that have a location set
      const devices = await Device.find({
        $or: [
          { "location.city": { $exists: true, $ne: null } },
          {
            "location.latitude": { $exists: true, $ne: null },
            "location.longitude": { $exists: true, $ne: null },
          },
        ],
      });

      console.log(`?�� Found ${devices.length} devices with locations`);

      let successCount = 0;
      let failCount = 0;

      // Process each device
      for (const device of devices) {
        try {
          await this.updateDeviceAirQuality(device._id);
          successCount++;

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          failCount++;
          console.error(`Failed for device ${device._id}:`, error.message);
        }
      }

      console.log(
        `??Air quality update complete: ${successCount} successful, ${failCount} failed`
      );
      return { successCount, failCount, total: devices.length };
    } catch (error) {
      console.error("Error in scheduled air quality update:", error.message);
      throw error;
    }
  }
}

module.exports = new AirQualityService();

