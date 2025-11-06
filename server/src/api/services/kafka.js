// services/kafka.js
const { Kafka, logLevel } = require("kafkajs");

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "puri-api",
  brokers,
  logLevel: logLevel.ERROR,
});

const producer = kafka.producer({ allowAutoTopicCreation: true });

async function initProducer() {
  try {
    await producer.connect();
    console.log("Kafka producer connected");
  } catch (err) {
    console.error("Kafka producer connect failed:", err.message);
  }
}

module.exports = { kafka, producer, initProducer };
