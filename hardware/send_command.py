"""
Quick Command Sender for Air Purifier
Send single commands from the command line.

Usage examples:
    python hardware/send_command.py power on
    python hardware/send_command.py power off
    python hardware/send_command.py fan 7
    python hardware/send_command.py auto on
    python hardware/send_command.py sensitivity high
    python hardware/send_command.py status
"""
import requests
import os
from dotenv import load_dotenv
import sys

# Load environment
load_dotenv()
API_URL = os.getenv('API_URL', '').replace('/sensor-data', '')
DEVICE_ID = os.getenv('DEVICE_ID')

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

        print(f"📤 Sending command: {command_type} = {value}")

        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            print(f"✅ Command sent successfully!")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Connection Error: Cannot reach backend at {API_URL}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def get_device_status():
    """Fetch and display device status."""
    try:
        url = f"{API_URL}/api/control/{DEVICE_ID}/status"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            result = response.json()
            status = result.get('status', result)  # Handle nested status object

            print("=" * 60)
            print(f"📊 DEVICE STATUS: {DEVICE_ID}")
            print("=" * 60)
            print(f"Power:       {'🟢 ON' if status.get('online', False) else '🔴 OFF'}")
            print(f"Fan Speed:   {status.get('fanSpeed', 0)}/10")
            print(f"Auto Mode:   {'✅ ENABLED' if status.get('autoMode', False) else '❌ DISABLED'}")

            # Handle sensitivity
            sensitivity = status.get('sensitivity', 'medium')
            if isinstance(sensitivity, int):
                sensitivity_map = {0: "low", 1: "medium", 2: "high"}
                sensitivity = sensitivity_map.get(sensitivity, "medium")

            print(f"Sensitivity: {sensitivity.upper()}")

            if status.get('lastSeen'):
                print(f"Last Seen:   {status['lastSeen']}")

            print("=" * 60)
            return True
        else:
            print(f"❌ Error fetching status: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def print_help():
    """Print usage help."""
    print("""
🎮 Air Purifier Command Sender

USAGE:
    python hardware/send_command.py <command> [value]

COMMANDS:
    status                      - Show device status
    power <on|off>             - Turn purifier on/off
    fan <0-10>                 - Set fan speed (0-10)
    auto <on|off>              - Enable/disable auto mode
    sensitivity <low|med|high> - Set sensitivity level

QUICK MODES:
    sleep                      - Sleep mode (fan: 2, auto: off)
    eco                        - Eco mode (auto: on, sensitivity: low)
    normal                     - Normal mode (fan: 5, auto: on)
    turbo                      - Turbo mode (fan: 10, auto: off)
    smart                      - Smart mode (auto: on, sensitivity: high)

EXAMPLES:
    python hardware/send_command.py power on
    python hardware/send_command.py fan 7
    python hardware/send_command.py auto on
    python hardware/send_command.py sensitivity high
    python hardware/send_command.py turbo
    python hardware/send_command.py status
    """)

def main():
    if not API_URL or not DEVICE_ID:
        print("❌ Error: API_URL and DEVICE_ID must be set in .env file")
        sys.exit(1)

    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    command = sys.argv[1].lower()

    # Handle status command
    if command == 'status':
        get_device_status()
        return

    # Handle help
    if command in ['help', '-h', '--help']:
        print_help()
        return

    # Handle quick modes
    if command == 'sleep':
        send_control_command('auto_mode', False)
        send_control_command('fan_speed', 2)
        send_control_command('power', True)
        print("😴 Sleep Mode activated")
        return

    elif command == 'eco':
        send_control_command('sensitivity', 'low')
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("🌱 Eco Mode activated")
        return

    elif command == 'normal':
        send_control_command('sensitivity', 'medium')
        send_control_command('fan_speed', 5)
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("✅ Normal Mode activated")
        return

    elif command == 'turbo':
        send_control_command('auto_mode', False)
        send_control_command('fan_speed', 10)
        send_control_command('power', True)
        print("🚀 Turbo Mode activated")
        return

    elif command == 'smart':
        send_control_command('sensitivity', 'high')
        send_control_command('auto_mode', True)
        send_control_command('power', True)
        print("🧠 Smart Mode activated")
        return

    # Handle regular commands
    if len(sys.argv) < 3:
        print(f"❌ Error: '{command}' requires a value")
        print_help()
        sys.exit(1)

    value = sys.argv[2].lower()

    # Parse command and value
    if command == 'power':
        if value in ['on', '1', 'true']:
            send_control_command('power', True)
        elif value in ['off', '0', 'false']:
            send_control_command('power', False)
        else:
            print(f"❌ Invalid power value: {value}. Use 'on' or 'off'")

    elif command == 'fan':
        try:
            fan_speed = int(value)
            if 0 <= fan_speed <= 10:
                if fan_speed > 0:
                    send_control_command('power', True)
                send_control_command('fan_speed', fan_speed)
            else:
                print("❌ Fan speed must be 0-10")
        except ValueError:
            print(f"❌ Invalid fan speed: {value}. Must be a number 0-10")

    elif command == 'auto':
        if value in ['on', '1', 'true']:
            send_control_command('auto_mode', True)
        elif value in ['off', '0', 'false']:
            send_control_command('auto_mode', False)
        else:
            print(f"❌ Invalid auto mode value: {value}. Use 'on' or 'off'")

    elif command == 'sensitivity' or command == 'sens':
        if value in ['low', 'l', '0']:
            send_control_command('sensitivity', 'low')
        elif value in ['medium', 'med', 'm', '1']:
            send_control_command('sensitivity', 'medium')
        elif value in ['high', 'h', '2']:
            send_control_command('sensitivity', 'high')
        else:
            print(f"❌ Invalid sensitivity: {value}. Use 'low', 'medium', or 'high'")

    else:
        print(f"❌ Unknown command: {command}")
        print_help()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
        sys.exit(0)
