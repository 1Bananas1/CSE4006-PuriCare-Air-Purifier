import sounddevice as sd
from dataclasses import dataclass
import matplotlib.pyplot as plt
from collections import deque
import numpy as np
import math
from scipy import signal
import pandas as pd
import time
import os
import threading
import queue
from enum import Enum

@dataclass
class AudioConfig:
    sample_rate: int = 8000
    channels: int = 1
    dtype: str = 'float32'
    block_size: int = 800 #100ms at 8kHz

    vad_window_ms: int = 100
    event_window_s: float = 2.0 # 2 seconds for each event
    analsysis_window_s: float = 0.64 # 640ms for NN

    vad_energy_multiplier: float = 1.7  # From Neural Cough Counter paper
    vad_zcr_min: float = 0.02  # Zero-crossing rate minimum
    vad_zcr_max: float = 0.5   # Zero-crossing rate maximum
    
    segment_classifier_threshold: float = 0.3  # Probability threshold
    
    # Save settings
    save_full_window: bool = True  # Save full 2s for speaker ID
    save_analysis_window: bool = True  # Save 640ms for classification

class EventType(Enum):
    SILENCE = 0
    SPEECH = 1
    NOISE = 2
    RESPIRATORY_EVENT = 3

class MultiStageVAD:
    """
    Multi-stage Voice Activity Detection with energy + zero-crossing rate.
    Based on Neural Cough Counter paper approach.
    """
    def __init__(self, config: AudioConfig):
        self.config = config
        self.sample_rate = config.sample_rate

        #adaptive
        self.calibration_samples = []
        self.is_calibrated = False
        self.calibration_window = 5  # seconds
        self.energy_threshold = None

        #highpass filter
        self.b, self.a = signal.butter(4, 100, 'hp', fs=self.sample_rate)

    def calibrate(self, audio_chunk):
        """Calibrate threshold based on ambient noise."""
        if len(self.calibration_samples) < self.calibration_window * (self.sample_rate / self.config.block_size):
            self.calibration_samples.append(audio_chunk)
            return False
        if not self.is_calibrated:
            baseline_audio = np.concatenate(self.calibration_samples)
            baseline_rms = np.sqrt(np.mean(baseline_audio**2))
            self.energy_threshold = baseline_rms * self.config.vad_energy_multiplier
            self.is_calibrated = True
            print(f"✓ VAD Calibrated. Energy threshold: {self.energy_threshold:.4f}")
        return True
    
    def calculate_features(self, audio_chunk):
        """Calculate energy and zero-crossing rate."""
        # Apply high-pass filter
        filtered = signal.lfilter(self.b, self.a, audio_chunk)
        
        # Energy (RMS)
        energy = np.sqrt(np.mean(filtered**2))
        
        # Zero-crossing rate
        zcr = np.sum(np.abs(np.diff(np.sign(filtered)))) / (2 * len(filtered))
        
        return energy, zcr
    
    def check_activity(self, audio_chunk):
        """
        Check if audio chunk contains activity.
        Returns: (is_active, event_type, confidence)
        """
        if not self.is_calibrated:
            return False, EventType.SILENCE, 0.0
        
        energy, zcr = self.calculate_features(audio_chunk)
        
        # Stage 1: Energy check
        if energy < self.energy_threshold:
            return False, EventType.SILENCE, 0.0
        
        # Stage 2: Zero-crossing rate check
        if zcr < self.config.vad_zcr_min:
            # Very low ZCR = likely low-frequency noise
            return False, EventType.NOISE, 0.2
        
        if zcr > self.config.vad_zcr_max:
            # Very high ZCR = likely speech
            return True, EventType.SPEECH, 0.6
        
        # Medium ZCR + high energy = potential respiratory event
        confidence = min(energy / self.energy_threshold, 1.0)
        return True, EventType.RESPIRATORY_EVENT, confidence
    
class LightweightSegmentClassifier:
    """
    Lightweight classifier to filter out obvious non-respiratory sounds.
    Uses hand-crafted features (fast, no ML needed for Stage 1).
    """
    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        
    def extract_features(self, audio_chunk):
        """Extract simple spectral features."""
        # Calculate FFT
        fft = np.fft.rfft(audio_chunk)
        magnitude = np.abs(fft)
        freqs = np.fft.rfftfreq(len(audio_chunk), 1/self.sample_rate)
        
        # Feature 1: Spectral centroid (center of mass of spectrum)
        spectral_centroid = np.sum(freqs * magnitude) / np.sum(magnitude)
        
        # Feature 2: Spectral rolloff (frequency below which 85% of energy)
        cumsum = np.cumsum(magnitude)
        rolloff_idx = np.where(cumsum >= 0.85 * cumsum[-1])[0][0]
        spectral_rolloff = freqs[rolloff_idx]
        
        # Feature 3: Energy concentration in low freqs (0-500 Hz)
        # Coughs have strong low-frequency components
        low_freq_mask = freqs < 500
        low_freq_energy = np.sum(magnitude[low_freq_mask]) / np.sum(magnitude)
        
        # Feature 4: Peak energy location
        peak_freq = freqs[np.argmax(magnitude)]
        
        return {
            'spectral_centroid': spectral_centroid,
            'spectral_rolloff': spectral_rolloff,
            'low_freq_energy': low_freq_energy,
            'peak_freq': peak_freq
        }
    
    def classify(self, audio_chunk):
        """
        Simple rule-based classifier for respiratory events.
        Returns probability that this is a respiratory event.
        """
        features = self.extract_features(audio_chunk)
        
        score = 0.0
        
        # Rule 1: Low-frequency energy (coughs are bass-heavy)
        if features['low_freq_energy'] > 0.4:
            score += 0.3
        
        # Rule 2: Spectral centroid in mid-range (not too high like speech)
        if 200 < features['spectral_centroid'] < 800:
            score += 0.3
        
        # Rule 3: Peak frequency in low range
        if 100 < features['peak_freq'] < 600:
            score += 0.2
        
        # Rule 4: Spectral rolloff not too high
        if features['spectral_rolloff'] < 2000:
            score += 0.2
        
        return score
    
class RespiratoryEventDetector:
    """
    Main detector class that coordinates all stages.
    """
    def __init__(self, config: AudioConfig):
        self.config = config
        self.sample_rate = config.sample_rate
        
        # Initialize stages
        self.vad = MultiStageVAD(config)
        self.segment_classifier = LightweightSegmentClassifier(config.sample_rate)
        
        # Buffers
        event_buffer_samples = int(config.event_window_s * config.sample_rate)
        event_buffer_blocks = math.ceil(event_buffer_samples / config.block_size)
        self.event_buffer = deque(maxlen=event_buffer_blocks)
        
        # State tracking
        self.event_cooldown = 0  # Prevent duplicate detections
        self.cooldown_blocks = int(1.0 * config.sample_rate / config.block_size)  # 1 second
        
        # Statistics
        self.stats = {
            'blocks_processed': 0,
            'vad_triggered': 0,
            'classifier_triggered': 0,
            'events_saved': 0
        }
        
    def process_block(self, audio_block):
        """
        Process a single audio block through all stages.
        Returns: (should_save, event_data, metadata)
        """
        self.stats['blocks_processed'] += 1
        self.event_buffer.append(audio_block)
        
        # Cooldown check
        if self.event_cooldown > 0:
            self.event_cooldown -= 1
            return False, None, None
        
        # Stage 1: VAD calibration
        if not self.vad.is_calibrated:
            self.vad.calibrate(audio_block)
            return False, None, None
        
        # Stage 2: VAD check
        is_active, event_type, vad_confidence = self.vad.check_activity(audio_block)
        
        if not is_active:
            return False, None, None
        
        self.stats['vad_triggered'] += 1
        
        # Stage 3: Quick filter for obvious non-events
        if event_type == EventType.SPEECH:
            print(f"  → Speech detected (skipping), ZCR high", end='\r')
            return False, None, None
        
        if event_type == EventType.NOISE:
            print(f"  → Noise detected (skipping), ZCR low", end='\r')
            return False, None, None
        
        # Stage 4: Segment classifier (for RESPIRATORY_EVENT)
        full_event_buffer = np.concatenate(list(self.event_buffer))
        classifier_score = self.segment_classifier.classify(full_event_buffer)
        
        if classifier_score < self.config.segment_classifier_threshold:
            print(f"  → Rejected by classifier (score: {classifier_score:.2f})", end='\r')
            return False, None, None
        
        self.stats['classifier_triggered'] += 1
        
        # Event detected! Prepare for saving
        print(f"\n>>> EVENT DETECTED! VAD: {vad_confidence:.2f}, Classifier: {classifier_score:.2f} <<<")
        
        metadata = {
            'timestamp': time.time(),
            'vad_confidence': vad_confidence,
            'classifier_score': classifier_score,
            'event_type': event_type.name,
            'buffer_length_s': len(full_event_buffer) / self.sample_rate
        }
        
        # Set cooldown
        self.event_cooldown = self.cooldown_blocks
        self.stats['events_saved'] += 1
        
        return True, full_event_buffer, metadata
    
    def print_stats(self):
        """Print detection statistics."""
        if self.stats['blocks_processed'] > 0:
            vad_rate = 100 * self.stats['vad_triggered'] / self.stats['blocks_processed']
            classifier_rate = 100 * self.stats['classifier_triggered'] / self.stats['blocks_processed']
            
            print("\n" + "="*60)
            print("DETECTION STATISTICS")
            print("="*60)
            print(f"Blocks processed:     {self.stats['blocks_processed']}")
            print(f"VAD triggered:        {self.stats['vad_triggered']} ({vad_rate:.2f}%)")
            print(f"Classifier triggered: {self.stats['classifier_triggered']} ({classifier_rate:.2f}%)")
            print(f"Events saved:         {self.stats['events_saved']}")
            print("="*60)


#main

config = AudioConfig()
detector = RespiratoryEventDetector(config)
save_queue = queue.Queue()
buffer_lock = threading.Lock()

SAVE_DIR = os.path.join("hardware", "AI", "data", "events")
METADATA_CSV = os.path.join(SAVE_DIR, "event_metadata.csv")


def save_worker():
    """Worker thread for async file saving."""
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    # Initialize metadata CSV
    if not os.path.exists(METADATA_CSV):
        metadata_df = pd.DataFrame(columns=[
            'filename', 'timestamp', 'event_type', 'vad_confidence', 
            'classifier_score', 'buffer_length_s', 'label'
        ])
        metadata_df.to_csv(METADATA_CSV, index=False)
    
    print("Save worker started.")
    
    while True:
        try:
            item = save_queue.get()
            if item is None:
                break
            
            audio_data, metadata = item
            
            # Generate filename
            timestamp_str = time.strftime("%Y%m%d_%H%M%S", time.localtime(metadata['timestamp']))
            filename = f"event_{timestamp_str}.csv"
            filepath = os.path.join(SAVE_DIR, filename)
            
            # Save audio
            df = pd.DataFrame(audio_data)
            df.to_csv(filepath, header=False, index=False)
            
            # Update metadata CSV
            metadata_entry = pd.DataFrame([{
                'filename': filename,
                'timestamp': metadata['timestamp'],
                'event_type': metadata['event_type'],
                'vad_confidence': metadata['vad_confidence'],
                'classifier_score': metadata['classifier_score'],
                'buffer_length_s': metadata['buffer_length_s'],
                'label': 'UNLABELED'  # For manual labeling later
            }])
            
            metadata_df = pd.read_csv(METADATA_CSV)
            metadata_df = pd.concat([metadata_df, metadata_entry], ignore_index=True)
            metadata_df.to_csv(METADATA_CSV, index=False)
            
            print(f"✓ Saved: {filename}")
            
            save_queue.task_done()
            
        except Exception as e:
            print(f"Save worker error: {e}")
            save_queue.task_done()
    
    print("Save worker stopped.")


def audio_callback(indata: np.ndarray, frames: int, time_info, status):
    """Fast audio callback - just pass to detector."""
    if status:
        print(status)
    
    audio_block = indata.flatten()
    
    with buffer_lock:
        should_save, event_data, metadata = detector.process_block(audio_block)
    
    if should_save:
        save_queue.put((event_data, metadata))


if __name__ == "__main__":
    worker_thread = None
    
    try:
        print("="*60)
        print("RESPIRATORY EVENT DETECTOR")
        print("="*60)
        print(f"Sample rate: {config.sample_rate} Hz")
        print(f"Block size: {config.block_size} samples ({config.block_size/config.sample_rate*1000:.0f}ms)")
        print(f"Event window: {config.event_window_s}s")
        print(f"Save directory: {SAVE_DIR}")
        print("="*60)
        
        # Start save worker
        print("\nStarting save worker thread...")
        worker_thread = threading.Thread(target=save_worker, daemon=False)
        worker_thread.start()
        
        print("Calibrating VAD (5 seconds of ambient noise)...")
        print("Please remain quiet...")
        
        # Start audio stream
        print("\nStarting audio stream...")
        print("Press Ctrl+C to stop.\n")
        
        with sd.InputStream(
            samplerate=config.sample_rate,
            channels=config.channels,
            callback=audio_callback,
            blocksize=config.block_size,
            dtype=config.dtype
        ):
            while True:
                time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\nStopping... (Ctrl+C pressed)")
    
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        print("\nShutting down...")
        
        # Stop save worker
        if worker_thread and worker_thread.is_alive():
            print("Stopping save worker...")
            save_queue.put(None)
            worker_thread.join(timeout=5)
        
        # Print statistics
        detector.print_stats()
        
        print("\nProgram exited.")