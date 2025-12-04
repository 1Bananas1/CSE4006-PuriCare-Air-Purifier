#!/usr/bin/env python3
"""
Quick script to collect training samples for retraining.
"""
import sounddevice as sd
import pandas as pd
from datetime import datetime
import os

# Create directories
os.makedirs("audio_analyzer/hardware/AI/cough_dataset/non_cough", exist_ok=True)
os.makedirs("audio_analyzer/hardware/AI/cough_dataset/dry_cough", exist_ok=True)

sample_rate = 8000
duration = 1.5

print("=" * 60)
print("🎙️  TRAINING DATA COLLECTION")
print("=" * 60)
print("\nThis will help fix false positives!")
print("We'll record claps, talking, and other non-cough sounds.")
print()

# Collect claps
print("📣 Recording CLAPS (these are being detected as coughs)")
print("   We need 20-30 samples")
print()
input("Press Enter to start recording claps...")

clap_count = 0
while True:
    response = input(f"\nSample {clap_count + 1} - Press Enter to record a CLAP (or 'done' to finish): ")
    if response.lower() == 'done':
        break

    print("🎤 Recording... CLAP NOW!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/non_cough/clap_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}")
    clap_count += 1

print(f"\n✅ Collected {clap_count} clap samples")

# Collect other non-cough sounds
print("\n" + "=" * 60)
print("📣 Recording OTHER NON-COUGH SOUNDS")
print("   Examples: talking, music, background noise, laughing")
print()
input("Press Enter to start recording other sounds...")

other_count = 0
while True:
    sound_type = input(f"\nSample {other_count + 1} - What sound? (or 'done' to finish): ")
    if sound_type.lower() == 'done':
        break

    print(f"🎤 Recording... MAKE {sound_type.upper()} SOUND NOW!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/non_cough/{sound_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}")
    other_count += 1

print(f"\n✅ Collected {other_count} other sound samples")

# Collect real coughs (optional)
print("\n" + "=" * 60)
print("📣 Recording REAL COUGHS (optional)")
print("   Only if you can cough on command")
print()
response = input("Record coughs? (y/n): ")

if response.lower() == 'y':
    cough_count = 0
    while True:
        response = input(f"\nSample {cough_count + 1} - Press Enter to record a COUGH (or 'done' to finish): ")
        if response.lower() == 'done':
            break

        print("🎤 Recording... COUGH NOW!")
        audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
        sd.wait()

        filename = f"audio_analyzer/hardware/AI/cough_dataset/dry_cough/cough_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        df = pd.DataFrame(audio)
        df.to_csv(filename, header=False, index=False)
        print(f"✅ Saved: {filename}")
        cough_count += 1

    print(f"\n✅ Collected {cough_count} cough samples")

# Summary
print("\n" + "=" * 60)
print("📊 COLLECTION COMPLETE!")
print("=" * 60)
print(f"Claps: {clap_count}")
print(f"Other sounds: {other_count}")
if response.lower() == 'y':
    print(f"Coughs: {cough_count}")
print()
print("Next steps:")
print("1. Check your samples: ls audio_analyzer/hardware/AI/cough_dataset/*/*.csv")
print("2. Retrain: cd audio_analyzer && python train.py --stage both --epochs 50")
print()
