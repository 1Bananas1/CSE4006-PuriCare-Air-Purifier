// workers/telemetryConsumer.js
const { kafka, producer } = require("../services/kafka");
const Device = require("../models/Device");
const AirQuality = require("../models/AirQuality");

async function start() {
  try {
    const groupId = process.env.KAFKA_GROUP_ID || "puri-telemetry";
    const topic = process.env.TOPIC_TELEMETRY || "airpurifier.telemetry";

    const consumer = kafka.consumer({ groupId , allowAutoTopicCreation: true });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    console.log(`Kafka consumer subscribed to ${topic} (groupId=${groupId})`);

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const text = message.value ? message.value.toString() : "";
          if (!text) return;
          const payload = JSON.parse(text);

          const deviceIdStr = payload.deviceId;
          if (!deviceIdStr) return;

          const device = await Device.findOne({ deviceId: deviceIdStr });
          if (!device) {
            console.warn(`Telemetry from unknown deviceId=${deviceIdStr}`);
            return;
          }

          const doc = new AirQuality({
            deviceId: device._id,
            userId: device.userId,
            location: device.location || {},
            data: {
              aqi: payload.aqi,
              pm25: payload.pm25,
              pm10: payload.pm10,
              o3: payload.o3,
              no2: payload.no2,
              so2: payload.so2,
              co: payload.co,
              dominentpol: payload.dominentpol,
              temperature: payload.temperature,
              humidity: payload.humidity,
              raw: payload,
            },
            fetchedAt: payload.ts ? new Date(payload.ts) : new Date(),
          });

          await doc.save();
          try {
            const outTopic = process.env.TOPIC_AIRQUALITY || "airpurifier.airquality";
            await producer.send({
              topic: outTopic,
              messages: [
                {
                  key: String(device._id),
                  value: JSON.stringify({
                    id: String(doc._id),
                    deviceId: String(device._id),
                    userId: String(device.userId),
                    location: device.location || {},
                    data: doc.data,
                    fetchedAt: doc.fetchedAt,
                    telemetry: true,
                  }),
                },
              ],
            });
          } catch (produceErr) {
            console.error("Kafka produce failed:", produceErr.message);
          }
        } catch (err) {
          console.error("Telemetry handle error:", err.message);
        }
      },
    });
  } catch (err) {
    console.error("Kafka consumer start failed:", err.message);
  }
}

module.exports = { start };
