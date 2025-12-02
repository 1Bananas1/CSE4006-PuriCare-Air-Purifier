"""
Audio detector wrapper for simulator integration.

Wraps the LiveCoughDetector and integrates it with the air purifier simulator.
"""
import time
import threading
from datetime import datetime, timedelta
from typing import Optional, Callable, List
from collections import deque
import sys
import os

# Add audio_analyzer to path
audio_analyzer_path = os.path.join(os.path.dirname(__file__), '..', '..', 'audio_analyzer')
sys.path.insert(0, audio_analyzer_path)

try:
    from live_detection import LiveCoughDetector, DetectionConfig
except ImportError as e:
    print(f"⚠️  Warning: Could not import audio analyzer: {e}")
    LiveCoughDetector = None
    DetectionConfig = None


class CoughEvent:
    """Represents a detected cough event."""

    def __init__(self, cough_type: str, confidence: float, timestamp: float):
        self.cough_type = cough_type
        self.confidence = confidence
        self.timestamp = timestamp
        self.datetime = datetime.fromtimestamp(timestamp)

    def __repr__(self):
        return f"CoughEvent(type={self.cough_type}, confidence={self.confidence:.2f}, time={self.datetime.strftime('%H:%M:%S')})"


class AudioDetectorWrapper:
    """
    Wrapper for LiveCoughDetector with simulator integration.

    Features:
    - Start/stop audio detection based on auto mode
    - Track cough events over a 3-hour sliding window
    - Trigger aggressive mode when threshold is reached
    - Send events to backend/Firebase
    """

    def __init__(
        self,
        on_event_callback: Optional[Callable[[CoughEvent], None]] = None,
        aggressive_threshold: int = 5,
        tracking_window_hours: float = 3.0
    ):
        """
        Initialize audio detector wrapper.

        Args:
            on_event_callback: Callback function called when cough is detected
            aggressive_threshold: Number of coughs in window to trigger aggressive mode
            tracking_window_hours: Time window for tracking coughs (hours)
        """
        if LiveCoughDetector is None:
            raise ImportError("LiveCoughDetector not available. Install audio_analyzer dependencies.")

        self.on_event_callback = on_event_callback
        self.aggressive_threshold = aggressive_threshold
        self.tracking_window = timedelta(hours=tracking_window_hours)

        # Event tracking
        self.cough_events: deque[CoughEvent] = deque()
        self.events_lock = threading.Lock()

        # Detector state
        self.detector: Optional[LiveCoughDetector] = None
        self.is_running = False
        self._monitor_thread: Optional[threading.Thread] = None

        # Statistics
        self.total_events = 0
        self.aggressive_mode_triggered = False

    def _create_detector(self) -> LiveCoughDetector:
        """Create and configure the live cough detector."""
        config = DetectionConfig(
            detection_model_path="audio_analyzer/hardware/AI/models/detection_model_best.h5",
            classification_model_path="audio_analyzer/hardware/AI/models/classification_model_best.h5",
            detection_confidence=0.7,
            use_energy_prefilter=True,
            save_detections=True,
            save_dir="simulator/audio_detections"
        )

        # Create detector with custom callback
        detector = LiveCoughDetector(config)

        # Monkey-patch the detection loop to add our callback
        original_detection_loop = detector._detection_loop

        def detection_loop_with_callback():
            """Wrap detection loop to add our event callback."""
            # Store original print for detection
            original_print = print

            # Run original detection in a modified way
            detection_samples = int(detector.config.detection_window * detector.config.sample_rate)
            hop_samples = int(detector.config.hop_length * detector.config.sample_rate)
            hop_blocks = max(1, int(hop_samples / detector.config.block_size))

            blocks_waited = 0

            print("\n" + "=" * 70)
            print("🎤 AUDIO DETECTION ACTIVE (Integrated with Simulator)")
            print("=" * 70)
            print(f"Detection window: {detector.config.detection_window}s")
            print(f"Hop length: {detector.config.hop_length}s")
            print(f"Aggressive threshold: {self.aggressive_threshold} coughs in {self.tracking_window.total_seconds()/3600:.1f} hours")
            print("=" * 70 + "\n")

            while detector.is_running:
                # Wait for hop duration
                if blocks_waited < hop_blocks:
                    time.sleep(0.1)
                    blocks_waited += 1
                    continue

                blocks_waited = 0

                # Get current buffer
                with detector.buffer_lock:
                    if len(detector.display_buffer) < 1:
                        continue
                    buffer_copy = list(detector.display_buffer)

                # Concatenate buffer
                full_buffer = detector.np.concatenate(buffer_copy)

                # Get detection window
                if len(full_buffer) < detection_samples:
                    continue

                window = full_buffer[-detection_samples:]

                # Update statistics
                detector.total_windows_processed += 1

                # Energy pre-filter
                if not detector._energy_prefilter(window):
                    print(".", end="", flush=True)
                    continue

                # Extract MFCC features
                try:
                    features = detector.extractor.extract_normalized(
                        window,
                        sr=detector.config.sample_rate
                    )

                    # Run neural network pipeline
                    result = detector.pipeline.predict(features)

                    # Check if cough detected
                    if result['is_cough']:
                        detector.total_coughs_detected += 1
                        detector.last_detection_time = time.time()

                        # Create cough event
                        event = CoughEvent(
                            cough_type=result['cough_type'],
                            confidence=result['classification_confidence'],
                            timestamp=time.time()
                        )

                        # Track event
                        self._track_event(event)

                        print("\n" + "=" * 70)
                        print(f"🎯 COUGH DETECTED! (#{detector.total_coughs_detected})")
                        print("=" * 70)
                        print(f"Detection confidence: {result['detection_confidence']:.2%}")
                        print(f"Cough type: {result['cough_type']}")
                        print(f"Classification confidence: {result['classification_confidence']:.2%}")
                        print(f"Time: {time.strftime('%H:%M:%S')}")
                        print(f"Events in last {self.tracking_window.total_seconds()/3600:.1f}h: {self.get_recent_event_count()}")
                        print("=" * 70 + "\n")

                        # Call user callback
                        if self.on_event_callback:
                            try:
                                self.on_event_callback(event)
                            except Exception as e:
                                print(f"⚠️  Error in event callback: {e}")

                        # Save detection
                        if detector.config.save_detections:
                            detector.save_queue.put({
                                'audio': window,
                                'features': features,
                                'result': result,
                                'timestamp': time.time()
                            })

                    else:
                        print(".", end="", flush=True)

                except Exception as e:
                    print(f"\nError in detection: {e}")
                    continue

        # Replace detection loop
        detector._detection_loop = detection_loop_with_callback
        detector.np = __import__('numpy')  # Add numpy reference

        return detector

    def _track_event(self, event: CoughEvent):
        """Track a cough event and manage the sliding window."""
        with self.events_lock:
            self.cough_events.append(event)
            self.total_events += 1

            # Remove old events outside the tracking window
            self._cleanup_old_events()

            # Check if aggressive mode should be triggered
            recent_count = len(self.cough_events)
            if recent_count >= self.aggressive_threshold and not self.aggressive_mode_triggered:
                self.aggressive_mode_triggered = True
                print("\n" + "🚨" * 35)
                print(f"⚠️  AGGRESSIVE MODE TRIGGERED!")
                print(f"   {recent_count} coughs detected in last {self.tracking_window.total_seconds()/3600:.1f} hours")
                print("🚨" * 35 + "\n")

    def _cleanup_old_events(self):
        """Remove events older than the tracking window."""
        cutoff_time = datetime.now() - self.tracking_window

        while self.cough_events and self.cough_events[0].datetime < cutoff_time:
            self.cough_events.popleft()

    def get_recent_event_count(self) -> int:
        """Get number of events in the tracking window."""
        with self.events_lock:
            self._cleanup_old_events()
            return len(self.cough_events)

    def should_trigger_aggressive_mode(self) -> bool:
        """Check if aggressive mode should be active."""
        return self.get_recent_event_count() >= self.aggressive_threshold

    def reset_aggressive_mode(self):
        """Reset aggressive mode trigger."""
        self.aggressive_mode_triggered = False

    def start(self):
        """Start audio detection."""
        if self.is_running:
            print("⚠️  Audio detector already running")
            return

        try:
            print("\n🎤 Starting audio detection...")

            # Create detector
            self.detector = self._create_detector()

            # Start detector
            self.detector.start()
            self.is_running = True

            print("✅ Audio detection started successfully!")

        except Exception as e:
            print(f"❌ Error starting audio detector: {e}")
            self.is_running = False
            raise

    def stop(self):
        """Stop audio detection."""
        if not self.is_running:
            return

        print("\n🎤 Stopping audio detection...")

        try:
            if self.detector:
                self.detector.stop()

            self.is_running = False
            print("✅ Audio detection stopped")

        except Exception as e:
            print(f"⚠️  Error stopping audio detector: {e}")

    def get_statistics(self) -> dict:
        """Get detection statistics."""
        return {
            'total_events': self.total_events,
            'recent_events': self.get_recent_event_count(),
            'aggressive_mode': self.should_trigger_aggressive_mode(),
            'is_running': self.is_running
        }


def main():
    """Test the audio detector wrapper."""
    def on_cough_detected(event: CoughEvent):
        print(f"\n📢 Callback received: {event}")

    detector = AudioDetectorWrapper(
        on_event_callback=on_cough_detected,
        aggressive_threshold=3,
        tracking_window_hours=0.5  # 30 minutes for testing
    )

    try:
        detector.start()

        print("\n🎤 Audio detector running. Press Ctrl+C to stop.\n")

        while True:
            time.sleep(5)
            stats = detector.get_statistics()
            print(f"\n📊 Stats: {stats['recent_events']} recent events, Aggressive: {stats['aggressive_mode']}")

    except KeyboardInterrupt:
        print("\n\nStopping...")

    finally:
        detector.stop()


if __name__ == "__main__":
    main()
