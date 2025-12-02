"""
Main entry point for the simulator.

Run with: python -m simulator
"""
import argparse
from .core.device import AirPurifierSimulator
from .config.settings import settings


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Air Purifier Simulator - Production Version"
    )
    parser.add_argument(
        "--device-id",
        type=str,
        help=f"Device ID (default: {settings.device_id})"
    )

    args = parser.parse_args()

    # Create and run simulator
    simulator = AirPurifierSimulator(
        device_id=args.device_id if args.device_id else settings.device_id
    )
    simulator.run()


if __name__ == "__main__":
    main()
