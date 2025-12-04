#!/usr/bin/env python3
"""
Collect NEGATIVE samples (non-coughs) to fix false positives.
Focus: Claps, speech, and other sounds commonly mistaken for coughs.
"""
import sounddevice as sd
import pandas as pd
from datetime import datetime
import os

sample_rate = 8000
duration = 1.5

print("=" * 60)
print("🎙️  COLLECT NEGATIVE SAMPLES (Non-Coughs)")
print("=" * 60)
print("\nGoal: Teach model what is NOT a cough")
print("Priority: Claps, speech, throat clearing")
print()

# Create directory
os.makedirs("audio_analyzer/hardware/AI/cough_dataset/non_cough", exist_ok=True)

categories = {
    '1': ('clap', '👏 Clap'),
    '2': ('speech', '🗣️ Say a sentence'),
    '3': ('throat_clear', '😮‍💨 Clear throat'),
    '4': ('laugh', '😄 Laugh'),
    '5': ('background', '🔊 Background noise (TV, music, etc.)'),
}

print("Categories:")
for key, (cat, desc) in categories.items():
    print(f"  {key}. {desc}")
print()

count = 0
while True:
    choice = input(f"Sample #{count + 1} - Choose category (1-5) or 'done': ")

    if choice.lower() == 'done':
        break

    if choice not in categories:
        print("Invalid choice!")
        continue

    cat_name, cat_desc = categories[choice]

    print(f"🎤 Recording in 3... 2... 1... {cat_desc.upper()}!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/non_cough/{cat_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}\n")
    count += 1

print(f"\n✅ Collected {count} negative samples")
print()
print("Recommendations:")
print("  - Claps: 20-30 samples (your main problem!)")
print("  - Speech: 20-30 samples")
print("  - Throat clearing: 10-15 samples")
print("  - Others: 10+ samples each")
print()
print("Next: Collect real coughs or retrain if you have enough")
