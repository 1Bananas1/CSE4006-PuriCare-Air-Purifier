"""
Interactive CLI Controller for Air Purifier Simulator
Run this while the simulator is running to send control commands.
"""
import requests
import os
from dotenv import load_dotenv
import sys
import time

# Load environment
load_dotenv()
API_URL = os.getenv('API_URL', '').replace('/sensor-data', '')
DEVICE_ID = os.getenv('DEVICE_ID')

def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """Print the control panel header."""
    print("=" * 70)
    print("🎮 AIR PURIFIER CONTROL PANEL")
    print("=" * 70)
    print(f"Device ID: {DEVICE_ID}")
    print(f"Backend: {API_URL}")
    print("=" * 70)

def get_device_status():
    """Fetch current device status from backend."""
    try:
        url = f"{API_URL}/api/control/{DEVICE_ID}/status"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            result = response.json()
            # Handle nested status object
            return result.get('status', result)
        else:
            return None
    except Exception as e:
        print(f"⚠️  Error fetching status: {e}")
        return None

def send_control_command(command_type, value):
    """Send a control command to the backend."""
    try:
        # Map command types to endpoints and payload formats
        endpoint_map = {
            'power': ('power', {'on': value}),
            'fan_speed': ('fan-speed', {'speed': value}),
            'auto_mode': ('auto-mode', {'enabled': value}),
            'sensitivity': ('sensitivity', {'level': value})
        }

        if command_type not in endpoint_map:
            print(f"❌ Unknown command type: {command_type}")
            return False

        endpoint, payload = endpoint_map[command_type]
        url = f"{API_URL}/api/control/{DEVICE_ID}/{endpoint}"

        response = requests.post(url, json=payload, timeout=5)

        if response.status_code == 200:
            print(f"✅ Command sent: {command_type} = {value}")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Connection Error: Cannot reach backend at {API_URL}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def print_current_status(status):
    """Print current device status."""
    if not status:
        print("\n⚠️  Could not fetch device status")
        return

    print("\n📊 CURRENT STATUS:")
    print("-" * 70)
    print(f"  Power:       {'🟢 ON' if status.get('online', False) else '🔴 OFF'}")
    print(f"  Fan Speed:   {status.get('fanSpeed', 0)}/10")
    print(f"  Auto Mode:   {'✅ ENABLED' if status.get('autoMode', False) else '❌ DISABLED'}")

    # Handle sensitivity mapping
    sensitivity = status.get('sensitivity', 'medium')
    if isinstance(sensitivity, int):
        sensitivity_map = {0: "low", 1: "medium", 2: "high"}
        sensitivity = sensitivity_map.get(sensitivity, "medium")

    print(f"  Sensitivity: {sensitivity.upper()}")
    print("-" * 70)

def print_menu():
    """Print the control menu."""
    print("\n🎮 CONTROLS:")
    print("-" * 70)
    print("  [1] Toggle Power ON/OFF")
    print("  [2] Set Fan Speed (0-10)")
    print("  [3] Toggle Auto Mode")
    print("  [4] Set Sensitivity (low/medium/high)")
    print("  [5] Quick Modes")
    print("  [R] Refresh Status")
    print("  [Q] Quit")
    print("-" * 70)

def quick_modes_menu():
    """Display and handle quick mode selections."""
    print("\n⚡ QUICK MODES:")
    print("-" * 70)
    print("  [1] Sleep Mode    (Fan: 2, Auto: OFF)")
    print("  [2] Eco Mode      (Fan: 3, Auto: ON, Sensitivity: Low)")
    print("  [3] Normal Mode   (Fan: 5, Auto: ON, Sensitivity: Medium)")
    print("  [4] Turbo Mode    (Fan: 10, Auto: OFF)")
    print("  [5] Smart Mode    (Fan: 5, Auto: ON, Sensitivity: High)")
    print("  [B] Back to Main Menu")
    print("-" * 70)

    choice = input("\nSelect quick mode: ").strip().upper()

    if choice == '1':  # Sleep Mode
        send_control_command('auto_mode', False)
        time.sleep(0.2)
        send_control_command('fan_speed', 2)
        send_control_command('power', True)
        print("😴 Sleep Mode activated")

    elif choice == '2':  # Eco Mode
        send_control_command('sensitivity', 'low')
        time.sleep(0.2)
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("🌱 Eco Mode activated")

    elif choice == '3':  # Normal Mode
        send_control_command('sensitivity', 'medium')
        time.sleep(0.2)
        send_control_command('fan_speed', 5)
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("✅ Normal Mode activated")

    elif choice == '4':  # Turbo Mode
        send_control_command('auto_mode', False)
        time.sleep(0.2)
        send_control_command('fan_speed', 10)
        send_control_command('power', True)
        print("🚀 Turbo Mode activated")

    elif choice == '5':  # Smart Mode
        send_control_command('sensitivity', 'high')
        time.sleep(0.2)
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("🧠 Smart Mode activated")

def main():
    """Main control loop."""
    if not API_URL or not DEVICE_ID:
        print("❌ Error: API_URL and DEVICE_ID must be set in .env file")
        sys.exit(1)

    while True:
        clear_screen()
        print_header()

        # Fetch and display current status
        status = get_device_status()
        print_current_status(status)

        # Show menu
        print_menu()

        # Get user input
        choice = input("\nEnter command: ").strip().upper()

        if choice == 'Q':
            print("\n👋 Exiting control panel...")
            break

        elif choice == 'R':
            continue  # Refresh by reloading the loop

        elif choice == '1':  # Toggle Power
            if status and status.get('online', False):
                send_control_command('power', False)
            else:
                send_control_command('power', True)
            time.sleep(1)

        elif choice == '2':  # Set Fan Speed
            try:
                speed = int(input("Enter fan speed (0-10): "))
                if 0 <= speed <= 10:
                    # Turn on power if setting speed > 0
                    if speed > 0:
                        send_control_command('power', True)
                        time.sleep(0.2)
                    send_control_command('fan_speed', speed)
                else:
                    print("❌ Invalid speed. Must be 0-10")
                time.sleep(1)
            except ValueError:
                print("❌ Invalid input. Please enter a number.")
                time.sleep(1)

        elif choice == '3':  # Toggle Auto Mode
            if status:
                new_auto_mode = not status.get('autoMode', False)
                send_control_command('auto_mode', new_auto_mode)
            time.sleep(1)

        elif choice == '4':  # Set Sensitivity
            print("\nSensitivity Options:")
            print("  [1] Low")
            print("  [2] Medium")
            print("  [3] High")

            sens_choice = input("Select sensitivity: ").strip()

            if sens_choice == '1':
                send_control_command('sensitivity', 'low')
            elif sens_choice == '2':
                send_control_command('sensitivity', 'medium')
            elif sens_choice == '3':
                send_control_command('sensitivity', 'high')
            else:
                print("❌ Invalid choice")
            time.sleep(1)

        elif choice == '5':  # Quick Modes
            quick_modes_menu()
            input("\nPress Enter to continue...")

        else:
            print("❌ Invalid command")
            time.sleep(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Control panel stopped by user")
        sys.exit(0)
