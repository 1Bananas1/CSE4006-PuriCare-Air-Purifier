#!/usr/bin/env python3
"""
Quick sample collection - Fix false positives!
Collects: Real coughs vs non-coughs (claps, talking, etc.)
"""
import sounddevice as sd
import pandas as pd
from datetime import datetime
import os

sample_rate = 8000
duration = 1.5

print("=" * 60)
print("🎙️  FIX FALSE POSITIVES - Sample Collection")
print("=" * 60)
print("\nGoal: Teach model to distinguish coughs from claps/talking")
print()

# Collect NON-COUGH samples (claps!)
print("Step 1: Collect NON-COUGH sounds")
print("  - Claps (IMPORTANT - these are the false positives!)")
print("  - Talking")
print("  - Background noise")
print("  - Any other sounds")
print()

non_cough_count = 0
while True:
    sound = input(f"Non-cough #{non_cough_count + 1} - Enter sound type (clap/talk/noise) or 'done': ")
    if sound.lower() == 'done':
        break

    print(f"🎤 Recording in 3... 2... 1... MAKE {sound.upper()} SOUND!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/non_cough/{sound}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}\n")
    non_cough_count += 1

print(f"✅ Collected {non_cough_count} non-cough samples\n")

# Collect COUGH samples
print("Step 2: Collect REAL COUGH sounds")
print("  - Any type of cough")
print("  - From any person")
print()

cough_count = 0
while True:
    response = input(f"Cough #{cough_count + 1} - Press Enter to record or 'done': ")
    if response.lower() == 'done':
        break

    print(f"🎤 Recording in 3... 2... 1... COUGH!")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()

    filename = f"audio_analyzer/hardware/AI/cough_dataset/cough/cough_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    df = pd.DataFrame(audio)
    df.to_csv(filename, header=False, index=False)
    print(f"✅ Saved: {filename}\n")
    cough_count += 1

print(f"✅ Collected {cough_count} cough samples\n")

# Summary
print("=" * 60)
print("📊 COLLECTION COMPLETE!")
print("=" * 60)
print(f"Coughs: {cough_count}")
print(f"Non-coughs (claps, talking, etc.): {non_cough_count}")
print()
print("Recommendation:")
if non_cough_count < 30:
    print("⚠️  Collect at least 30 non-cough samples (especially claps!)")
if cough_count < 30:
    print("⚠️  Collect at least 30 cough samples")
if non_cough_count >= 30 and cough_count >= 30:
    print("✅ Good amount of data! Ready to retrain.")
print()
print("Next: cd audio_analyzer && python train.py --stage detection --epochs 50")
