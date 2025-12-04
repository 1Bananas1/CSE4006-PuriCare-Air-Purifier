"""
Air Purifier Simulator - Core Device Logic
"""
import time
import random
import math
import sys
from datetime import datetime
from typing import Dict, Optional

from ..config.settings import settings
from ..config.constants import SENSOR_RANGES, PM25_THRESHOLDS
from ..models.sensor_data import SensorDataPayload
from ..models.commands import ControlCommand
from ..models.responses import OutdoorAQIData
from ..communication.http_client import HTTPClient
from ..communication.websocket_client import WebSocketClient
from ..communication.event_sender import EventSender

# Audio detection (optional)
try:
    from .audio_detector_wrapper import AudioDetectorWrapper, CoughEvent
    AUDIO_DETECTION_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Audio detection not available: {e}")
    AudioDetectorWrapper = None
    CoughEvent = None
    AUDIO_DETECTION_AVAILABLE = False


class AirPurifierSimulator:
    """Air Purifier Device Simulator with realistic sensor behavior."""

    def __init__(self, device_id: Optional[str] = None):
        """
        Initialize air purifier simulator.

        Args:
            device_id: Device ID (defaults to settings)
        """
        self.device_id = device_id or settings.device_id
        self.iteration = 0

        # Initialize sensor values
        self.sensors = {
            "RH": 50.0,
            "CO": 0.5,
            "CO2": 450.0,
            "NO2": 10.0,
            "PM10": 20.0,
            "PM25": 10.0,
            "TEMP": 22.0,
            "TVOC": 100.0,
        }

        # Device state (controllable) - will be fetched from API
        self.online = False
        self.fan_speed = 0  # 0-10
        self.auto_mode = False
        self.sensitivity = "medium"  # low, medium, high
        self.last_seen: Optional[str] = None  # Last seen timestamp from API

        # Aggressive mode (triggered by cough detection)
        self.aggressive_mode = False
        self.aggressive_mode_fan_boost = 3  # Additional fan speed in aggressive mode

        # Environmental state
        self.occupancy = True
        self.cooking = False
        self.window_open = False

        # Outdoor AQI data
        self.outdoor_data: Optional[OutdoorAQIData] = None

        # Communication clients
        self.http_client = HTTPClient()
        self.event_sender = EventSender()
        self.ws_client: Optional[WebSocketClient] = None

        if settings.enable_websocket:
            self.ws_client = WebSocketClient(
                device_id=self.device_id,
                on_command_callback=self.handle_control_command
            )

        # Audio detection
        self.audio_detector: Optional[AudioDetectorWrapper] = None
        self.audio_detection_enabled = AUDIO_DETECTION_AVAILABLE and settings.enable_audio_detection

        if self.audio_detection_enabled:
            try:
                self.audio_detector = AudioDetectorWrapper(
                    on_event_callback=self.handle_cough_event,
                    aggressive_threshold=settings.cough_threshold,
                    tracking_window_hours=settings.cough_tracking_window_hours
                )
                print("✅ Audio detection initialized")
            except Exception as e:
                print(f"⚠️  Could not initialize audio detection: {e}")
                self.audio_detection_enabled = False

    def fetch_device_settings(self):
        """Fetch device settings from backend API."""
        print("\n📡 Fetching device settings from backend...")

        device_status = self.http_client.fetch_device_status(self.device_id)

        if device_status:
            # Update ALL device state from API
            self.online = device_status.get('online', False)
            self.auto_mode = device_status.get('autoMode', False)
            self.fan_speed = device_status.get('fanSpeed', 0)

            # Map sensitivity (could be string or int)
            sensitivity_map = {0: "low", 1: "medium", 2: "high"}
            sensitivity_value = device_status.get('sensitivity', 1)

            if isinstance(sensitivity_value, int):
                self.sensitivity = sensitivity_map.get(sensitivity_value, "medium")
            else:
                self.sensitivity = sensitivity_value

            # Store last seen timestamp if available
            last_seen = device_status.get('lastSeen')
            if last_seen:
                self.last_seen = last_seen

            print(f"✅ Device settings initialized from API:")
            print(f"   Online: {self.online}")
            print(f"   Auto Mode: {self.auto_mode}")
            print(f"   Fan Speed: {self.fan_speed}")
            print(f"   Sensitivity: {self.sensitivity}")
            if last_seen:
                print(f"   Last Seen: {last_seen}")
        else:
            print("⚠️  Could not fetch device settings from API")
            print("   Using default values: Auto Mode OFF, Fan Speed 0")

    def fetch_outdoor_aqi(self):
        """Fetch outdoor AQI data from backend."""
        if not settings.enable_outdoor_aqi or not settings.station_idx:
            self._use_default_outdoor_values()
            return

        outdoor_data = self.http_client.fetch_outdoor_aqi()

        if outdoor_data:
            self.outdoor_data = outdoor_data
        else:
            self._use_default_outdoor_values()

    def _use_default_outdoor_values(self):
        """Use default outdoor pollution values."""
        self.outdoor_data = OutdoorAQIData(
            pm25=35.0,
            pm10=50.0,
            no2=40.0,
            aqi=100,
            cityName="Default"
        )

    def update_environmental_state(self):
        """Randomly trigger environmental events."""
        # Cooking events
        if random.random() < 0.1:
            self.cooking = True
            print("🍳 Cooking event started")
        elif self.cooking and random.random() < 0.3:
            self.cooking = False
            print("✅ Cooking event ended")

        # Window events
        if random.random() < 0.05:
            self.window_open = not self.window_open
            status = 'opened' if self.window_open else 'closed'
            outdoor_info = ""
            if self.window_open and self.outdoor_data and self.outdoor_data.pm25:
                outdoor_info = f" (outdoor PM2.5: {self.outdoor_data.pm25:.1f})"
            print(f"🪟 Window {status}{outdoor_info}")

        # Occupancy based on time of day
        hour = datetime.now().hour
        self.occupancy = random.random() < (0.3 if 9 <= hour <= 17 else 0.8)

    def simulate_purifier_effect(self):
        """Simulate air purifier reducing pollutants."""
        if not self.online or self.fan_speed == 0:
            return

        # Base reduction rate
        reduction_rate = 0.05 * self.fan_speed

        # Aggressive mode provides extra reduction
        if self.aggressive_mode:
            reduction_rate *= 1.5  # 50% more effective in aggressive mode

        self.sensors["PM25"] *= (1 - reduction_rate)
        self.sensors["PM10"] *= (1 - reduction_rate)
        self.sensors["TVOC"] *= (1 - reduction_rate * 0.5)

        # Minimum levels
        self.sensors["PM25"] = max(5.0, self.sensors["PM25"])
        self.sensors["PM10"] = max(8.0, self.sensors["PM10"])
        self.sensors["TVOC"] = max(50.0, self.sensors["TVOC"])

    def update_sensors(self):
        """Generate realistic sensor readings."""
        # Temperature cycle based on time of day
        hour = datetime.now().hour
        temp_cycle = math.sin((hour - 6) * math.pi / 12) * 2
        self.sensors["TEMP"] = 22.0 + temp_cycle + random.gauss(0, 0.3)

        # Humidity random walk
        self.sensors["RH"] += random.gauss(0, 1)
        self.sensors["RH"] = max(30, min(70, self.sensors["RH"]))

        # CO2 affected by occupancy
        if self.occupancy:
            self.sensors["CO2"] += random.uniform(10, 30)
        else:
            self.sensors["CO2"] -= random.uniform(5, 15)

        if self.window_open:
            self.sensors["CO2"] -= random.uniform(20, 50)

        self.sensors["CO2"] = max(400, min(2000, self.sensors["CO2"]))

        # Cooking increases pollutants
        if self.cooking:
            self.sensors["PM25"] += random.uniform(5, 15)
            self.sensors["PM10"] += random.uniform(8, 20)
            self.sensors["CO"] += random.uniform(0.5, 2.0)
            self.sensors["NO2"] += random.uniform(5, 15)
            self.sensors["TVOC"] += random.uniform(50, 150)

        # Window affects indoor air quality
        if self.window_open and self.outdoor_data:
            outdoor_influence = 0.15  # 15% influence per update

            if self.outdoor_data.pm25:
                self.sensors["PM25"] += (self.outdoor_data.pm25 - self.sensors["PM25"]) * outdoor_influence

            if self.outdoor_data.pm10:
                self.sensors["PM10"] += (self.outdoor_data.pm10 - self.sensors["PM10"]) * outdoor_influence

            if self.outdoor_data.no2:
                self.sensors["NO2"] += (self.outdoor_data.no2 - self.sensors["NO2"]) * 0.12

            # Ventilation effect
            self.sensors["CO"] *= 0.9
            self.sensors["TVOC"] *= 0.93

        # Apply purifier effect
        self.simulate_purifier_effect()

        # Add random noise
        self.sensors["PM25"] += random.gauss(0, 2)
        self.sensors["PM10"] += random.gauss(0, 3)
        self.sensors["CO"] += random.gauss(0, 0.1)
        self.sensors["NO2"] += random.gauss(0, 2)
        self.sensors["TVOC"] += random.gauss(0, 10)

        # Auto mode logic
        if self.auto_mode:
            if self.sensors["PM25"] > 35:
                self.online = True
                self.fan_speed = min(10, int(self.sensors["PM25"] / 10))
            elif self.sensors["PM25"] < 15:
                self.fan_speed = max(0, self.fan_speed - 1)
                if self.fan_speed == 0:
                    self.online = False

        # Clamp sensor values to valid ranges
        for sensor, ranges in SENSOR_RANGES.items():
            self.sensors[sensor] = max(ranges["min"], min(ranges["max"], self.sensors[sensor]))

    def get_sensor_readings(self) -> Dict[str, float]:
        """Get current sensor readings (rounded)."""
        return {sensor: round(value, 2) for sensor, value in self.sensors.items()}

    def handle_control_command(self, command: ControlCommand):
        """Handle control commands from WebSocket."""
        print(f"   ✅ Processing command: {command.type} = {command.value}")

        if command.type == 'fan_speed':
            self.fan_speed = int(command.value)
            print(f"   → Fan speed set to {self.fan_speed}")

        elif command.type == 'auto_mode':
            old_auto_mode = self.auto_mode
            self.auto_mode = bool(command.value)
            print(f"   → Auto mode {'enabled' if self.auto_mode else 'disabled'}")

            # Start/stop audio detection based on auto mode
            if self.auto_mode and not old_auto_mode:
                self._start_audio_detection()
            elif not self.auto_mode and old_auto_mode:
                self._stop_audio_detection()

        elif command.type == 'sensitivity':
            self.sensitivity = str(command.value)
            print(f"   → Sensitivity set to {self.sensitivity}")

        elif command.type == 'power':
            self.online = bool(command.value)
            if not self.online:
                self.fan_speed = 0
            print(f"   → Power {'ON' if self.online else 'OFF'}")

    def handle_cough_event(self, event):
        """
        Handle cough detection event from audio detector.

        Args:
            event: CoughEvent object with detection details
        """
        print(f"\n🎤 Cough event received in simulator!")
        print(f"   Type: {event.cough_type}")
        print(f"   Confidence: {event.confidence:.2%}")

        # Send event to backend
        self.event_sender.send_cough_event(
            device_id=self.device_id,
            cough_type=event.cough_type,
            confidence=event.confidence,
            timestamp=datetime.fromtimestamp(event.timestamp).isoformat() + "Z"
        )

        # Check if aggressive mode should be triggered
        if self.audio_detector and self.audio_detector.should_trigger_aggressive_mode():
            if not self.aggressive_mode:
                self._trigger_aggressive_mode()

    def _trigger_aggressive_mode(self):
        """Trigger aggressive purification mode."""
        self.aggressive_mode = True

        event_count = self.audio_detector.get_recent_event_count() if self.audio_detector else 0

        print("\n" + "🚨" * 35)
        print(f"⚠️  AGGRESSIVE MODE ACTIVATED!")
        print(f"   {event_count} coughs detected in monitoring window")
        print(f"   Fan speed boosted by {self.aggressive_mode_fan_boost}")
        print("🚨" * 35 + "\n")

        # Send alert to backend
        self.event_sender.send_aggressive_mode_alert(
            device_id=self.device_id,
            event_count=event_count,
            time_window_hours=settings.cough_tracking_window_hours
        )

        # Boost fan speed if online
        if self.online and self.auto_mode:
            self.fan_speed = min(10, self.fan_speed + self.aggressive_mode_fan_boost)
            print(f"   → Fan speed increased to {self.fan_speed}")

    def _start_audio_detection(self):
        """Start audio detection when auto mode is enabled."""
        if not self.audio_detection_enabled or not self.audio_detector:
            return

        if self.audio_detector.is_running:
            print("   🎤 Audio detection already running")
            return

        try:
            print("   🎤 Starting audio detection...")
            self.audio_detector.start()
        except Exception as e:
            print(f"   ⚠️  Could not start audio detection: {e}")

    def _stop_audio_detection(self):
        """Stop audio detection when auto mode is disabled."""
        if not self.audio_detection_enabled or not self.audio_detector:
            return

        if not self.audio_detector.is_running:
            return

        try:
            print("   🎤 Stopping audio detection...")
            self.audio_detector.stop()
            # Reset aggressive mode when stopping
            self.aggressive_mode = False
        except Exception as e:
            print(f"   ⚠️  Error stopping audio detection: {e}")

    def send_data(self):
        """Update sensors and send data to backend."""
        self.iteration += 1
        self.update_environmental_state()
        self.update_sensors()

        # Create payload
        payload = SensorDataPayload(
            deviceId=self.device_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            sensors=self.get_sensor_readings()
        )

        # Print status
        self._print_status()

        # Send to backend
        response = self.http_client.send_sensor_data(payload)

        if response:
            print(f"\n✅ Data sent successfully!")

            if response.alertsGenerated > 0:
                print(f"\n🚨 ALERTS GENERATED: {response.alertsGenerated}")
                for alert in response.alerts:
                    severity_emoji = {
                        "low": "ℹ️",
                        "medium": "⚠️",
                        "high": "🚨",
                        "critical": "☠️"
                    }.get(alert.severity, "⚠️")
                    print(f"  {severity_emoji} [{alert.severity.upper()}] {alert.message}")
                    print(f"     Value: {alert.sensorValue:.2f}")

    def _print_status(self):
        """Print current device status."""
        print(f"\n{'='*60}")
        print(f"📊 Update #{self.iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        print(f"Device: {self.device_id}")
        print(f"Status: {'ONLINE' if self.online else 'OFFLINE'} | Fan Speed: {self.fan_speed}/10")
        print(f"Auto Mode: {'ENABLED' if self.auto_mode else 'DISABLED'} | Sensitivity: {self.sensitivity}")

        # Show aggressive mode status
        if self.aggressive_mode:
            cough_count = self.audio_detector.get_recent_event_count() if self.audio_detector else 0
            print(f"🚨 AGGRESSIVE MODE: ACTIVE ({cough_count} coughs detected)")

        # Show audio detection status
        if self.audio_detection_enabled and self.audio_detector:
            audio_status = "🎤 LISTENING" if self.audio_detector.is_running else "🎤 STOPPED"
            print(f"Audio Detection: {audio_status}")

        if self.ws_client:
            print(f"WebSocket: {'🟢 Connected' if self.ws_client.is_connected() else '🔴 Disconnected'}")
        print(f"\n📡 Sensor Readings:")

        for sensor, value in self.get_sensor_readings().items():
            unit = SENSOR_RANGES[sensor]["unit"]
            if sensor == "PM25":
                if value <= PM25_THRESHOLDS["good"]:
                    quality = "Good ✅"
                elif value <= PM25_THRESHOLDS["moderate"]:
                    quality = "Moderate ⚠️"
                elif value <= PM25_THRESHOLDS["unhealthy"]:
                    quality = "Unhealthy 🚨"
                else:
                    quality = "Very Unhealthy ☠️"
                print(f"  {sensor:6} {value:7.2f} {unit:8} [{quality}]")
            else:
                print(f"  {sensor:6} {value:7.2f} {unit}")

    def run(self):
        """Main simulation loop."""
        print("="*60)
        print("🌀 Air Purifier Simulator")
        print("="*60)
        print(f"Device ID: {self.device_id}")
        print(f"Backend API: {settings.api_url}")
        print(f"WebSocket: {settings.websocket_url if settings.enable_websocket else 'Disabled'}")
        print(f"Update Interval: {settings.update_interval} seconds ({settings.update_interval/60:.1f} minutes)")
        print(f"\nPress Ctrl+C to stop the simulator")
        print("="*60)

        # Fetch device settings from API
        self.fetch_device_settings()

        # Fetch outdoor AQI
        if settings.enable_outdoor_aqi:
            print("\n📡 Fetching outdoor AQI data...")
            self.fetch_outdoor_aqi()
            if self.outdoor_data and self.outdoor_data.pm25:
                print(f"   City: {self.outdoor_data.cityName}")
                print(f"   AQI: {self.outdoor_data.aqi}")
                print(f"   PM2.5: {self.outdoor_data.pm25:.1f} µg/m³")

        # Connect WebSocket
        if self.ws_client:
            self.ws_client.connect()

        # Start audio detection if auto mode is enabled
        if self.auto_mode:
            self._start_audio_detection()

        # Main loop
        try:
            while True:
                self.send_data()
                print(f"\n⏳ Waiting {settings.update_interval} seconds until next update...")
                time.sleep(settings.update_interval)

        except KeyboardInterrupt:
            print("\n\n" + "="*60)
            print("🛑 Simulator stopped by user")
            print("="*60)

            # Cleanup
            self._stop_audio_detection()

            if self.ws_client:
                self.ws_client.disconnect()

            self.http_client.close()
            self.event_sender.close()

            sys.exit(0)
