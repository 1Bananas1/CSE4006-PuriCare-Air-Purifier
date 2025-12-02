"""
Neural Network Models for Cough Detection and Classification

Stage 1: Detection Model - Binary classification (cough vs non-cough)
Stage 2: Classification Model - Multi-class classification (cough types/bins)
"""
import tensorflow as tf

# Handle Keras import for different TensorFlow versions
try:
    from tensorflow import keras
    from tensorflow.keras import layers, models
except (ImportError, AttributeError):
    import keras
    from keras import layers, models

from typing import Tuple, Optional
from config import detection_config, classification_config, mfcc_config, audio_config
import json
from pathlib import Path

class CoughDetectionModel:
    """
    Stage 1: Lightweight cough detection model.

    Binary classification: cough vs non-cough
    Designed to be fast and efficient for real-time processing.
    """

    def __init__(self, config=None, input_shape: Optional[Tuple] = None):
        self.config = config or detection_config

        # Calculate input shape based on MFCC config if not provided
        if input_shape is None:
            # Shape: (n_features, n_frames)
            # For 1.5s audio at 8kHz with hop_length=256: ~47 frames
            n_frames = int((1.5 * 8000) / 256) + 1
            input_shape = (mfcc_config.total_features, n_frames)

        self.input_shape = input_shape
        self.model = self._build_model()

    def _build_model(self) -> keras.Model:
        """
        Build 1D CNN model for cough detection

        Architecture inspired by lightweight CNNs from research.
        Uses 1D convolutions over the time axis.
        """
        inputs = layers.Input(shape=self.input_shape)

        # Reshape for Conv1D: (features, frames) -> (frames, features)
        x = layers.Permute((2, 1))(inputs)

        # Convolutional blocks
        for i, (filters, kernel) in enumerate(zip(
            self.config.conv_filters,
            self.config.conv_kernels
        )):
            x = layers.Conv1D(
                filters=filters,
                kernel_size=kernel,
                padding='same',
                activation='relu',
                name=f'conv1d_{i+1}'
            )(x)

            x = layers.BatchNormalization(name=f'bn_{i+1}')(x)

            x = layers.MaxPooling1D(
                pool_size=self.config.pool_size,
                name=f'pool_{i+1}'
            )(x)

            x = layers.Dropout(self.config.dropout, name=f'dropout_{i+1}')(x)

        # Global pooling
        x = layers.GlobalAveragePooling1D(name='global_avg_pool')(x)

        # Dense layers
        x = layers.Dense(64, activation='relu', name='dense_1')(x)
        x = layers.Dropout(self.config.dropout, name='dropout_final')(x)

        # Output layer (sigmoid for binary classification)
        outputs = layers.Dense(1, activation='sigmoid', name='output')(x)

        model = models.Model(inputs=inputs, outputs=outputs, name='CoughDetector')

        return model

    def compile(self, learning_rate: Optional[float] = None):
        """Compile the model with optimizer and loss."""
        lr = learning_rate or self.config.learning_rate

        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=lr),
            loss='binary_crossentropy',
            metrics=[
                'accuracy',
                keras.metrics.Precision(name='precision'),
                keras.metrics.Recall(name='recall'),
                keras.metrics.AUC(name='auc', num_thresholds=200)
            ]
        )

    def summary(self):
        """Print model summary."""
        return self.model.summary()

    def get_model(self) -> keras.Model:
        """Return the Keras model."""
        return self.model

    def predict(self, features: tf.Tensor, threshold: Optional[float] = None) -> Tuple[bool, float]:
        """
        Predict if audio contains a cough.

        Args:
            features: MFCC features (shape: (n_features, n_frames))
            threshold: Confidence threshold (default from config)

        Returns:
            is_cough: Boolean indicating if cough detected
            confidence: Probability score
        """
        threshold = threshold or self.config.confidence_threshold

        # Ensure features have batch dimension
        if len(features.shape) == 2:
            features = tf.expand_dims(features, 0)

        # Get prediction
        prob = self.model.predict(features, verbose=0)[0][0]

        is_cough = prob >= threshold

        return is_cough, float(prob)


class CoughClassificationModel:
    """
    Stage 2: Cough classification model.

    Multi-class classification: different cough types/bins
    Uses CNN-LSTM to capture both spatial and temporal patterns.
    """

    def __init__(self, config=None, input_shape: Optional[Tuple] = None):
        self.config = config or classification_config

        # Calculate input shape based on MFCC config if not provided
        if input_shape is None:
            n_frames = int((1.5 * 8000) / 256) + 1
            input_shape = (mfcc_config.total_features, n_frames)

        self.input_shape = input_shape
        self.model = self._build_model()

    def _build_model(self) -> keras.Model:
        """
        Build CNN-LSTM model for cough classification.

        Architecture inspired by CoughCueNet from the paper.
        """
        inputs = layers.Input(shape=self.input_shape)

        # Reshape for Conv1D: (features, frames) -> (frames, features)
        x = layers.Permute((2, 1))(inputs)

        # Convolutional blocks
        for i, (filters, kernel) in enumerate(zip(
            self.config.conv_filters,
            self.config.conv_kernels
        )):
            x = layers.Conv1D(
                filters=filters,
                kernel_size=kernel,
                padding='same',
                activation='relu',
                name=f'conv1d_{i+1}'
            )(x)

            x = layers.BatchNormalization(name=f'bn_{i+1}')(x)

            x = layers.MaxPooling1D(
                pool_size=2,
                name=f'pool_{i+1}'
            )(x)

            x = layers.Dropout(self.config.dropout, name=f'dropout_{i+1}')(x)

        # LSTM layer to capture temporal dependencies
        x = layers.LSTM(
            units=self.config.lstm_units,
            return_sequences=False,
            name='lstm'
        )(x)

        x = layers.Dropout(self.config.dropout, name='dropout_lstm')(x)

        # Dense layers
        x = layers.Dense(128, activation='relu', name='dense_1')(x)
        x = layers.Dropout(self.config.dropout, name='dropout_dense')(x)

        # Output layer (softmax for multi-class)
        outputs = layers.Dense(
            self.config.num_bins,
            activation='softmax',
            name='output'
        )(x)

        model = models.Model(inputs=inputs, outputs=outputs, name='CoughClassifier')

        return model

    def compile(self, learning_rate: Optional[float] = None):
        """Compile the model with optimizer and loss."""
        lr = learning_rate or self.config.learning_rate

        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=lr),
            loss='categorical_crossentropy',
            metrics=[
                'accuracy',
                keras.metrics.CategoricalAccuracy(name='cat_accuracy'),
                keras.metrics.TopKCategoricalAccuracy(k=2, name='top_2_accuracy')
            ]
        )

    def summary(self):
        """Print model summary."""
        return self.model.summary()

    def get_model(self) -> keras.Model:
        """Return the Keras model."""
        return self.model

    def predict(self, features: tf.Tensor) -> Tuple[int, str, float]:
        """
        Predict cough type/bin.

        Args:
            features: MFCC features (shape: (n_features, n_frames))

        Returns:
            bin_id: Predicted bin index
            bin_name: Name of the bin
            confidence: Probability score for predicted class
        """
        # Ensure features have batch dimension
        if len(features.shape) == 2:
            features = tf.expand_dims(features, 0)

        # Get prediction
        probs = self.model.predict(features, verbose=0)[0]

        # Get predicted class
        bin_id = int(tf.argmax(probs))
        confidence = float(probs[bin_id])
        bin_name = self.config.bin_names[bin_id]

        return bin_id, bin_name, confidence


class CoughDetectionPipeline:
    """
    Complete two-stage pipeline combining detection and classification.
    """

    def __init__(
        self,
        detection_model: CoughDetectionModel,
        classification_model: CoughClassificationModel
    ):
        self.detection_model = detection_model
        self.classification_model = classification_model

    def predict(self, features: tf.Tensor) -> dict:
        """
        Run complete pipeline: detection -> classification.

        Args:
            features: MFCC features

        Returns:
            Dictionary with prediction results
        """
        # Stage 1: Detection
        is_cough, detection_conf = self.detection_model.predict(features)

        result = {
            'is_cough': is_cough,
            'detection_confidence': detection_conf,
            'cough_type': None,
            'cough_type_id': None,
            'classification_confidence': None
        }

        # Stage 2: Classification (only if cough detected)
        if is_cough:
            bin_id, bin_name, class_conf = self.classification_model.predict(features)

            result.update({
                'cough_type': bin_name,
                'cough_type_id': bin_id,
                'classification_confidence': class_conf
            })

        return result

    def save(self, detection_path: str, classification_path: str):
        """Save both models."""
        self.detection_model.model.save(detection_path)
        self.classification_model.model.save(classification_path)
        print(f"Detection model saved to: {detection_path}")
        print(f"Classification model saved to: {classification_path}")

    @classmethod
    def load(cls, detection_path: str, classification_path: str):
        """Load both models from disk."""
        detection_keras = keras.models.load_model(detection_path)
        classification_keras = keras.models.load_model(classification_path)

        # Wrap in our classes
        detection_model = CoughDetectionModel()
        detection_model.model = detection_keras

        classification_model = CoughClassificationModel()
        classification_model.model = classification_keras

        # Try to load class names for the classification model
        class_names_path = Path(classification_path).parent / 'class_names.json'
        if class_names_path.exists():
            try:
                with open(class_names_path, 'r') as f:
                    class_names = json.load(f)
                
                # Update the loaded model's config
                classification_model.config.bin_names = class_names
                classification_model.config.num_bins = len(class_names)
                print(f"✓ Loaded class names: {class_names}")
            except Exception as e:
                print(f"⚠️  Warning: Could not load or parse class_names.json: {e}")

        return cls(detection_model, classification_model)


# Test the models
if __name__ == "__main__":
    print("=" * 70)
    print("STAGE 1: COUGH DETECTION MODEL")
    print("=" * 70)

    # Create detection model
    detection_model = CoughDetectionModel()
    detection_model.compile()
    print(detection_model.summary())

    print("\n" + "=" * 70)
    print("STAGE 2: COUGH CLASSIFICATION MODEL")
    print("=" * 70)

    # Create classification model
    classification_model = CoughClassificationModel()
    classification_model.compile()
    print(classification_model.summary())

    print("\n" + "=" * 70)
    print("MODEL STATISTICS")
    print("=" * 70)

    # Calculate model sizes
    detection_params = detection_model.model.count_params()
    classification_params = classification_model.model.count_params()

    print(f"Detection Model Parameters: {detection_params:,}")
    print(f"Classification Model Parameters: {classification_params:,}")
    print(f"Total Parameters: {detection_params + classification_params:,}")

    print("\nFor reference:")
    print(f"  - CoughCueNet (paper): ~6M parameters")
    print(f"  - VGG16: ~14M parameters")
    print(f"  - ResNet50: ~24M parameters")
