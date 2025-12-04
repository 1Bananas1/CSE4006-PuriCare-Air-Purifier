"""
Training script for cough detection models
"""
import os
import argparse
import tensorflow as tf

# Handle Keras import for different TensorFlow versions
try:
    from tensorflow import keras
except (ImportError, AttributeError):
    import keras

from datetime import datetime
import json

from models import CoughDetectionModel, CoughClassificationModel
from data_loader import CoughDataset, DetectionDatasetConverter
from config import (
    detection_config,
    classification_config,
    data_config,
    audio_config
)


class TrainingPipeline:
    """Handles training for both detection and classification models."""

    def __init__(self, data_dir: str, output_dir: str):
        self.data_dir = data_dir
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        # Load dataset
        print("Loading dataset...")
        self.dataset = CoughDataset(
            data_dir=data_dir,
            window_size=1.5,
            sample_rate=audio_config.sample_rate,
            use_augmentation=True
        )

        # Create or load splits
        splits_path = os.path.join(output_dir, 'data_splits.json')
        if os.path.exists(splits_path):
            print(f"Loading existing splits from {splits_path}")
            self.splits = self.dataset.load_splits(splits_path)
        else:
            print("Creating new data splits...")
            self.splits = self.dataset.split_data(
                train_ratio=data_config.train_split,
                val_ratio=data_config.val_split,
                test_ratio=data_config.test_split,
                random_seed=data_config.random_seed
            )
            self.dataset.save_splits(self.splits, splits_path)

    def train_detection_model(self, epochs: int = None, batch_size: int = None):
        """Train Stage 1: Detection model (binary classification)."""
        print("\n" + "=" * 70)
        print("TRAINING STAGE 1: COUGH DETECTION MODEL")
        print("=" * 70)

        epochs = epochs or detection_config.epochs
        batch_size = batch_size or detection_config.batch_size

        # Convert to binary dataset
        converter = DetectionDatasetConverter(self.dataset)

        # Create datasets
        print("\nPreparing datasets...")
        train_ds = converter.create_detection_dataset(
            self.splits['train'],
            batch_size=batch_size,
            shuffle=True,
            augment=True
        )

        val_ds = converter.create_detection_dataset(
            self.splits['val'],
            batch_size=batch_size,
            shuffle=False,
            augment=False
        )

        # Create model
        print("\nBuilding model...")
        model = CoughDetectionModel()
        model.compile()
        print(model.summary())

        # Callbacks
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = os.path.join(self.output_dir, f'detection_model_{timestamp}.h5')
        best_model_path = os.path.join(self.output_dir, 'detection_model_best.h5')
        log_dir = os.path.join(self.output_dir, 'logs', 'detection', timestamp)

        callbacks = [
            keras.callbacks.ModelCheckpoint(
                best_model_path,
                monitor='val_loss',
                save_best_only=True,
                mode='min',
                verbose=1
            ),
            keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True,
                verbose=1
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7,
                verbose=1
            ),
            keras.callbacks.TensorBoard(
                log_dir=log_dir,
                histogram_freq=1
            )
        ]

        # Train
        print(f"\nTraining for {epochs} epochs...")
        history = model.model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=epochs,
            callbacks=callbacks,
            verbose=1
        )

        # Save final model
        model.model.save(model_path)
        print(f"\nModel saved to {model_path}")
        print(f"Best model saved to {best_model_path}")

        # Save training history
        history_path = os.path.join(self.output_dir, f'detection_history_{timestamp}.json')
        
        # Convert numpy types to native Python types for JSON serialization
        serializable_history = {k: [float(v) for v in val] for k, val in history.history.items()}

        with open(history_path, 'w') as f:
            json.dump(serializable_history, f, indent=2)

        return model, history

    def train_classification_model(self, epochs: int = None, batch_size: int = None):
        """Train Stage 2: Classification model (multi-class)."""
        print("\n" + "=" * 70)
        print("TRAINING STAGE 2: COUGH CLASSIFICATION MODEL")
        print("=" * 70)

        epochs = epochs or classification_config.epochs
        batch_size = batch_size or classification_config.batch_size

        # Update config with actual number of classes
        classification_config.num_bins = len(self.dataset.label_to_name)
        classification_config.bin_names = [
            self.dataset.label_to_name[i]
            for i in range(len(self.dataset.label_to_name))
        ]

        print(f"\nNumber of classes: {classification_config.num_bins}")
        print(f"Class names: {classification_config.bin_names}")

        # Create datasets
        print("\nPreparing datasets...")
        train_ds = self.dataset.create_tf_dataset(
            self.splits['train'],
            batch_size=batch_size,
            shuffle=True,
            augment=True
        )

        val_ds = self.dataset.create_tf_dataset(
            self.splits['val'],
            batch_size=batch_size,
            shuffle=False,
            augment=False
        )

        # Convert labels to one-hot
        train_ds = train_ds.map(
            lambda x, y: (x, tf.one_hot(y, depth=classification_config.num_bins))
        )
        val_ds = val_ds.map(
            lambda x, y: (x, tf.one_hot(y, depth=classification_config.num_bins))
        )

        # Create model
        print("\nBuilding model...")
        model = CoughClassificationModel()
        model.compile()
        print(model.summary())

        # Callbacks
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = os.path.join(self.output_dir, f'classification_model_{timestamp}.h5')
        best_model_path = os.path.join(self.output_dir, 'classification_model_best.h5')
        log_dir = os.path.join(self.output_dir, 'logs', 'classification', timestamp)

        callbacks = [
            keras.callbacks.ModelCheckpoint(
                best_model_path,
                monitor='val_loss',
                save_best_only=True,
                mode='min',
                verbose=1
            ),
            keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=7,
                min_lr=1e-7,
                verbose=1
            ),
            keras.callbacks.TensorBoard(
                log_dir=log_dir,
                histogram_freq=1
            )
        ]

        # Train
        print(f"\nTraining for {epochs} epochs...")
        history = model.model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=epochs,
            callbacks=callbacks,
            verbose=1
        )

        # Save final model
        model.model.save(model_path)
        print(f"\nModel saved to {model_path}")
        print(f"Best model saved to {best_model_path}")

        # Save training history
        history_path = os.path.join(self.output_dir, f'classification_history_{timestamp}.json')
        
        # Convert numpy types to native Python types for JSON serialization
        serializable_history = {k: [float(v) for v in val] for k, val in history.history.items()}

        with open(history_path, 'w') as f:
            json.dump(serializable_history, f, indent=2)

        # Save class names
        classes_path = os.path.join(self.output_dir, 'class_names.json')
        with open(classes_path, 'w') as f:
            json.dump(classification_config.bin_names, f, indent=2)
        print(f"Class names saved to {classes_path}")

        return model, history

    def evaluate_models(self, detection_model, classification_model):
        """Evaluate both models on test set."""
        print("\n" + "=" * 70)
        print("EVALUATION ON TEST SET")
        print("=" * 70)

        batch_size = 32

        # Detection evaluation
        print("\n[1] Detection Model:")
        converter = DetectionDatasetConverter(self.dataset)
        test_ds = converter.create_detection_dataset(
            self.splits['test'],
            batch_size=batch_size,
            shuffle=False,
            augment=False
        )

        detection_results = detection_model.model.evaluate(test_ds, verbose=1)
        print("\nDetection Results:")
        for metric, value in zip(detection_model.model.metrics_names, detection_results):
            print(f"  {metric}: {value:.4f}")

        # Classification evaluation
        print("\n[2] Classification Model:")
        test_ds = self.dataset.create_tf_dataset(
            self.splits['test'],
            batch_size=batch_size,
            shuffle=False,
            augment=False
        )

        test_ds = test_ds.map(
            lambda x, y: (x, tf.one_hot(y, depth=classification_config.num_bins))
        )

        classification_results = classification_model.model.evaluate(test_ds, verbose=1)
        print("\nClassification Results:")
        for metric, value in zip(classification_model.model.metrics_names, classification_results):
            print(f"  {metric}: {value:.4f}")


def main():
    parser = argparse.ArgumentParser(description='Train cough detection models')
    parser.add_argument('--data_dir', type=str, required=True,
                        help='Directory containing training data')
    parser.add_argument('--output_dir', type=str, default='hardware/AI/models',
                        help='Output directory for models')
    parser.add_argument('--stage', type=str, choices=['detection', 'classification', 'both'],
                        default='both', help='Which model to train')
    parser.add_argument('--epochs', type=int, default=None,
                        help='Number of epochs (overrides config)')
    parser.add_argument('--batch_size', type=int, default=None,
                        help='Batch size (overrides config)')
    parser.add_argument('--evaluate', action='store_true',
                        help='Evaluate on test set after training')

    args = parser.parse_args()

    # Create pipeline
    pipeline = TrainingPipeline(args.data_dir, args.output_dir)

    detection_model = None
    classification_model = None

    # Train models
    if args.stage in ['detection', 'both']:
        detection_model, _ = pipeline.train_detection_model(
            epochs=args.epochs,
            batch_size=args.batch_size
        )

    if args.stage in ['classification', 'both']:
        classification_model, _ = pipeline.train_classification_model(
            epochs=args.epochs,
            batch_size=args.batch_size
        )

    # Evaluate
    if args.evaluate and args.stage == 'both':
        pipeline.evaluate_models(detection_model, classification_model)

    print("\n" + "=" * 70)
    print("TRAINING COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    main()
