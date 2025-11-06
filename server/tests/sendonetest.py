# send_once.py
from kafka import KafkaProducer
import json, time
p = KafkaProducer(bootstrap_servers="127.0.0.1:9092",
                  key_serializer=lambda k: k.encode(),
                  value_serializer=lambda v: json.dumps(v).encode())
evt={"schemaVersion":"1.0","eventType":"audio.events","userId":"u_1","deviceId":"d_1",
     "ts":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
     "payload":{"type":"cough","prob":0.9,"snr":18}}
p.send("audio.events", key="u_1", value=evt).get(timeout=10)
print("sent")
