"""
Data loading and preparation utilities for cough detection training
"""
import os
import numpy as np
import librosa
import tensorflow as tf
from pathlib import Path
from typing import Tuple, List, Optional, Dict
from sklearn.model_selection import train_test_split
import json

from config import audio_config, data_config, mfcc_config
from feature_extraction import MFCCExtractor, AudioPreprocessor


class CoughDataset:
    """
    Dataset loader for cough WAV files.

    Expected directory structure:
        data/
            cough_bin_0/
                sample1.wav
                sample2.wav
                ...
            cough_bin_1/
                sample1.wav
                ...
            non_cough/
                sample1.wav
                ...
    """

    def __init__(
        self,
        data_dir: str,
        window_size: float = 1.5,
        sample_rate: int = 8000,
        use_augmentation: bool = True
    ):
        self.data_dir = Path(data_dir)
        self.window_size = window_size
        self.sample_rate = sample_rate
        self.use_augmentation = use_augmentation

        self.extractor = MFCCExtractor()
        self.preprocessor = AudioPreprocessor(sr=sample_rate)

        self.audio_files = []
        self.labels = []
        self.label_to_name = {}
        self.name_to_label = {}

        self._load_file_list()

    def _load_file_list(self):
        """Load list of audio files and their labels."""
        if not self.data_dir.exists():
            raise ValueError(f"Data directory does not exist: {self.data_dir}")

        # Get all subdirectories (each represents a class)
        class_dirs = [d for d in self.data_dir.iterdir() if d.is_dir()]

        if len(class_dirs) == 0:
            raise ValueError(f"No class directories found in {self.data_dir}")

        # Sort for consistent labeling
        class_dirs = sorted(class_dirs, key=lambda x: x.name)

        # Create label mappings
        for idx, class_dir in enumerate(class_dirs):
            class_name = class_dir.name
            self.label_to_name[idx] = class_name
            self.name_to_label[class_name] = idx

            # Find all WAV files in this class
            wav_files = list(class_dir.glob("*.wav"))

            for wav_file in wav_files:
                self.audio_files.append(str(wav_file))
                self.labels.append(idx)

        if len(self.audio_files) == 0:
            raise FileNotFoundError(
                f"No .wav files found in the subdirectories of {self.data_dir}.\n"
                f"Please ensure your dataset is populated correctly. You may need to run a download script."
            )

        print(f"Found {len(self.audio_files)} audio files across {len(class_dirs)} classes")
        print(f"Classes: {self.label_to_name}")

    def load_audio(self, file_path: str) -> np.ndarray:
        """Load and preprocess a single audio file."""
        # Load audio
        audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)

        # Calculate expected length
        expected_length = int(self.window_size * self.sample_rate)

        # Pad or trim
        if len(audio) < expected_length:
            audio = np.pad(audio, (0, expected_length - len(audio)))
        elif len(audio) > expected_length:
            # Random crop for training, center crop for validation
            if self.use_augmentation:
                start = np.random.randint(0, len(audio) - expected_length)
            else:
                start = (len(audio) - expected_length) // 2
            audio = audio[start:start + expected_length]

        return audio

    def create_tf_dataset(
        self,
        file_indices: List[int],
        batch_size: int = 32,
        shuffle: bool = True,
        augment: bool = True
    ) -> tf.data.Dataset:
        """
        Create TensorFlow dataset from file indices.

        Args:
            file_indices: Indices of files to include
            batch_size: Batch size
            shuffle: Whether to shuffle
            augment: Whether to apply data augmentation

        Returns:
            tf.data.Dataset
        """

        def load_and_preprocess(idx):
            """Load audio, extract features, return (features, label)."""
            idx = int(idx)
            file_path = self.audio_files[idx]
            label = self.labels[idx]

            # Load audio
            audio = self.load_audio(file_path)

            # Apply augmentation if enabled
            if augment and self.use_augmentation:
                audio = self.preprocessor.augment(audio)

            # Extract MFCC features
            features = self.extractor.extract_normalized(audio, sr=self.sample_rate)

            return features.astype(np.float32), label

        # Create dataset from indices
        dataset = tf.data.Dataset.from_tensor_slices(file_indices)

        if shuffle:
            dataset = dataset.shuffle(buffer_size=len(file_indices))

        # Map loading function
        dataset = dataset.map(
            lambda idx: tf.py_function(
                load_and_preprocess,
                [idx],
                [tf.float32, tf.int32]
            ),
            num_parallel_calls=tf.data.AUTOTUNE
        )

        # Set shapes (TensorFlow needs explicit shapes after py_function)
        input_shape = mfcc_config.get_input_shape(self.window_size, self.sample_rate)
        dataset = dataset.map(
            lambda x, y: (
                tf.ensure_shape(x, input_shape),
                tf.ensure_shape(y, [])
            )
        )

        # Batch
        dataset = dataset.batch(batch_size)

        # Prefetch for performance
        dataset = dataset.prefetch(tf.data.AUTOTUNE)

        return dataset

    def split_data(
        self,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        random_seed: int = 42
    ) -> Dict[str, List[int]]:
        """
        Split data into train/val/test sets.

        Returns dictionary with 'train', 'val', 'test' keys containing file indices.
        """
        assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6

        indices = np.arange(len(self.audio_files))

        # First split: train vs (val + test)
        train_idx, temp_idx = train_test_split(
            indices,
            test_size=(1 - train_ratio),
            random_state=random_seed,
            stratify=self.labels
        )

        # Second split: val vs test
        val_ratio_adjusted = val_ratio / (val_ratio + test_ratio)
        val_idx, test_idx = train_test_split(
            temp_idx,
            test_size=(1 - val_ratio_adjusted),
            random_state=random_seed,
            stratify=[self.labels[i] for i in temp_idx]
        )

        splits = {
            'train': train_idx.tolist(),
            'val': val_idx.tolist(),
            'test': test_idx.tolist()
        }

        print(f"Data split: Train={len(train_idx)}, Val={len(val_idx)}, Test={len(test_idx)}")

        return splits

    def save_splits(self, splits: Dict[str, List[int]], output_path: str):
        """Save data splits to JSON file."""
        with open(output_path, 'w') as f:
            json.dump(splits, f, indent=2)
        print(f"Splits saved to {output_path}")

    def load_splits(self, input_path: str) -> Dict[str, List[int]]:
        """Load data splits from JSON file."""
        with open(input_path, 'r') as f:
            splits = json.load(f)
        print(f"Splits loaded from {input_path}")
        return splits


class DetectionDatasetConverter:
    """
    Convert multi-class dataset to binary detection dataset.

    Combines all cough types into 'cough' class and keeps 'non_cough' separate.
    """

    def __init__(self, dataset: CoughDataset):
        self.dataset = dataset

    def get_binary_labels(self) -> np.ndarray:
        """
        Convert labels to binary (0=non-cough, 1=cough).

        Assumes 'non_cough' directory exists and all others are cough types.
        """
        binary_labels = []

        for label in self.dataset.labels:
            class_name = self.dataset.label_to_name[label]

            # Only classes containing 'cough' are the positive class (1)
            if 'cough' in class_name.lower():
                binary_labels.append(1)
            else:
                binary_labels.append(0)

        return np.array(binary_labels)

    def create_detection_dataset(
        self,
        file_indices: List[int],
        batch_size: int = 32,
        shuffle: bool = True,
        augment: bool = True
    ) -> tf.data.Dataset:
        """Create dataset for binary detection training."""

        binary_labels = self.get_binary_labels()

        def load_and_preprocess(idx):
            """Load audio and return binary label."""
            idx = int(idx)
            file_path = self.dataset.audio_files[idx]
            label = binary_labels[idx]

            # Load audio
            audio = self.dataset.load_audio(file_path)

            # Apply augmentation if enabled
            if augment and self.dataset.use_augmentation:
                audio = self.dataset.preprocessor.augment(audio)

            # Extract MFCC features
            features = self.dataset.extractor.extract_normalized(audio, sr=self.dataset.sample_rate)

            return features.astype(np.float32), np.int32(label)

        # Create dataset
        dataset = tf.data.Dataset.from_tensor_slices(file_indices)

        if shuffle:
            dataset = dataset.shuffle(buffer_size=len(file_indices))

        dataset = dataset.map(
            lambda idx: tf.py_function(
                load_and_preprocess,
                [idx],
                [tf.float32, tf.int32]
            ),
            num_parallel_calls=tf.data.AUTOTUNE
        )

        # Set shapes
        input_shape = mfcc_config.get_input_shape(self.dataset.window_size, self.dataset.sample_rate)
        dataset = dataset.map(
            lambda x, y: (
                tf.ensure_shape(x, input_shape),
                tf.ensure_shape(y, [])
            )
        )

        dataset = dataset.batch(batch_size)
        dataset = dataset.prefetch(tf.data.AUTOTUNE)

        return dataset


# Test the data loader
if __name__ == "__main__":
    import sys

    # Check if data directory exists
    test_data_dir = "hardware/AI/cough_dataset"  # Adjust this path

    if not os.path.exists(test_data_dir):
        print(f"Test data directory not found: {test_data_dir}")
        print("\nExpected structure:")
        print("  data/")
        print("    cough_bin_0/")
        print("      *.wav")
        print("    cough_bin_1/")
        print("      *.wav")
        print("    non_cough/")
        print("      *.wav")
        sys.exit(1)

    print("Testing CoughDataset...")
    print("=" * 70)

    dataset = CoughDataset(
        data_dir=test_data_dir,
        use_augmentation=False
    )

    print(f"\nTotal samples: {len(dataset.audio_files)}")
    print(f"Classes: {dataset.label_to_name}")

    # Test splits
    splits = dataset.split_data()

    # Create TF datasets
    print("\nCreating TensorFlow datasets...")
    train_ds = dataset.create_tf_dataset(splits['train'], batch_size=16, augment=True)
    val_ds = dataset.create_tf_dataset(splits['val'], batch_size=16, augment=False)

    print("\nTesting batch loading...")
    for features, labels in train_ds.take(1):
        print(f"Features batch shape: {features.shape}")
        print(f"Labels batch shape: {labels.shape}")
        print(f"Feature range: [{tf.reduce_min(features):.3f}, {tf.reduce_max(features):.3f}]")

    print("\n✓ Data loader test passed!")
