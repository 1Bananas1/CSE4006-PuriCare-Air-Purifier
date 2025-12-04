"""
Helper script to organize WAV files into dataset structure

This script helps you organize your cough WAV files from a GitHub repository
into the proper directory structure for training.
"""
import os
import shutil
from pathlib import Path
import argparse
from collections import defaultdict


def organize_dataset_interactive(source_dir: str, output_dir: str):
    """
    Interactive organization of WAV files into labeled directories.

    Allows you to manually categorize each file.
    """
    print("=" * 70)
    print("INTERACTIVE DATASET ORGANIZATION")
    print("=" * 70)

    source_path = Path(source_dir)
    output_path = Path(output_dir)

    if not source_path.exists():
        print(f"Error: Source directory not found: {source_dir}")
        return

    # Find all WAV files
    wav_files = list(source_path.rglob("*.wav"))
    print(f"\nFound {len(wav_files)} WAV files in {source_dir}")

    if len(wav_files) == 0:
        print("No WAV files found!")
        return

    # Get list of categories
    print("\n" + "=" * 70)
    print("DEFINE COUGH CATEGORIES/BINS")
    print("=" * 70)
    print("\nExamples:")
    print("  1. dry_cough, wet_cough, throat_clear, non_cough")
    print("  2. light_cough, moderate_cough, heavy_cough, non_cough")
    print("  3. cough_bin_0, cough_bin_1, cough_bin_2, non_cough")

    categories = []
    print("\nEnter category names (one per line, press Enter with empty line when done):")
    while True:
        category = input(f"  Category {len(categories) + 1}: ").strip()
        if not category:
            break
        categories.append(category)

    if len(categories) == 0:
        print("No categories entered!")
        return

    # Always add non_cough if not present
    if 'non_cough' not in categories:
        categories.append('non_cough')
        print("\nℹ️  Added 'non_cough' category automatically")

    print(f"\nCategories: {', '.join(categories)}")

    # Create output directories
    output_path.mkdir(parents=True, exist_ok=True)
    for category in categories:
        category_dir = output_path / category
        category_dir.mkdir(exist_ok=True)

    # Organize files
    print("\n" + "=" * 70)
    print("CATEGORIZING FILES")
    print("=" * 70)
    print("For each file, enter the number of its category:")
    for i, cat in enumerate(categories, 1):
        print(f"  {i}. {cat}")
    print("  s. Skip this file")
    print("  q. Quit")

    stats = defaultdict(int)

    for i, wav_file in enumerate(wav_files, 1):
        print(f"\n[{i}/{len(wav_files)}] {wav_file.name}")

        while True:
            choice = input("  Category: ").strip().lower()

            if choice == 'q':
                print("\nQuitting...")
                print_stats(stats, categories)
                return

            if choice == 's':
                stats['skipped'] += 1
                break

            try:
                category_idx = int(choice) - 1
                if 0 <= category_idx < len(categories):
                    category = categories[category_idx]

                    # Copy file
                    dest_file = output_path / category / wav_file.name

                    # Handle duplicate filenames
                    if dest_file.exists():
                        stem = dest_file.stem
                        suffix = dest_file.suffix
                        counter = 1
                        while dest_file.exists():
                            dest_file = output_path / category / f"{stem}_{counter}{suffix}"
                            counter += 1

                    shutil.copy2(wav_file, dest_file)
                    stats[category] += 1
                    break
                else:
                    print(f"  Invalid choice. Enter 1-{len(categories)}, s, or q")
            except ValueError:
                print(f"  Invalid choice. Enter 1-{len(categories)}, s, or q")

    print_stats(stats, categories)


def organize_dataset_automatic(source_dir: str, output_dir: str, category_mapping: dict):
    """
    Automatically organize files based on filename patterns.

    category_mapping: dict of {pattern: category}
    Example: {"dry": "dry_cough", "wet": "wet_cough", "noise": "non_cough"}
    """
    print("=" * 70)
    print("AUTOMATIC DATASET ORGANIZATION")
    print("=" * 70)

    source_path = Path(source_dir)
    output_path = Path(output_dir)

    if not source_path.exists():
        print(f"Error: Source directory not found: {source_dir}")
        return

    # Find all WAV files
    wav_files = list(source_path.rglob("*.wav"))
    print(f"\nFound {len(wav_files)} WAV files")

    # Create output directories
    output_path.mkdir(parents=True, exist_ok=True)
    categories = set(category_mapping.values())
    for category in categories:
        (output_path / category).mkdir(exist_ok=True)

    # Organize files
    stats = defaultdict(int)

    for wav_file in wav_files:
        filename = wav_file.name.lower()

        # Find matching pattern
        matched = False
        for pattern, category in category_mapping.items():
            if pattern.lower() in filename:
                dest_file = output_path / category / wav_file.name

                # Handle duplicates
                if dest_file.exists():
                    stem = dest_file.stem
                    suffix = dest_file.suffix
                    counter = 1
                    while dest_file.exists():
                        dest_file = output_path / category / f"{stem}_{counter}{suffix}"
                        counter += 1

                shutil.copy2(wav_file, dest_file)
                stats[category] += 1
                matched = True
                break

        if not matched:
            stats['unmatched'] += 1

    print_stats(stats, categories)


def print_stats(stats: dict, categories: list):
    """Print organization statistics"""
    print("\n" + "=" * 70)
    print("ORGANIZATION COMPLETE")
    print("=" * 70)

    for category in categories:
        count = stats.get(category, 0)
        print(f"  {category}: {count} files")

    if 'skipped' in stats:
        print(f"  Skipped: {stats['skipped']} files")
    if 'unmatched' in stats:
        print(f"  Unmatched: {stats['unmatched']} files")

    total = sum(stats.values())
    print(f"\n  Total: {total} files")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description='Organize WAV files into dataset structure for training'
    )
    parser.add_argument('source_dir', type=str,
                        help='Directory containing WAV files')
    parser.add_argument('--output_dir', type=str,
                        default='hardware/AI/cough_dataset',
                        help='Output directory for organized dataset')
    parser.add_argument('--mode', type=str, choices=['interactive', 'auto'],
                        default='interactive',
                        help='Organization mode')

    args = parser.parse_args()

    if args.mode == 'interactive':
        organize_dataset_interactive(args.source_dir, args.output_dir)

    else:  # auto mode
        print("Automatic mode requires editing this script to define patterns.")
        print("\nExample category mapping:")
        print("  category_mapping = {")
        print("    'dry': 'dry_cough',")
        print("    'wet': 'wet_cough',")
        print("    'noise': 'non_cough',")
        print("    'background': 'non_cough'")
        print("  }")
        print("\nEdit prepare_dataset.py and add your mapping, then run again.")


if __name__ == "__main__":
    main()
