// server/src/api/workers/audioEventsConsumer.js
const { kafka } = require("../services/kafka");
const Device = require("../models/Device");
const Data = require("../models/Data");

exports.start = async () => {
  const topic = process.env.TOPIC_AUDIO_EVENTS || "audio.events";
  const groupId = process.env.KAFKA_GROUP_ID_AUDIO || "puri-audio";

  const consumer = kafka.consumer({ groupId, allowAutoTopicCreation: true });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`Kafka consumer subscribed to ${topic} (groupId=${groupId})`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const key = message.key?.toString() || "";
        const payload = JSON.parse(message.value?.toString() || "{}");

        // deviceId로 소유자 찾기 → Data.userId 필수 충족
        const dev = await Device.findOne({ deviceId: payload.deviceId });
        if (!dev) {
          console.warn(`[audio.events] unknown deviceId=${payload.deviceId}`);
          return;
        }

        await Data.create({
          userId: dev.userId,
          title: topic,
          description: payload.event || payload.type || "audio-event",
          content: payload,
          metadata: new Map(key ? [["kafkaKey", key]] : []),
        });
      } catch (e) {
        console.error("[audio.events] handle error:", e.message);
      }
    },
  });
};
