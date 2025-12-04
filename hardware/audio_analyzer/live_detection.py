"""
Live cough detection using neural networks.

This replaces the RMS-based detection with a two-stage neural network approach:
1. Detection network detects if there's a cough
2. Classification network identifies what type of cough

Much more accurate than simple RMS thresholding!
"""
import sounddevice as sd
from dataclasses import dataclass
import numpy as np
import math
from collections import deque
import pandas as pd
import time
import os
import threading
import queue
from pynput import keyboard
import tensorflow as tf
from pathlib import Path

from config import audio_config
from feature_extraction import MFCCExtractor
from models import CoughDetectionPipeline


@dataclass
class DetectionConfig:
    """Configuration for live detection."""
    sample_rate: int = 8000
    channels: int = 1
    dtype: str = 'float32'
    block_size: int = 2048

    # Buffer settings
    buffer_duration: float = 10.0  # seconds - total buffer
    detection_window: float = 1.5  # seconds - window for neural network
    hop_length: float = 0.5  # seconds - how often to run detection

    # Pre-filter settings (optional energy threshold before running NN)
    use_energy_prefilter: bool = True
    energy_threshold: float = 0.01  # Minimum RMS to consider

    # Model paths
    detection_model_path: str = "hardware/AI/models/detection_model_best.h5"
    classification_model_path: str = "hardware/AI/models/classification_model_best.h5"

    # Detection threshold
    detection_confidence: float = 0.7  # Probability threshold

    # Output settings
    save_detections: bool = True
    save_dir: str = "hardware/AI/detections"


class LiveCoughDetector:
    """
    Live cough detection using neural networks.

    Replaces RMS-based detection with intelligent neural network classification.
    """

    def __init__(self, config: DetectionConfig = DetectionConfig()):
        self.config = config

        # Audio buffer
        total_samples = int(config.sample_rate * config.buffer_duration)
        deque_maxlen_blocks = math.ceil(total_samples / config.block_size)
        self.display_buffer = deque(maxlen=deque_maxlen_blocks)
        self.buffer_lock = threading.Lock()

        # Feature extractor
        self.extractor = MFCCExtractor()

        # Load models
        print("Loading neural network models...")
        self._load_models()

        # Save queue
        self.save_queue = queue.Queue()
        self.save_worker_thread = None

        # Statistics
        self.total_windows_processed = 0
        self.total_coughs_detected = 0
        self.last_detection_time = 0

        # Audio stream
        self.stream = None
        self.is_running = False

        # Detection thread
        self.detection_thread = None

        os.makedirs(config.save_dir, exist_ok=True)

    def _load_models(self):
        """Load pre-trained models."""
        try:
            self.pipeline = CoughDetectionPipeline.load(
                self.config.detection_model_path,
                self.config.classification_model_path
            )
            print("✓ Models loaded successfully!")

        except Exception as e:
            print(f"ERROR: Could not load models: {e}")
            print("\nMake sure you have trained the models first using train.py")
            print("Expected paths:")
            print(f"  - {self.config.detection_model_path}")
            print(f"  - {self.config.classification_model_path}")
            raise

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status):
        """Audio callback - must be FAST."""
        if status:
            print(f"Audio callback status: {status}")

        with self.buffer_lock:
            self.display_buffer.append(indata.flatten())

    def _energy_prefilter(self, audio: np.ndarray) -> bool:
        """
        Quick energy check before running neural network.

        Returns True if audio has enough energy to potentially be a cough.
        This is much faster than running the full neural network.
        """
        if not self.config.use_energy_prefilter:
            return True

        rms = np.sqrt(np.mean(audio ** 2))
        return rms >= self.config.energy_threshold

    def _detection_loop(self):
        """
        Continuous detection loop.

        Runs in separate thread, periodically checks buffer for coughs.
        """
        detection_samples = int(self.config.detection_window * self.config.sample_rate)
        hop_samples = int(self.config.hop_length * self.config.sample_rate)
        hop_blocks = max(1, int(hop_samples / self.config.block_size))

        blocks_waited = 0

        print("\n" + "=" * 70)
        print("NEURAL NETWORK DETECTION ACTIVE")
        print("=" * 70)
        print(f"Detection window: {self.config.detection_window}s")
        print(f"Hop length: {self.config.hop_length}s")
        print(f"Energy pre-filter: {'ON' if self.config.use_energy_prefilter else 'OFF'}")
        print("=" * 70 + "\n")

        while self.is_running:
            # Wait for hop duration
            if blocks_waited < hop_blocks:
                time.sleep(0.1)
                blocks_waited += 1
                continue

            blocks_waited = 0

            # Get current buffer
            with self.buffer_lock:
                if len(self.display_buffer) < 1:
                    continue
                buffer_copy = list(self.display_buffer)

            # Concatenate buffer
            full_buffer = np.concatenate(buffer_copy)

            # Get detection window
            if len(full_buffer) < detection_samples:
                continue

            window = full_buffer[-detection_samples:]

            # Update statistics
            self.total_windows_processed += 1

            # Energy pre-filter (optional fast check)
            if not self._energy_prefilter(window):
                print(".", end="", flush=True)  # Indicate processing
                continue

            # Extract MFCC features
            try:
                features = self.extractor.extract_normalized(
                    window,
                    sr=self.config.sample_rate
                )

                # Run neural network pipeline
                result = self.pipeline.predict(features)

                # Check if cough detected
                if result['is_cough']:
                    self.total_coughs_detected += 1
                    self.last_detection_time = time.time()

                    print("\n" + "=" * 70)
                    print(f"🎯 COUGH DETECTED! (#{self.total_coughs_detected})")
                    print("=" * 70)
                    print(f"Detection confidence: {result['detection_confidence']:.2%}")
                    print(f"Cough type: {result['cough_type']}")
                    print(f"Classification confidence: {result['classification_confidence']:.2%}")
                    print(f"Time: {time.strftime('%H:%M:%S')}")
                    print("=" * 70 + "\n")

                    # Save detection
                    if self.config.save_detections:
                        self.save_queue.put({
                            'audio': window,
                            'features': features,
                            'result': result,
                            'timestamp': time.time()
                        })

                else:
                    # No cough detected
                    print(".", end="", flush=True)

            except Exception as e:
                print(f"\nError in detection: {e}")
                continue

    def _save_worker(self):
        """Worker thread to save detections."""
        print("Save worker thread started.")

        while True:
            try:
                item = self.save_queue.get()

                if item is None:  # Stop signal
                    break

                # Create filename
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                cough_type = item['result']['cough_type']
                confidence = item['result']['classification_confidence']

                filename = f"{timestamp}_{cough_type}_conf{confidence:.2f}.csv"
                filepath = os.path.join(self.config.save_dir, filename)

                # Save audio
                df = pd.DataFrame(item['audio'])
                df.to_csv(filepath, header=False, index=False)

                print(f"💾 Saved: {filename}")

                self.save_queue.task_done()

            except Exception as e:
                print(f"Save worker error: {e}")

        print("Save worker thread stopping.")

    def start(self):
        """Start live detection."""
        print("Starting live cough detection...")

        # Start save worker
        self.save_worker_thread = threading.Thread(target=self._save_worker, daemon=False)
        self.save_worker_thread.start()

        # Start audio stream
        try:
            self.stream = sd.InputStream(
                samplerate=self.config.sample_rate,
                channels=self.config.channels,
                callback=self._audio_callback,
                blocksize=self.config.block_size,
                dtype=self.config.dtype
            )

            self.stream.start()
            print("✓ Audio stream started")

        except Exception as e:
            print(f"Error starting audio stream: {e}")
            raise

        # Start detection thread
        self.is_running = True
        self.detection_thread = threading.Thread(target=self._detection_loop, daemon=False)
        self.detection_thread.start()
        print("✓ Detection thread started")

        print("\n🎤 Listening for coughs... (Press Ctrl+C to stop)\n")

    def stop(self):
        """Stop detection."""
        print("\n\nStopping detection...")

        # Stop detection thread
        self.is_running = False
        if self.detection_thread:
            self.detection_thread.join(timeout=2)

        # Stop audio stream
        if self.stream:
            self.stream.stop()
            self.stream.close()

        # Stop save worker
        self.save_queue.put(None)
        if self.save_worker_thread:
            self.save_worker_thread.join(timeout=2)

        # Print statistics
        print("\n" + "=" * 70)
        print("SESSION STATISTICS")
        print("=" * 70)
        print(f"Total windows processed: {self.total_windows_processed}")
        print(f"Total coughs detected: {self.total_coughs_detected}")
        if self.total_windows_processed > 0:
            detection_rate = self.total_coughs_detected / self.total_windows_processed
            print(f"Detection rate: {detection_rate:.2%}")
        print("=" * 70)

    def run_interactive(self):
        """Run detection with keyboard controls."""
        self.start()

        try:
            while True:
                time.sleep(0.1)

        except KeyboardInterrupt:
            print("\n\nCtrl+C pressed")

        finally:
            self.stop()


def main():
    """Main function for live detection."""
    import argparse

    parser = argparse.ArgumentParser(description='Live cough detection')
    parser.add_argument('--detection_model', type=str,
                        default='hardware/AI/models/detection_model_best.h5',
                        help='Path to detection model')
    parser.add_argument('--classification_model', type=str,
                        default='hardware/AI/models/classification_model_best.h5',
                        help='Path to classification model')
    parser.add_argument('--confidence', type=float, default=0.7,
                        help='Detection confidence threshold')
    parser.add_argument('--no_prefilter', action='store_true',
                        help='Disable energy pre-filter')
    parser.add_argument('--no_save', action='store_true',
                        help='Disable saving detections')

    args = parser.parse_args()

    # Create config
    config = DetectionConfig(
        detection_model_path=args.detection_model,
        classification_model_path=args.classification_model,
        detection_confidence=args.confidence,
        use_energy_prefilter=not args.no_prefilter,
        save_detections=not args.no_save
    )

    # Create detector
    detector = LiveCoughDetector(config)

    # Run
    detector.run_interactive()


if __name__ == "__main__":
    main()
