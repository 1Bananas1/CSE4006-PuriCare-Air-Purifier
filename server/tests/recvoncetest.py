# recv_once.py
from kafka import KafkaConsumer
c = KafkaConsumer(
    'audio.events',
    bootstrap_servers='127.0.0.1:9092',
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    key_deserializer=lambda k: k.decode() if k else None,
    value_deserializer=lambda v: v.decode()
)
for m in c:
    print(f"key={m.key} value={m.value}")
    break
print("received")