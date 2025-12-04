"""
Download and integrate the Cough-Speech-Sneeze dataset from audEERING.

This script downloads the dataset using audb and organizes it into the
structure expected by the existing cough detection training pipeline.
"""
import os
import shutil
from pathlib import Path
from collections import defaultdict
import argparse

try:
    import audb
    import audiofile
except ImportError:
    print("Error: audb not installed. Please run:")
    print("  pip install audb audiofile")
    exit(1)


def download_audeering_dataset(
    output_dir: str = "hardware/AI/cough_dataset",
    version: str = None,
    sampling_rate: int = 16000,
    verbose: bool = True
):
    """
    Download Cough-Speech-Sneeze dataset from audEERING.

    Args:
        output_dir: Directory to organize the dataset
        version: Specific version to download (None = latest)
        sampling_rate: Target sampling rate (8000, 16000, or 44100)
        verbose: Print progress information
    """
    print("=" * 70)
    print("DOWNLOADING COUGH-SPEECH-SNEEZE DATASET")
    print("=" * 70)

    dataset_name = 'cough-speech-sneeze'

    try:
        # Get available versions
        if verbose:
            print(f"\nChecking available versions of '{dataset_name}'...")

        # Use audb.versions() to get list of available versions
        try:
            versions = audb.versions(dataset_name)
        except Exception as e:
            print(f"Error: Dataset '{dataset_name}' not found in audb.")
            print(f"Details: {e}")
            print("\nTrying to list all available datasets...")
            all_datasets = audb.available()

            # all_datasets is a DataFrame, get unique names
            if hasattr(all_datasets, 'index'):
                dataset_names = all_datasets.index.get_level_values(0).unique().tolist()
            else:
                dataset_names = list(all_datasets)

            print(f"Found {len(dataset_names)} datasets")

            # Search for cough-related datasets
            cough_datasets = [d for d in dataset_names if 'cough' in d.lower()]
            if cough_datasets:
                print("\nCough-related datasets found:")
                for ds in cough_datasets:
                    print(f"  - {ds}")
            return False

        if not versions:
            print(f"No versions available for '{dataset_name}'")
            return False

        if version is None:
            # Use audb.latest_version() or the last item in versions list
            try:
                version = audb.latest_version(dataset_name)
            except:
                version = versions[-1]  # Use latest version

        if verbose:
            print(f"Available versions: {versions}")
            print(f"Using version: {version}")

        # Download the dataset
        print(f"\nDownloading dataset (this may take a while)...")
        db = audb.load(
            dataset_name,
            version=version,
            format='wav',
            sampling_rate=sampling_rate,
            verbose=verbose
        )

        print(f"\n✓ Dataset downloaded successfully!")

        # Get dataset info
        print("\n" + "=" * 70)
        print("DATASET INFORMATION")
        print("=" * 70)

        files = db.files
        print(f"Total files: {len(files)}")

        # Organize into categories
        print("\n" + "=" * 70)
        print("ORGANIZING DATASET")
        print("=" * 70)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Create category directories
        categories = {
            'cough': output_path / 'cough',
            'speech': output_path / 'speech',
            'sneeze': output_path / 'sneeze',
            'silence': output_path / 'non_cough'  # Map silence to non_cough
        }

        for category_dir in categories.values():
            category_dir.mkdir(exist_ok=True)

        # Get labels/metadata from the database
        stats = defaultdict(int)
        
        print("Processing files from cache...")
        for file in files:
            try:
                # Use audb.load_media to get the absolute path to the cached file.
                file_path = audb.load_media(
                    dataset_name, 
                    file, 
                    version=version, 
                    format='wav', 
                    sampling_rate=sampling_rate,
                    verbose=False # Reduce noise
                )

                # Infer label from filename/path, as db.get() is unreliable
                path_lower = str(file).lower()
                if 'cough' in path_lower:
                    label = 'cough'
                elif 'speech' in path_lower or 'speak' in path_lower:
                    label = 'speech'
                elif 'sneeze' in path_lower:
                    label = 'sneeze'
                elif 'silence' in path_lower or 'noise' in path_lower:
                    label = 'silence'
                else:
                    label = 'unknown'

                # Map label to category directory
                if label in categories:
                    dest_dir = categories[label]
                else:
                    if verbose:
                        print(f"Warning: Unknown label '{label}' for file {file}, skipping...")
                    stats['skipped'] += 1
                    continue

                # Copy file
                dest_file = dest_dir / Path(file).name

                # Handle duplicate filenames
                if dest_file.exists():
                    stem = dest_file.stem
                    suffix = dest_file.suffix
                    counter = 1
                    while dest_file.exists():
                        dest_file = dest_dir / f"{stem}_{counter}{suffix}"
                        counter += 1

                shutil.copy2(file_path, dest_file)

                # Update stats
                category_name = dest_dir.name
                stats[category_name] += 1

                if verbose and sum(stats.values()) % 200 == 0:
                    print(f"  Processed {sum(stats.values())} files...")

            except Exception as e:
                if verbose:
                    print(f"Error processing file {file}: {e}")
                stats['errors'] += 1

        # Print statistics
        print("\n" + "=" * 70)
        print("ORGANIZATION COMPLETE")
        print("=" * 70)

        for category, count in sorted(stats.items()):
            print(f"  {category}: {count} files")

        total = sum(v for k, v in stats.items() if k not in ['skipped', 'errors'])
        print(f"\n  Total organized: {total} files")

        if stats.get('skipped', 0) > 0:
            print(f"  Skipped: {stats['skipped']} files")
        if stats.get('errors', 0) > 0:
            print(f"  Errors: {stats['errors']} files")

        print("=" * 70)
        print(f"\n✓ Dataset ready at: {output_dir}")
        print("\nYou can now train your models with:")
        print(f"  python train.py --data_dir {output_dir} --stage both")

        return True

    except Exception as e:
        print(f"\nError downloading dataset: {e}")
        print("\nTroubleshooting:")
        print("1. Check your internet connection")
        print("2. Verify the dataset name is correct")
        print("3. Try listing available datasets with:")
        print("   python -c \"import audb; df = audb.available(); print(df.index.get_level_values(0).unique().tolist())\"")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Download Cough-Speech-Sneeze dataset from audEERING'
    )
    parser.add_argument(
        '--output_dir',
        type=str,
        default='hardware/AI/cough_dataset',
        help='Output directory for organized dataset'
    )
    parser.add_argument(
        '--version',
        type=str,
        default=None,
        help='Specific version to download (default: latest)'
    )
    parser.add_argument(
        '--sampling_rate',
        type=int,
        default=16000,
        choices=[8000, 16000, 44100],
        help='Target sampling rate'
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Reduce output verbosity'
    )

    args = parser.parse_args()

    success = download_audeering_dataset(
        output_dir=args.output_dir,
        version=args.version,
        sampling_rate=args.sampling_rate,
        verbose=not args.quiet
    )

    if success:
        print("\n✓ Setup complete! Next steps:")
        print("  1. Review the organized dataset")
        print("  2. Train your models:")
        print(f"     python train.py --data_dir {args.output_dir} --stage both")
        print("  3. Run live detection:")
        print("     python live_detection.py")
    else:
        print("\n✗ Dataset download failed. See errors above.")
        exit(1)


if __name__ == "__main__":
    main()
