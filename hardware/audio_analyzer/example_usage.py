"""
Example usage of the cough detection system
"""
import numpy as np
import librosa
from pathlib import Path

from models import CoughDetectionModel, CoughClassificationModel, CoughDetectionPipeline
from feature_extraction import MFCCExtractor
from config import audio_config


def example_single_file_prediction():
    """Example: Predict on a single audio file"""
    print("=" * 70)
    print("Example 1: Single File Prediction")
    print("=" * 70)

    # Load models
    print("\n[1] Loading models...")
    pipeline = CoughDetectionPipeline.load(
        detection_path="hardware/AI/models/detection_model_best.h5",
        classification_path="hardware/AI/models/classification_model_best.h5"
    )
    print("✓ Models loaded")

    # Load audio file
    print("\n[2] Loading audio file...")
    audio_file = "test_cough.wav"  # Replace with your file

    if not Path(audio_file).exists():
        print(f"⚠️  File not found: {audio_file}")
        print("   Please provide a valid WAV file path")
        return

    audio, sr = librosa.load(audio_file, sr=audio_config.sample_rate, mono=True)
    print(f"✓ Loaded {len(audio)/sr:.2f}s of audio at {sr}Hz")

    # Extract features
    print("\n[3] Extracting MFCC features...")
    extractor = MFCCExtractor()
    features = extractor.extract_normalized(audio, sr=sr)
    print(f"✓ Features shape: {features.shape}")

    # Predict
    print("\n[4] Running neural network prediction...")
    result = pipeline.predict(features)

    # Display results
    print("\n" + "=" * 70)
    print("PREDICTION RESULTS")
    print("=" * 70)
    print(f"Is Cough: {result['is_cough']}")
    print(f"Detection Confidence: {result['detection_confidence']:.2%}")

    if result['is_cough']:
        print(f"\nCough Type: {result['cough_type']}")
        print(f"Classification Confidence: {result['classification_confidence']:.2%}")
    print("=" * 70)


def example_batch_prediction():
    """Example: Predict on multiple audio files"""
    print("\n\n" + "=" * 70)
    print("Example 2: Batch Prediction")
    print("=" * 70)

    # Load models
    pipeline = CoughDetectionPipeline.load(
        detection_path="hardware/AI/models/detection_model_best.h5",
        classification_path="hardware/AI/models/classification_model_best.h5"
    )

    # Get list of files
    audio_dir = Path("test_audio")  # Replace with your directory
    audio_files = list(audio_dir.glob("*.wav"))

    if len(audio_files) == 0:
        print(f"⚠️  No WAV files found in {audio_dir}")
        return

    print(f"\nProcessing {len(audio_files)} files...\n")

    extractor = MFCCExtractor()
    results = []

    for i, audio_file in enumerate(audio_files, 1):
        print(f"[{i}/{len(audio_files)}] {audio_file.name}...", end=" ")

        # Load and extract features
        audio, sr = librosa.load(audio_file, sr=audio_config.sample_rate, mono=True)
        features = extractor.extract_normalized(audio, sr=sr)

        # Predict
        result = pipeline.predict(features)
        result['filename'] = audio_file.name
        results.append(result)

        # Print result
        if result['is_cough']:
            print(f"✓ COUGH ({result['cough_type']}, {result['classification_confidence']:.0%})")
        else:
            print(f"✗ No cough ({result['detection_confidence']:.0%})")

    # Summary
    num_coughs = sum(1 for r in results if r['is_cough'])
    print(f"\nSummary: {num_coughs}/{len(results)} files contained coughs")


def example_custom_threshold():
    """Example: Using custom detection threshold"""
    print("\n\n" + "=" * 70)
    print("Example 3: Custom Detection Threshold")
    print("=" * 70)

    # Load models
    pipeline = CoughDetectionPipeline.load(
        detection_path="hardware/AI/models/detection_model_best.h5",
        classification_path="hardware/AI/models/classification_model_best.h5"
    )

    # Adjust detection threshold
    print("\nAdjusting detection threshold...")
    print(f"Original threshold: {pipeline.detection_model.config.confidence_threshold}")

    # More sensitive (lower threshold = more detections, more false positives)
    pipeline.detection_model.config.confidence_threshold = 0.5
    print(f"New threshold: {pipeline.detection_model.config.confidence_threshold}")
    print("Effect: More sensitive, catches more coughs but may have false positives")


def example_feature_visualization():
    """Example: Visualize MFCC features"""
    print("\n\n" + "=" * 70)
    print("Example 4: Feature Visualization")
    print("=" * 70)

    import matplotlib.pyplot as plt

    # Generate test signal
    print("\n[1] Generating test cough signal...")
    sr = audio_config.sample_rate
    duration = 1.5

    # Simulate cough (sharp attack + exponential decay)
    t = np.linspace(0, duration, int(sr * duration))
    attack = np.random.randn(int(0.2 * sr)) * np.linspace(0, 1, int(0.2 * sr))
    decay = np.random.randn(int(1.3 * sr)) * np.exp(-np.linspace(0, 5, int(1.3 * sr)))
    audio = np.concatenate([attack, decay])

    # Extract features
    print("[2] Extracting MFCC features...")
    extractor = MFCCExtractor()
    features = extractor.extract_normalized(audio, sr=sr)

    # Plot
    print("[3] Plotting...")
    fig, axes = plt.subplots(2, 1, figsize=(12, 8))

    # Plot audio waveform
    axes[0].plot(t, audio)
    axes[0].set_title("Simulated Cough Waveform")
    axes[0].set_xlabel("Time (s)")
    axes[0].set_ylabel("Amplitude")
    axes[0].grid(True)

    # Plot MFCC features
    im = axes[1].imshow(features, aspect='auto', origin='lower', cmap='viridis')
    axes[1].set_title("MFCC Features (39 features × time)")
    axes[1].set_xlabel("Time Frames")
    axes[1].set_ylabel("MFCC Coefficient")
    plt.colorbar(im, ax=axes[1])

    plt.tight_layout()
    plt.savefig("mfcc_visualization.png", dpi=150)
    print("✓ Saved to mfcc_visualization.png")
    plt.show()


def main():
    """Run all examples"""
    print("\n" + "=" * 70)
    print("COUGH DETECTION SYSTEM - EXAMPLE USAGE")
    print("=" * 70)

    try:
        example_single_file_prediction()
    except Exception as e:
        print(f"\n⚠️  Example 1 failed: {e}")

    try:
        example_batch_prediction()
    except Exception as e:
        print(f"\n⚠️  Example 2 failed: {e}")

    try:
        example_custom_threshold()
    except Exception as e:
        print(f"\n⚠️  Example 3 failed: {e}")

    try:
        example_feature_visualization()
    except Exception as e:
        print(f"\n⚠️  Example 4 failed: {e}")

    print("\n" + "=" * 70)
    print("Examples complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
