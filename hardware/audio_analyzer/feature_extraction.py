"""
MFCC Feature Extraction for Cough Detection
Based on recommendations from journal.md and the research paper
"""
import numpy as np
import librosa
from typing import Optional, Tuple
from config import audio_config, mfcc_config


class MFCCExtractor:
    """
    Extract MFCC features from audio signals.

    Uses 8kHz sampling rate for better low-frequency resolution
    (as discussed in journal.md Day 1)
    """

    def __init__(self, config=None):
        self.config = config or mfcc_config
        self.audio_config = audio_config

    def extract(self, audio: np.ndarray, sr: Optional[int] = None) -> np.ndarray:
        """
        Extract MFCC features from audio signal.

        Args:
            audio: Audio signal (1D numpy array)
            sr: Sample rate (defaults to audio_config.sample_rate)

        Returns:
            MFCC features of shape (n_features, n_frames)
            where n_features = 39 (13 MFCCs + 13 deltas + 13 delta-deltas)
        """
        if sr is None:
            sr = self.audio_config.sample_rate

        # Ensure audio is float32
        audio = audio.astype(np.float32)

        # Extract base MFCCs
        mfccs = librosa.feature.mfcc(
            y=audio,
            sr=sr,
            n_mfcc=self.config.n_mfcc,
            n_fft=self.config.n_fft,
            hop_length=self.config.hop_length,
            n_mels=self.config.n_mels,
            fmin=self.config.fmin,
            fmax=self.config.fmax
        )

        features = [mfccs]

        # Add delta (first derivative)
        if self.config.use_deltas:
            delta = librosa.feature.delta(mfccs)
            features.append(delta)

        # Add delta-delta (second derivative / acceleration)
        if self.config.use_delta_deltas:
            delta2 = librosa.feature.delta(mfccs, order=2)
            features.append(delta2)

        # Stack features: shape (39, n_frames)
        features = np.vstack(features)

        return features

    def extract_normalized(self, audio: np.ndarray, sr: Optional[int] = None) -> np.ndarray:
        """
        Extract and normalize MFCC features.

        Normalization improves neural network training stability.
        """
        features = self.extract(audio, sr)

        # Normalize to zero mean, unit variance per feature
        mean = np.mean(features, axis=1, keepdims=True)
        std = np.std(features, axis=1, keepdims=True)

        # Avoid division by zero
        std = np.where(std == 0, 1, std)

        normalized = (features - mean) / std

        return normalized

    def extract_with_context(
        self,
        audio: np.ndarray,
        window_size: float = 1.5,
        sr: Optional[int] = None
    ) -> Tuple[np.ndarray, dict]:
        """
        Extract MFCC features with additional context information.

        Args:
            audio: Audio signal
            window_size: Size of audio window in seconds
            sr: Sample rate

        Returns:
            features: Normalized MFCC features
            metadata: Dictionary with extraction metadata
        """
        if sr is None:
            sr = self.audio_config.sample_rate

        # Calculate expected number of samples
        expected_samples = int(window_size * sr)

        # Pad or trim audio to expected length
        if len(audio) < expected_samples:
            # Pad with zeros
            audio = np.pad(audio, (0, expected_samples - len(audio)))
        elif len(audio) > expected_samples:
            # Trim to expected length
            audio = audio[:expected_samples]

        # Extract normalized features
        features = self.extract_normalized(audio, sr)

        # Calculate metadata
        n_frames = features.shape[1]
        duration = len(audio) / sr

        metadata = {
            'n_frames': n_frames,
            'duration': duration,
            'sample_rate': sr,
            'n_features': features.shape[0],
            'audio_length': len(audio)
        }

        return features, metadata

    def calculate_energy(self, audio: np.ndarray) -> float:
        """
        Calculate RMS energy of audio signal.

        This can be used as a quick pre-filter before running the neural network.
        More sophisticated than just threshold, but still very fast.
        """
        return np.sqrt(np.mean(audio**2))

    def extract_batch(self, audio_list: list, sr: Optional[int] = None) -> np.ndarray:
        """
        Extract MFCC features from a batch of audio signals.

        Args:
            audio_list: List of audio arrays
            sr: Sample rate

        Returns:
            Batch of features with shape (batch_size, n_features, n_frames)
        """
        features_list = []

        for audio in audio_list:
            features = self.extract_normalized(audio, sr)
            features_list.append(features)

        # Stack into batch
        # Assuming all have same shape (handled by extract_with_context)
        batch = np.stack(features_list, axis=0)

        return batch


class AudioPreprocessor:
    """
    Preprocessing utilities for audio data.
    Includes the data augmentation techniques from the paper.
    """

    def __init__(self, sr: int = 8000):
        self.sr = sr

    def time_shift(self, audio: np.ndarray, shift_pct: float = 0.2) -> np.ndarray:
        """
        Randomly shift audio in time (circular shift).

        Args:
            audio: Input audio
            shift_pct: Maximum shift as percentage of signal length
        """
        shift_max = int(len(audio) * shift_pct)
        shift = np.random.randint(-shift_max, shift_max)

        return np.roll(audio, shift)

    def speed_change(self, audio: np.ndarray, speed_range: Tuple[float, float] = (0.9, 1.1)) -> np.ndarray:
        """
        Change playback speed without changing pitch.

        Args:
            audio: Input audio
            speed_range: (min_rate, max_rate) for speed change
        """
        rate = np.random.uniform(speed_range[0], speed_range[1])

        # Use librosa's time stretching
        stretched = librosa.effects.time_stretch(audio, rate=rate)

        # Pad or trim to original length
        if len(stretched) < len(audio):
            stretched = np.pad(stretched, (0, len(audio) - len(stretched)))
        else:
            stretched = stretched[:len(audio)]

        return stretched

    def add_noise(self, audio: np.ndarray, snr_db: float = 10.0, noise: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Add noise to audio at specified SNR.

        Args:
            audio: Input audio
            snr_db: Signal-to-noise ratio in dB
            noise: Noise signal (if None, white noise is used)
        """
        # Calculate signal power
        signal_power = np.mean(audio ** 2)

        # Generate or use provided noise
        if noise is None:
            noise = np.random.normal(0, 1, len(audio))
        else:
            # Ensure noise is same length
            if len(noise) < len(audio):
                # Repeat noise
                reps = int(np.ceil(len(audio) / len(noise)))
                noise = np.tile(noise, reps)[:len(audio)]
            else:
                # Random crop from noise
                start = np.random.randint(0, len(noise) - len(audio))
                noise = noise[start:start + len(audio)]

        # Calculate noise power for desired SNR
        snr_linear = 10 ** (snr_db / 10)
        noise_power = signal_power / snr_linear

        # Scale noise
        current_noise_power = np.mean(noise ** 2)
        noise = noise * np.sqrt(noise_power / current_noise_power)

        # Add noise to signal
        noisy_audio = audio + noise

        return noisy_audio

    def augment(self, audio: np.ndarray, augmentation_config: dict = None) -> np.ndarray:
        """
        Apply random augmentation to audio.

        Args:
            audio: Input audio
            augmentation_config: Dictionary with augmentation settings
        """
        if augmentation_config is None:
            augmentation_config = {
                'time_shift': True,
                'speed_change': True,
                'add_noise': True,
                'noise_snr_range': (-5, 15)
            }

        augmented = audio.copy()

        # Apply augmentations randomly
        if augmentation_config.get('time_shift', True) and np.random.rand() > 0.5:
            augmented = self.time_shift(augmented)

        if augmentation_config.get('speed_change', True) and np.random.rand() > 0.5:
            augmented = self.speed_change(augmented)

        if augmentation_config.get('add_noise', True) and np.random.rand() > 0.5:
            snr_range = augmentation_config.get('noise_snr_range', (-5, 15))
            snr = np.random.uniform(snr_range[0], snr_range[1])
            augmented = self.add_noise(augmented, snr_db=snr)

        return augmented


# Test the extractor
if __name__ == "__main__":
    # Create a test signal (1.5 seconds of audio)
    duration = 1.5
    sr = 8000
    t = np.linspace(0, duration, int(sr * duration))

    # Simulate a cough-like signal (sharp attack, exponential decay)
    attack = np.random.randn(int(0.2 * sr)) * np.linspace(0, 1, int(0.2 * sr))
    decay = np.random.randn(int(1.3 * sr)) * np.exp(-np.linspace(0, 5, int(1.3 * sr)))
    test_signal = np.concatenate([attack, decay])

    # Extract features
    extractor = MFCCExtractor()
    features, metadata = extractor.extract_with_context(test_signal)

    print("MFCC Feature Extraction Test")
    print("=" * 50)
    print(f"Input audio shape: {test_signal.shape}")
    print(f"Output features shape: {features.shape}")
    print(f"Number of features: {metadata['n_features']}")
    print(f"Number of frames: {metadata['n_frames']}")
    print(f"Duration: {metadata['duration']:.2f}s")
    print("\nFeature statistics:")
    print(f"  Mean: {np.mean(features):.4f}")
    print(f"  Std: {np.std(features):.4f}")
    print(f"  Min: {np.min(features):.4f}")
    print(f"  Max: {np.max(features):.4f}")
