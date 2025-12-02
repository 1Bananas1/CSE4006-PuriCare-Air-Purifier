#!/usr/bin/env python3
"""
Collect POSITIVE samples (real coughs).
"""
import sounddevice as sd
import pandas as pd
from datetime import datetime
import os

sample_rate = 8000
duration = 1.5

print("=" * 60)
print("🎙️  COLLECT COUGH SAMPLES (Positive)")
print("=" * 60)
print("\nCollect real coughs from anyone")
print("Variety helps: quiet, loud, different people")
print()

# Create directory
os.makedirs("audio_analyzer/hardware/AI/cough_dataset/cough", exist_ok=True)

count = 0
while True:
    response = input(f"Cough sample #{count + 1} - Press Enter to record or 'done': ")

    if response.lower() == 'done':
        break

    print(f"🎤 Recording in 3... 2... 1... COUGH!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/cough/cough_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}\n")
    count += 1

print(f"\n✅ Collected {count} cough samples")
print()
print("Recommendation: Aim for 50-100 samples for best results")
