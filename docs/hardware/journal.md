# Cough and Sneeze Detection

Owner: Jimmy

# Journal

### Day 1:

Analysis

Mainly going to take notes from:

https://pmc.ncbi.nlm.nih.gov/articles/PMC8545201/#sec4

Framework

### Cough/Sneeze/Snore Detection

| Method                      | Measurements                             | Notes                                  | Pick |
| --------------------------- | ---------------------------------------- | -------------------------------------- | ---- |
| ResNet 50 + CNN-LSTM Hybrid | 98.8% AUC on accelerometer, 99% on audio | Accurate but computationally expensive |      |
| Lightweight CNN + XGBoost   | 97% accuracy, runs on ARM Cortex-M33     | Most practical pick                    | X    |
| Cough E multimodal approach | 78% F1, 70% energy savings               | Best Energy Saving                     |      |

## Feature Extraction

### Log Mel Spectrogram vs MFCC

A Log Mel Spectrogram is a visual representation of an audio signal's spectrum of frequencies as they vary over time. It's designed to mimic human hearing, which is more sensitive to changes in lower frequencies than higher ones.

Mel-Frequency Cepstral Coefficients (MFCCs) are derived from the Log Mel Spectrogram and represent a more compact and decorrelated set of features. They are widely used in machine learning models for tasks like speech recognition, speaker identification, and music genre classification.

In essence, a **Log Mel Spectrogram** is an intermediate step in the calculation of **MFCCs**. While you can use the Log Mel Spectrogram directly as a feature for machine learning models, MFCCs provide a compressed and decorrelated representation that has historically been very effective, particularly in speech recognition.

### Why use Log Mel Spectrogram over MFCC

As MFCC derives from the Mel Spectrogram, it uses more computational power as the data goes through a process of Discrete Cosine Transform. CNNs are excellent at finding patterns in image-like data, and a spectrogram is essentially an image of sound. They can effectively process the correlated data in a spectrogram. MFCCs were more critical for older models (like Gaussian Mixture Models) that performed better with the less-correlated data that the DCT step produces.

### 8kHz vs 16kHz

While it is quite obvious that it is faster to compute 8kHz rather than 16kHz, it is also more accurate to do so. The Mel scale is designed to mimic human hearing, which is much more sensitive to changes in low frequencies. When you create a Mel filterbank (e.g., with 40 bands), you distribute those bands across the entire frequency range of your signal. For an 8kHz sample, the maximum frequency is 4,000 Hz. All 40 of your bands are packed into this `0 - 4,000 Hz` range, giving you very high-resolution detail in these lower frequencies. For a 16kH**z** sample, the maximum frequency is 8,000 Hz. Those same 40 bands are now spread thin across a `0 - 8,000 Hz` range. This means you have _fewer_ bands and _coarser_ detail in the critical low-frequency area.
For sounds like coughs, snores, and most of human speech, the most important distinguishing information is located in the lower frequencies (<4,000 Hz). Therefore, using an 8kHz sampling rate intelligently focuses your model's attention where it matters most, leading to better performance with less work.

### Day 5:

Finally had time to get some work done. made something somewhat related to above thoughts, granted a majority of it was generated code. would like to do it all by myself tomorrow

```
import numpy as np
import sounddevice as sd
import librosa
import threading
from collections import deque
from dataclasses import dataclass
import time
import queue
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import matplotlib

matplotlib.use('TkAgg')

@dataclass
class AudioConfig:
    sample_rate: int = 8000
    channels: int = 1

    # Spectrogram parameters
    n_fft: int = 512
    hop_length: int = 256
    n_mels: int = 40

    # Buffer management
    buffer_duration: float = 15.0
    segment_duration: float = 1.0

    # Audio streaming - larger chunks reduce overflow
    blocksize: int = 2048  # Increased from default

class AudioSpectrogramRecorder:
    def __init__(self, config: AudioConfig = AudioConfig(), simulation_mode=False):
        self.config = config
        self.simulation_mode = simulation_mode

        # Calculate buffer sizes
        self.max_buffer_samples = int(config.sample_rate * config.buffer_duration)
        self.segment_samples = int(config.sample_rate * config.segment_duration)

        # Rolling buffer for audio samples
        self.audio_buffer = deque(maxlen=self.max_buffer_samples)

        # Thread control
        self.is_recording = False
        self.lock = threading.Lock()
        self.stream = None

        # Visualization
        self.fig = None
        self.ax = None
        self.im = None
        self.is_visualizing = False

        # Overflow tracking
        self.overflow_count = 0

        if not simulation_mode:
            try:
                self.audio_queue = queue.Queue(maxsize=50)  # Limit queue size
            except Exception as e:
                print(f"Error initializing: {e}")
                self.simulation_mode = True

    def _audio_callback(self, indata, frames, time_info, status):
        """Callback function for audio stream - must be FAST"""
        if status:
            if 'input overflow' in str(status).lower():
                self.overflow_count += 1
                if self.overflow_count % 10 == 1:  # Print every 10th overflow
                    print(f"Input overflow detected ({self.overflow_count} total)")

        # Don't process here - just queue it
        try:
            self.audio_queue.put_nowait(indata.copy())
        except queue.Full:
            # If queue is full, drop this chunk
            pass

    def _process_audio_queue(self):
        """Process audio data from queue - can be slower"""
        while self.is_recording:
            try:
                audio_data = self.audio_queue.get(timeout=0.1)

                if audio_data.ndim > 1:
                    audio_data = audio_data.flatten()

                with self.lock:
                    self.audio_buffer.extend(audio_data)

            except queue.Empty:
                continue

    def start_recording(self):
        """Start recording audio"""
        if self.simulation_mode:
            print("In simulation mode - use load_audio_file() or simulate_live_audio() instead")
            return

        if self.is_recording:
            print("Already recording!")
            return

        try:
            print("Available audio devices:")
            devices = sd.query_devices()
            print(devices)

            default_input = sd.query_devices(kind='input')
            if default_input is None:
                print("\nNo audio input devices found!")
                print("Switching to simulation mode...")
                self.simulation_mode = True
                return

            self.is_recording = True
            self.overflow_count = 0

            # Start processing thread
            self.process_thread = threading.Thread(target=self._process_audio_queue, daemon=True)
            self.process_thread.start()

            # Start audio stream with larger blocksize and latency
            self.stream = sd.InputStream(
                samplerate=self.config.sample_rate,
                channels=self.config.channels,
                callback=self._audio_callback,
                dtype=np.float32,
                blocksize=self.config.blocksize,
                latency='high'  # Higher latency = more stable
            )

            self.stream.start()
            print(f"Recording started at {self.config.sample_rate}Hz (blocksize={self.config.blocksize})")

        except Exception as e:
            print(f"Error starting recording: {e}")
            print("Switching to simulation mode...")
            self.simulation_mode = True
            self.is_recording = False

    def load_audio_file(self, audio_file_path):
        """Load audio from file (for testing/development)"""
        print(f"Loading audio from {audio_file_path}...")
        audio_data, sr = librosa.load(audio_file_path, sr=self.config.sample_rate, mono=True)

        with self.lock:
            self.audio_buffer.clear()
            self.audio_buffer.extend(audio_data)

        print(f"Loaded {len(audio_data)/sr:.2f}s of audio")
        return len(audio_data)/sr

    def simulate_live_audio(self, audio_file_path, chunk_duration=0.1):
        """Simulate live audio streaming from a file"""
        print(f"Simulating live audio from {audio_file_path}...")
        audio_data, sr = librosa.load(audio_file_path, sr=self.config.sample_rate, mono=True)

        chunk_size = int(self.config.sample_rate * chunk_duration)
        self.is_recording = True

        def stream_audio():
            idx = 0
            while self.is_recording and idx < len(audio_data):
                chunk = audio_data[idx:idx + chunk_size]
                with self.lock:
                    self.audio_buffer.extend(chunk)
                idx += chunk_size
                time.sleep(chunk_duration)

            print("Finished streaming audio file")
            self.is_recording = False

        stream_thread = threading.Thread(target=stream_audio, daemon=True)
        stream_thread.start()
        return stream_thread

    def generate_test_tone(self, frequency=440, duration=1.0):
        """Generate a test tone (useful for testing pipeline)"""
        t = np.linspace(0, duration, int(self.config.sample_rate * duration))
        tone = 0.5 * np.sin(2 * np.pi * frequency * t)

        with self.lock:
            self.audio_buffer.extend(tone)

        print(f"Generated {duration}s test tone at {frequency}Hz")

    def get_current_segment(self, duration: float = None):
        """Get the most recent audio segment"""
        if duration is None:
            duration = self.config.segment_duration

        n_samples = int(self.config.sample_rate * duration)

        with self.lock:
            if len(self.audio_buffer) < n_samples:
                return None
            segment = np.array(list(self.audio_buffer)[-n_samples:])

        return segment

    def audio_to_log_mel_spectrogram(self, audio_segment):
        """Convert audio segment to log mel spectrogram"""
        if audio_segment is None or len(audio_segment) == 0:
            return None

        try:
            mel_spec = librosa.feature.melspectrogram(
                y=audio_segment,
                sr=self.config.sample_rate,
                n_fft=self.config.n_fft,
                hop_length=self.config.hop_length,
                n_mels=self.config.n_mels,
                fmax=self.config.sample_rate // 2
            )

            log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
            return log_mel_spec
        except Exception as e:
            print(f"Error computing spectrogram: {e}")
            return None

    def get_spectrogram_for_inference(self, duration: float = None):
        """Get log mel spectrogram ready for neural network input"""
        audio_segment = self.get_current_segment(duration)

        if audio_segment is None:
            return None

        return self.audio_to_log_mel_spectrogram(audio_segment)

    def get_buffer_duration(self):
        """Get current buffer duration in seconds"""
        with self.lock:
            return len(self.audio_buffer) / self.config.sample_rate

    def visualize_live(self, display_duration=3.0, update_interval=200):
        """
        Display live spectrogram visualization

        Args:
            display_duration: How many seconds of audio to display
            update_interval: Update rate in milliseconds (200ms = 5 updates/sec)
        """
        self.is_visualizing = True

        # Setup the plot
        self.fig, self.ax = plt.subplots(figsize=(12, 6))
        self.fig.canvas.manager.set_window_title('Live Log Mel Spectrogram')

        # Initial empty spectrogram
        initial_spec = np.zeros((self.config.n_mels, 100))
        self.im = self.ax.imshow(
            initial_spec,
            aspect='auto',
            origin='lower',
            cmap='viridis',
            interpolation='nearest'
        )

        # Setup colorbar
        cbar = plt.colorbar(self.im, ax=self.ax)
        cbar.set_label('dB', rotation=270, labelpad=15)

        # Labels
        self.ax.set_xlabel('Time')
        self.ax.set_ylabel('Mel Frequency Bins')
        self.ax.set_title('Live Log Mel Spectrogram (8kHz, 0-4kHz)')

        # Cache for reducing computation
        self.last_update_time = time.time()
        self.cached_spec = None

        def update_plot(frame):
            """Update function for animation"""
            if not self.is_visualizing:
                return self.im,

            # Throttle updates to avoid overloading
            current_time = time.time()
            if current_time - self.last_update_time < update_interval / 1000.0 * 0.9:
                return self.im,

            self.last_update_time = current_time

            # Get spectrogram for display duration
            log_mel_spec = self.get_spectrogram_for_inference(duration=display_duration)

            if log_mel_spec is not None and log_mel_spec.shape[1] > 0:
                self.cached_spec = log_mel_spec

                # Update image data
                self.im.set_data(log_mel_spec)
                self.im.set_clim(vmin=log_mel_spec.min(), vmax=log_mel_spec.max())

                # Update x-axis to show time in seconds
                n_frames = log_mel_spec.shape[1]
                time_labels = np.linspace(0, display_duration, 5)
                frame_labels = np.linspace(0, n_frames-1, 5)
                self.ax.set_xticks(frame_labels)
                self.ax.set_xticklabels([f'{t:.1f}s' for t in time_labels])

                # Update title with buffer info
                buffer_dur = self.get_buffer_duration()
                overflow_info = f" | Overflows: {self.overflow_count}" if self.overflow_count > 0 else ""
                self.ax.set_title(
                    f'Live Log Mel Spectrogram | Buffer: {buffer_dur:.1f}s / {self.config.buffer_duration:.1f}s{overflow_info}'
                )

            return self.im,

        # Create animation with reduced blit
        anim = FuncAnimation(
            self.fig,
            update_plot,
            interval=update_interval,
            blit=False,  # Changed to False for better stability
            cache_frame_data=False
        )

        plt.tight_layout()

        # Show plot (blocks until window is closed)
        try:
            plt.show()
        except KeyboardInterrupt:
            pass
        finally:
            self.is_visualizing = False
            print("Visualization stopped")

    def stop_recording(self):
        """Stop recording and cleanup"""
        if not self.is_recording:
            return

        self.is_recording = False
        self.is_visualizing = False

        if self.stream:
            self.stream.stop()
            self.stream.close()

        # Give threads time to finish
        time.sleep(0.2)

        print("Recording stopped")
        if self.overflow_count > 0:
            print(f"Total input overflows: {self.overflow_count}")

    def cleanup(self):
        """Release audio resources"""
        self.stop_recording()
        if self.fig:
            plt.close(self.fig)


# Example usage
if __name__ == "__main__":
    print("=== Live Spectrogram Visualization ===\n")

    # Configure for better performance
    config = AudioConfig(
        blocksize=2048,  # Larger blocks = more stable
        buffer_duration=15.0
    )

    # Try real recording first
    recorder = AudioSpectrogramRecorder(config=config, simulation_mode=False)
    recorder.start_recording()

    # If no devices found, use simulation
    if recorder.simulation_mode:
        print("\n=== Running in simulation mode ===")
        recorder = AudioSpectrogramRecorder(config=config, simulation_mode=True)

        # Generate some test audio
        print("Generating test tones...")
        for freq in [440, 880, 1320, 1760]:
            recorder.generate_test_tone(frequency=freq, duration=0.5)

    # Start visualization with slower updates
    print("\nStarting visualization...")
    print("Close the window or press Ctrl+C to stop")

    try:
        # Slower update rate (200ms) to reduce CPU load
        recorder.visualize_live(display_duration=3.0, update_interval=200)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        recorder.cleanup()
```
