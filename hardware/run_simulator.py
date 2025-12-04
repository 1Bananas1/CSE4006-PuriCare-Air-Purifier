"""
Convenience script to run the simulator.

Run with: python hardware/run_simulator.py
"""
from simulator.core.device import AirPurifierSimulator


def main():
    """Run the simulator."""
    simulator = AirPurifierSimulator()
    simulator.run()


if __name__ == "__main__":
    main()
