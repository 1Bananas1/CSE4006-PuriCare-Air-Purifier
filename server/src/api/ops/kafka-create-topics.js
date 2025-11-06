// server/ops/kafka-create-topics.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Kafka, logLevel } = require('kafkajs');

const brokers = (process.env.KAFKA_BROKERS || '127.0.0.1:9092')
  .split(',').map(s => s.trim()).filter(Boolean);

(async () => {
  const kafka = new Kafka({ clientId: 'puri-admin', brokers, logLevel: logLevel.ERROR });
  const admin = await kafka.admin();
  await admin.connect();

  const topics = [
    { topic: process.env.TOPIC_AUDIO_EVENTS || 'audio.events',             numPartitions: 6, replicationFactor: 1 },
    { topic: process.env.TOPIC_AIRQUALITY  || 'airpurifier.airquality',   numPartitions: 6, replicationFactor: 1 },
    { topic: process.env.TOPIC_TELEMETRY   || 'airpurifier.telemetry',    numPartitions: 6, replicationFactor: 1 },
    { topic: process.env.TOPIC_COMMANDS    || 'airpurifier.commands',     numPartitions: 6, replicationFactor: 1 },
  ];

  await admin.createTopics({ topics, waitForLeaders: true });
  const md = await admin.fetchTopicMetadata({ topics: topics.map(t => t.topic) });
  console.log(JSON.stringify(md, null, 2));
  await admin.disconnect();
  console.log('topics ready');
})().catch(e => { console.error(e); process.exit(1); });
