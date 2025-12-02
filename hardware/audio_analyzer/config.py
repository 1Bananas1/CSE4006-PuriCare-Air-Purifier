"""
Configuration file for cough detection system
"""
from dataclasses import dataclass

@dataclass
class AudioConfig:
    """Audio capture configuration"""
    sample_rate: int = 8000  # Hz - matches journal.md recommendation
    channels: int = 1
    dtype: str = 'float32'
    block_size: int = 2048
    audio_window: float = 10.0  # seconds - rolling buffer size

    # Detection window
    detection_window: float = 1.5  # seconds - matches the paper
    hop_length: float = 0.5  # seconds - how often to run detection


@dataclass
class MFCCConfig:
    """MFCC feature extraction configuration"""
    n_mfcc: int = 13  # Number of MFCCs
    n_fft: int = 512  # FFT window size
    hop_length: int = 256  # Hop length for STFT
    n_mels: int = 40  # Number of mel bands
    fmin: int = 50  # Minimum frequency
    fmax: int = 4000  # Maximum frequency (Nyquist for 8kHz)

    # Include deltas and delta-deltas
    use_deltas: bool = True
    use_delta_deltas: bool = True

    def get_n_frames(self, window_size_s: float, sample_rate: int) -> int:
        """Calculate the number of frames for a given audio window."""
        return int((window_size_s * sample_rate) / self.hop_length) + 1

    def get_input_shape(self, window_size_s: float, sample_rate: int) -> tuple:
        """Calculate the model input shape (features, frames)."""
        return (self.total_features, self.get_n_frames(window_size_s, sample_rate))

    @property
    def total_features(self):
        """Total number of MFCC features"""
        base = self.n_mfcc
        if self.use_deltas:
            base += self.n_mfcc
        if self.use_delta_deltas:
            base += self.n_mfcc
        return base  # 39 features if all enabled


@dataclass
class DetectionModelConfig:
    """Stage 1: Detection model configuration"""
    model_type: str = "1DCNN"  # Lightweight 1D CNN
    input_shape: tuple = None  # Will be set based on MFCC config

    # Architecture
    conv_filters: list = None  # [32, 64, 128]
    conv_kernels: list = None  # [3, 3, 3]
    pool_size: int = 2
    dropout: float = 0.3

    # Training
    batch_size: int = 32
    epochs: int = 50
    learning_rate: float = 0.001

    # Detection threshold
    confidence_threshold: float = 0.7  # Probability threshold for "cough detected"

    def __post_init__(self):
        if self.conv_filters is None:
            self.conv_filters = [32, 64, 128]
        if self.conv_kernels is None:
            self.conv_kernels = [3, 3, 3]


@dataclass
class ClassificationModelConfig:
    """Stage 2: Classification model configuration"""
    model_type: str = "CNN-LSTM"  # Captures temporal patterns
    input_shape: tuple = None  # Will be set based on MFCC config

    # Number of cough bins/categories
    num_bins: int = 5  # Adjust based on your dataset
    bin_names: list = None  # ["dry_cough", "wet_cough", "throat_clear", etc.]

    # Architecture
    conv_filters: list = None  # [64, 128, 256]
    conv_kernels: list = None  # [3, 3, 3]
    lstm_units: int = 128
    dropout: float = 0.4

    # Training
    batch_size: int = 32
    epochs: int = 100
    learning_rate: float = 0.0001

    def __post_init__(self):
        if self.conv_filters is None:
            self.conv_filters = [64, 128, 256]
        if self.conv_kernels is None:
            self.conv_kernels = [3, 3, 3]
        if self.bin_names is None:
            self.bin_names = [f"cough_bin_{i}" for i in range(self.num_bins)]


@dataclass
class DataConfig:
    """Data paths and augmentation settings"""
    # Paths
    raw_data_dir: str = "hardware/AI/data"
    processed_data_dir: str = "hardware/AI/processed"
    models_dir: str = "hardware/AI/models"

    # Data split
    train_split: float = 0.7
    val_split: float = 0.15
    test_split: float = 0.15

    # Data augmentation (from the paper)
    use_augmentation: bool = True
    time_shift_range: float = 0.2  # 20% of signal length
    speed_change_range: tuple = (0.9, 1.1)  # 10% speed variation
    noise_snr_range: tuple = (-5, 15)  # dB

    # Random seed for reproducibility
    random_seed: int = 42


# Create default configs
audio_config = AudioConfig()
mfcc_config = MFCCConfig()
detection_config = DetectionModelConfig()
classification_config = ClassificationModelConfig()
data_config = DataConfig()
