"""
Air Purifier Simulator with WebSocket Control
Bidirectional communication: sends sensor data AND receives control commands
"""

import requests
import time
import random
import math
import json
from datetime import datetime
from typing import Dict
import sys
import socketio
import threading

# Socket.io client
sio = socketio.Client()



# =============
# Get .env 
# =============
from dotenv import load_dotenv
import os
load_dotenv()
API_URL = os.getenv('API_URL')
DEVICE_ID = os.getenv('DEVICE_ID')
WEBSOCKET_URL = os.getenv('WEBSOCKET_URL')
UPDATE_INTERVAL = int(os.getenv('UPDATE_INTERVAL', '300'))


SENSOR_RANGES = {
    "RH": {"min": 30, "max": 70, "unit": "%"},
    "CO": {"min": 0, "max": 9, "unit": "ppm"},
    "CO2": {"min": 400, "max": 2000, "unit": "ppm"},
    "NO2": {"min": 0, "max": 100, "unit": "ppb"},
    "PM10": {"min": 0, "max": 150, "unit": "µg/m³"},
    "PM25": {"min": 0, "max": 100, "unit": "µg/m³"},
    "TEMP": {"min": 18, "max": 28, "unit": "°C"},
    "TVOC": {"min": 0, "max": 1000, "unit": "ppb"},
}

# ============================================
# SIMULATOR CLASS
# ============================================

class AirPurifierSimulator:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.iteration = 0
        self.websocket_connected = False

        # Sensor values
        self.sensors = {
            "RH": 50.0, "CO": 0.5, "CO2": 450.0, "NO2": 10.0,
            "PM10": 20.0, "PM25": 10.0, "TEMP": 22.0, "TVOC": 100.0,
        }

        # Device state (can be controlled remotely)
        self.purifier_on = True
        self.fan_speed = 3  # 0-10
        self.auto_mode = True
        self.sensitivity = "medium"  # low, medium, high

        # Environmental state
        self.occupancy = True
        self.cooking = False
        self.window_open = False

        # Outdoor air quality (fetched from backend)
        self.outdoor_aqi = None
        self.outdoor_pm25 = None
        self.outdoor_pm10 = None
        self.outdoor_no2 = None
        self.station_city = None

    def getDeviceInfo(self):
        pass

    def fetch_outdoor_aqi(self):
        """Fetch outdoor AQI data from backend station cache"""
        try:
            # Get device info to find station ID
            station_idx = os.getenv('STATION_IDX')

            if not station_idx:
                print('No station found in .env file')
                self._use_default_outdoor_values()
                return
            base_url = API_URL.replace('/api/sensor-data', '')
            station_url = f"{base_url}/api/devices/stations/{station_idx}"

            print(f"📡 Fetching outdoor data from: {station_url}")

            response = requests.get(
            station_url,
            headers={
                "Content-Type": "application/json"
            },
            timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                self.outdoor_aqi = data.get('aqi')
                self.outdoor_pm25 = data.get('pm25')
                self.outdoor_pm10 = data.get('pm10')
                self.outdoor_no2 = data.get('no2')
                print(f"✅ Outdoor AQI data fetched successfully!")
                print(f"   City: {self.station_city}")
                print(f"   AQI: {self.outdoor_aqi}")
                print(f"   PM2.5: {self.outdoor_pm25} µg/m³")
                print(f"   PM10: {self.outdoor_pm10} µg/m³")
                print(f"   NO2: {self.outdoor_no2} ppb")
            elif response.status_code == 401:
                print(f"❌ Authentication failed: Invalid token")
                self._use_default_outdoor_values()
            elif response.status_code == 404:
                print(f"❌ Station {station_idx} not found")
                self._use_default_outdoor_values()
            else:
                print(f"❌ Error fetching station data: {response.status_code}")
                print(f"   Response: {response.text}")
                self._use_default_outdoor_values()
            
            

        except requests.exceptions.ConnectionError:
            print(f"❌ Connection Error: Cannot reach backend")
            self._use_default_outdoor_values()
        except requests.exceptions.Timeout:
            print(f"❌ Timeout: Backend took too long to respond")
            self._use_default_outdoor_values()
        except Exception as error:
            print(f"⚠️  Could not fetch outdoor AQI: {error}")
            self._use_default_outdoor_values()

    def _use_default_outdoor_values(self):
        """Use default outdoor pollution values"""
        self.outdoor_pm25 = 35.0
        self.outdoor_pm10 = 50.0
        self.outdoor_no2 = 40.0
        self.outdoor_aqi = 100
        self.station_city = "Default"

    def update_environmental_state(self):
        """Randomly trigger environmental events"""
        if random.random() < 0.1:
            self.cooking = True
            print("🍳 Cooking event started")
        elif self.cooking and random.random() < 0.3:
            self.cooking = False
            print("✅ Cooking event ended")

        if random.random() < 0.05:
            self.window_open = not self.window_open
            status = 'opened' if self.window_open else 'closed'
            outdoor_info = ""
            if self.window_open and self.outdoor_pm25:
                outdoor_info = f" (outdoor PM2.5: {self.outdoor_pm25:.1f})"
            print(f"🪟 Window {status}{outdoor_info}")

        hour = datetime.now().hour
        self.occupancy = random.random() < (0.3 if 9 <= hour <= 17 else 0.8)

    def simulate_purifier_effect(self):
        """Simulate air purifier reducing pollutants"""
        if not self.purifier_on or self.fan_speed == 0:
            return

        reduction_rate = 0.05 * self.fan_speed

        self.sensors["PM25"] *= (1 - reduction_rate)
        self.sensors["PM10"] *= (1 - reduction_rate)
        self.sensors["TVOC"] *= (1 - reduction_rate * 0.5)

        self.sensors["PM25"] = max(5.0, self.sensors["PM25"])
        self.sensors["PM10"] = max(8.0, self.sensors["PM10"])
        self.sensors["TVOC"] = max(50.0, self.sensors["TVOC"])

    def update_sensors(self):
        """Generate realistic sensor readings"""
        hour = datetime.now().hour
        temp_cycle = math.sin((hour - 6) * math.pi / 12) * 2
        self.sensors["TEMP"] = 22.0 + temp_cycle + random.gauss(0, 0.3)

        self.sensors["RH"] += random.gauss(0, 1)
        self.sensors["RH"] = max(30, min(70, self.sensors["RH"]))

        if self.occupancy:
            self.sensors["CO2"] += random.uniform(10, 30)
        else:
            self.sensors["CO2"] -= random.uniform(5, 15)

        if self.window_open:
            self.sensors["CO2"] -= random.uniform(20, 50)

        self.sensors["CO2"] = max(400, min(2000, self.sensors["CO2"]))

        if self.cooking:
            self.sensors["PM25"] += random.uniform(5, 15)
            self.sensors["PM10"] += random.uniform(8, 20)
            self.sensors["CO"] += random.uniform(0.5, 2.0)
            self.sensors["NO2"] += random.uniform(5, 15)
            self.sensors["TVOC"] += random.uniform(50, 150)

        if self.window_open:
            # When window is open, indoor air trends toward outdoor air
            if self.outdoor_pm25 is not None:
                # Indoor PM2.5 moves toward outdoor PM2.5
                outdoor_influence = 0.15  # 15% influence per update
                self.sensors["PM25"] += (self.outdoor_pm25 - self.sensors["PM25"]) * outdoor_influence
            else:
                # No outdoor data - assume clean outdoor air
                self.sensors["PM25"] *= 0.95

            if self.outdoor_pm10 is not None:
                self.sensors["PM10"] += (self.outdoor_pm10 - self.sensors["PM10"]) * 0.15
            else:
                self.sensors["PM10"] *= 0.95

            if self.outdoor_no2 is not None:
                self.sensors["NO2"] += (self.outdoor_no2 - self.sensors["NO2"]) * 0.12
            else:
                self.sensors["NO2"] *= 0.9

            # CO and TVOC still decrease (ventilation effect)
            self.sensors["CO"] *= 0.9
            self.sensors["TVOC"] *= 0.93

        self.simulate_purifier_effect()

        self.sensors["PM25"] += random.gauss(0, 2)
        self.sensors["PM10"] += random.gauss(0, 3)
        self.sensors["CO"] += random.gauss(0, 0.1)
        self.sensors["NO2"] += random.gauss(0, 2)
        self.sensors["TVOC"] += random.gauss(0, 10)

        # Auto mode logic
        if self.auto_mode:
            if self.sensors["PM25"] > 35:
                self.purifier_on = True
                self.fan_speed = min(10, int(self.sensors["PM25"] / 10))
            elif self.sensors["PM25"] < 15:
                self.fan_speed = max(0, self.fan_speed - 1)
                if self.fan_speed == 0:
                    self.purifier_on = False

        for sensor, ranges in SENSOR_RANGES.items():
            self.sensors[sensor] = max(ranges["min"], min(ranges["max"], self.sensors[sensor]))

    def get_sensor_readings(self) -> Dict[str, float]:
        """Get current sensor readings"""
        return {sensor: round(value, 2) for sensor, value in self.sensors.items()}

    def handle_control_command(self, data):
        """Handle control commands from WebSocket"""
        cmd_type = data.get('type')
        value = data.get('value')

        print(f"\n🎮 CONTROL COMMAND RECEIVED")
        print(f"   Type: {cmd_type}")
        print(f"   Value: {value}")

        if cmd_type == 'fan_speed':
            self.fan_speed = value
            print(f"   ✅ Fan speed set to {value}")

        elif cmd_type == 'auto_mode':
            self.auto_mode = value
            print(f"   ✅ Auto mode {'enabled' if value else 'disabled'}")

        elif cmd_type == 'sensitivity':
            self.sensitivity = value
            print(f"   ✅ Sensitivity set to {value}")

        elif cmd_type == 'power':
            self.purifier_on = value
            if not value:
                self.fan_speed = 0
            print(f"   ✅ Power {'ON' if value else 'OFF'}")

    def send_data(self):
        """Send sensor data to backend"""
        self.iteration += 1
        self.update_environmental_state()
        self.update_sensors()

        payload = {
            "deviceId": self.device_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "sensors": self.get_sensor_readings()
        }

        print(f"\n{'='*60}")
        print(f"📊 Update #{self.iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        print(f"Device: {self.device_id}")
        print(f"Purifier: {'ON' if self.purifier_on else 'OFF'} | Fan Speed: {self.fan_speed}/10")
        print(f"Auto Mode: {'ENABLED' if self.auto_mode else 'DISABLED'} | Sensitivity: {self.sensitivity}")
        print(f"WebSocket: {'🟢 Connected' if self.websocket_connected else '🔴 Disconnected'}")
        print(f"\n📡 Sensor Readings:")

        for sensor, value in self.get_sensor_readings().items():
            unit = SENSOR_RANGES[sensor]["unit"]
            if sensor == "PM25":
                if value <= 15:
                    quality = "Good ✅"
                elif value <= 35:
                    quality = "Moderate ⚠️"
                elif value <= 75:
                    quality = "Unhealthy 🚨"
                else:
                    quality = "Very Unhealthy ☠️"
                print(f"  {sensor:6} {value:7.2f} {unit:8} [{quality}]")
            else:
                print(f"  {sensor:6} {value:7.2f} {unit}")

        try:
            response = requests.post(
                API_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code == 201:
                result = response.json()
                print(f"\n✅ Data sent successfully!")

                if result.get("alertsGenerated", 0) > 0:
                    print(f"\n🚨 ALERTS GENERATED: {result['alertsGenerated']}")
                    for alert in result.get("alerts", []):
                        severity_emoji = {
                            "low": "ℹ️",
                            "medium": "⚠️",
                            "high": "🚨",
                            "critical": "☠️"
                        }.get(alert["severity"], "⚠️")
                        print(f"  {severity_emoji} [{alert['severity'].upper()}] {alert['message']}")
                        print(f"     Value: {alert['sensorValue']:.2f}")
            else:
                print(f"\n❌ Error: {response.status_code} - {response.text}")

        except requests.exceptions.ConnectionError:
            print(f"\n❌ Connection Error: Cannot reach backend at {API_URL}")
        except requests.exceptions.Timeout:
            print(f"\n❌ Timeout: Backend took too long to respond")
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")

    def connect_websocket(self):
        """Connect to WebSocket server"""
        @sio.event
        def connect():
            print("🔌 WebSocket connected!")
            self.websocket_connected = True
            sio.emit('join_device', self.device_id)

        @sio.event
        def disconnect():
            print("🔌 WebSocket disconnected")
            self.websocket_connected = False

        @sio.event
        def joined_device(data):
            print(f"✅ Joined device room: {data['deviceId']}")

        @sio.event
        def device_control(data):
            self.handle_control_command(data)

        try:
            sio.connect(WEBSOCKET_URL, auth={'token': 'simulator'})
        except Exception as e:
            print(f"⚠️  WebSocket connection failed: {e}")
            print(f"   Continuing in HTTP-only mode...")

    def run(self):
        """Main simulation loop"""
        print("="*60)
        print("🌀 Air Purifier Simulator with WebSocket Control")
        print("="*60)
        print(f"Device ID: {self.device_id}")
        print(f"Backend API: {API_URL}")
        print(f"WebSocket: {WEBSOCKET_URL}")
        print(f"Update Interval: {UPDATE_INTERVAL} seconds ({UPDATE_INTERVAL/60:.1f} minutes)")
        print(f"\nFeatures:")
        print(f"  ✅ Sends sensor data every {UPDATE_INTERVAL/60:.1f} minutes")
        print(f"  ✅ Receives control commands via WebSocket")
        print(f"  ✅ Bidirectional communication")
        print(f"  ✅ Uses real outdoor AQI data for simulation")
        print(f"\nPress Ctrl+C to stop the simulator")
        print("="*60)

        # Fetch outdoor AQI data
        print("\n📡 Fetching outdoor AQI data...")
        self.fetch_outdoor_aqi()
        if self.outdoor_pm25:
            print(f"   Outdoor PM2.5: {self.outdoor_pm25:.1f} µg/m³")
            print(f"   Outdoor AQI: {self.outdoor_aqi}")
            print(f"   City: {self.station_city}")

        # Start auto mode by default
        self.auto_mode = True

        # Connect WebSocket
        self.connect_websocket()

        try:
            while True:
                self.send_data()
                print(f"\n⏳ Waiting {UPDATE_INTERVAL} seconds until next update...")
                time.sleep(UPDATE_INTERVAL)

        except KeyboardInterrupt:
            print("\n\n" + "="*60)
            print("🛑 Simulator stopped by user")
            print("="*60)
            if sio.connected:
                sio.disconnect()
            sys.exit(0)


# ============================================
# MAIN ENTRY POINT
# ============================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Air Purifier Simulator with WebSocket")
    parser.add_argument("--device-id", type=str, default=DEVICE_ID)
    parser.add_argument("--api-url", type=str, default="https://puricare-backend-502dc03d011c.herokuapp.com/api/sensor-data")
    parser.add_argument("--ws-url", type=str, default="https://puricare-backend-502dc03d011c.herokuapp.com")
    parser.add_argument("--interval", type=int, default=300)

    args = parser.parse_args()

    API_URL = args.api_url
    WEBSOCKET_URL = args.ws_url
    DEVICE_ID = args.device_id
    UPDATE_INTERVAL = args.interval

    simulator = AirPurifierSimulator(DEVICE_ID)
    simulator.run()
