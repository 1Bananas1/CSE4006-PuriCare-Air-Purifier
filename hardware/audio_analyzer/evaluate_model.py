"""
Evaluate trained models on validation or test datasets.

This script loads a trained .h5 model and evaluates it on a specified dataset split.
"""
import os
import argparse
import numpy as np
import tensorflow as tf

# Handle Keras import for different TensorFlow versions
try:
    from tensorflow import keras
    from tensorflow.keras import models
except (ImportError, AttributeError):
    import keras
    from keras import models

from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_recall_fscore_support
)
import matplotlib.pyplot as plt
import seaborn as sns

from data_loader import CoughDataset, DetectionDatasetConverter
from config import audio_config


def load_model(model_path: str):
    """Load a trained Keras model from .h5 file."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    print(f"Loading model from {model_path}...")
    model = models.load_model(model_path)
    print(f"✓ Model loaded successfully!")
    print(f"  Input shape: {model.input_shape}")
    print(f"  Output shape: {model.output_shape}")

    return model


def evaluate_detection_model(
    model_path: str,
    data_dir: str,
    split: str = 'test',
    batch_size: int = 32,
    save_results: bool = True
):
    """
    Evaluate binary detection model (cough vs non-cough).

    Args:
        model_path: Path to .h5 model file
        data_dir: Directory containing dataset
        split: Which split to evaluate ('train', 'val', or 'test')
        batch_size: Batch size for evaluation
        save_results: Whether to save confusion matrix plot
    """
    print("=" * 70)
    print("EVALUATING DETECTION MODEL")
    print("=" * 70)

    # Load model
    model = load_model(model_path)

    # Load dataset
    print(f"\nLoading dataset from {data_dir}...")
    dataset = CoughDataset(
        data_dir=data_dir,
        window_size=1.5,
        sample_rate=audio_config.sample_rate,
        use_augmentation=False  # No augmentation for evaluation
    )

    # Load splits
    splits_path = os.path.join(os.path.dirname(model_path), 'data_splits.json')
    if os.path.exists(splits_path):
        splits = dataset.load_splits(splits_path)
    else:
        print("Warning: No saved splits found, creating new ones...")
        splits = dataset.split_data()

    if split not in splits:
        raise ValueError(f"Split '{split}' not found. Available: {list(splits.keys())}")

    # Create detection dataset converter
    converter = DetectionDatasetConverter(dataset)

    # Create TensorFlow dataset for evaluation
    print(f"\nCreating {split} dataset...")
    eval_dataset = converter.create_detection_dataset(
        splits[split],
        batch_size=batch_size,
        shuffle=False,
        augment=False
    )

    # Get true labels
    binary_labels = converter.get_binary_labels()
    y_true = np.array([binary_labels[i] for i in splits[split]])

    # Evaluate model
    print(f"\nEvaluating on {len(splits[split])} samples...")
    print("-" * 70)

    # Get predictions
    y_pred_proba = model.predict(eval_dataset, verbose=1)
    y_pred = (y_pred_proba > 0.5).astype(int).flatten()

    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average='binary'
    )

    # Print results
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)
    print(f"Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-Score:  {f1:.4f}")

    # Detailed classification report
    print("\n" + "-" * 70)
    print("Classification Report:")
    print("-" * 70)
    print(classification_report(
        y_true,
        y_pred,
        target_names=['Non-Cough', 'Cough'],
        digits=4
    ))

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    print("Confusion Matrix:")
    print(cm)
    print(f"  True Negatives:  {cm[0,0]}")
    print(f"  False Positives: {cm[0,1]}")
    print(f"  False Negatives: {cm[1,0]}")
    print(f"  True Positives:  {cm[1,1]}")

    # Save confusion matrix plot
    if save_results:
        output_dir = os.path.dirname(model_path)
        plot_path = os.path.join(output_dir, f'confusion_matrix_detection_{split}.png')

        plt.figure(figsize=(8, 6))
        sns.heatmap(
            cm,
            annot=True,
            fmt='d',
            cmap='Blues',
            xticklabels=['Non-Cough', 'Cough'],
            yticklabels=['Non-Cough', 'Cough']
        )
        plt.title(f'Detection Model - Confusion Matrix ({split.upper()} set)')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()
        plt.savefig(plot_path, dpi=150)
        print(f"\n✓ Confusion matrix saved to: {plot_path}")
        plt.close()

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'confusion_matrix': cm
    }


def evaluate_classification_model(
    model_path: str,
    data_dir: str,
    split: str = 'test',
    batch_size: int = 32,
    save_results: bool = True
):
    """
    Evaluate multi-class classification model.

    Args:
        model_path: Path to .h5 model file
        data_dir: Directory containing dataset
        split: Which split to evaluate ('train', 'val', or 'test')
        batch_size: Batch size for evaluation
        save_results: Whether to save confusion matrix plot
    """
    print("=" * 70)
    print("EVALUATING CLASSIFICATION MODEL")
    print("=" * 70)

    # Load model
    model = load_model(model_path)

    # Load dataset
    print(f"\nLoading dataset from {data_dir}...")
    dataset = CoughDataset(
        data_dir=data_dir,
        window_size=1.5,
        sample_rate=audio_config.sample_rate,
        use_augmentation=False
    )

    # Load splits
    splits_path = os.path.join(os.path.dirname(model_path), 'data_splits.json')
    if os.path.exists(splits_path):
        splits = dataset.load_splits(splits_path)
    else:
        print("Warning: No saved splits found, creating new ones...")
        splits = dataset.split_data()

    if split not in splits:
        raise ValueError(f"Split '{split}' not found. Available: {list(splits.keys())}")

    # Create TensorFlow dataset
    print(f"\nCreating {split} dataset...")
    eval_dataset = dataset.create_tf_dataset(
        splits[split],
        batch_size=batch_size,
        shuffle=False,
        augment=False
    )

    # Get true labels
    y_true = np.array([dataset.labels[i] for i in splits[split]])

    # Evaluate model
    print(f"\nEvaluating on {len(splits[split])} samples...")
    print("-" * 70)

    # Get predictions
    y_pred_proba = model.predict(eval_dataset, verbose=1)
    y_pred = np.argmax(y_pred_proba, axis=1)

    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)

    # Print results
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)
    print(f"Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")

    # Get class names
    class_names = [dataset.label_to_name[i] for i in range(len(dataset.label_to_name))]

    # Detailed classification report
    print("\n" + "-" * 70)
    print("Classification Report:")
    print("-" * 70)
    print(classification_report(
        y_true,
        y_pred,
        target_names=class_names,
        digits=4
    ))

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    print("\nConfusion Matrix:")
    print(cm)

    # Per-class accuracy
    print("\nPer-Class Accuracy:")
    for i, class_name in enumerate(class_names):
        class_mask = (y_true == i)
        if class_mask.sum() > 0:
            class_acc = (y_pred[class_mask] == i).sum() / class_mask.sum()
            print(f"  {class_name}: {class_acc:.4f} ({class_acc*100:.2f}%)")

    # Save confusion matrix plot
    if save_results:
        output_dir = os.path.dirname(model_path)
        plot_path = os.path.join(output_dir, f'confusion_matrix_classification_{split}.png')

        plt.figure(figsize=(10, 8))
        sns.heatmap(
            cm,
            annot=True,
            fmt='d',
            cmap='Blues',
            xticklabels=class_names,
            yticklabels=class_names
        )
        plt.title(f'Classification Model - Confusion Matrix ({split.upper()} set)')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.xticks(rotation=45, ha='right')
        plt.yticks(rotation=0)
        plt.tight_layout()
        plt.savefig(plot_path, dpi=150)
        print(f"\n✓ Confusion matrix saved to: {plot_path}")
        plt.close()

    return {
        'accuracy': accuracy,
        'confusion_matrix': cm,
        'class_names': class_names
    }


def main():
    parser = argparse.ArgumentParser(
        description='Evaluate trained cough detection models'
    )
    parser.add_argument(
        '--model_path',
        type=str,
        required=True,
        help='Path to .h5 model file'
    )
    parser.add_argument(
        '--data_dir',
        type=str,
        required=True,
        help='Directory containing dataset'
    )
    parser.add_argument(
        '--split',
        type=str,
        choices=['train', 'val', 'test'],
        default='test',
        help='Which dataset split to evaluate on'
    )
    parser.add_argument(
        '--model_type',
        type=str,
        choices=['detection', 'classification', 'auto'],
        default='auto',
        help='Type of model (auto-detect from filename)'
    )
    parser.add_argument(
        '--batch_size',
        type=int,
        default=32,
        help='Batch size for evaluation'
    )
    parser.add_argument(
        '--no_save',
        action='store_true',
        help='Do not save confusion matrix plots'
    )

    args = parser.parse_args()

    # Auto-detect model type from filename
    if args.model_type == 'auto':
        if 'detection' in args.model_path.lower():
            args.model_type = 'detection'
        elif 'classification' in args.model_path.lower():
            args.model_type = 'classification'
        else:
            print("Warning: Could not auto-detect model type from filename.")
            print("Please specify --model_type explicitly.")
            return

    # Evaluate model
    if args.model_type == 'detection':
        results = evaluate_detection_model(
            model_path=args.model_path,
            data_dir=args.data_dir,
            split=args.split,
            batch_size=args.batch_size,
            save_results=not args.no_save
        )
    else:  # classification
        results = evaluate_classification_model(
            model_path=args.model_path,
            data_dir=args.data_dir,
            split=args.split,
            batch_size=args.batch_size,
            save_results=not args.no_save
        )

    print("\n" + "=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
