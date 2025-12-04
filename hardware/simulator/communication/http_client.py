"""
HTTP client for backend API communication.
"""
import requests
from typing import Optional
from datetime import datetime

from ..models.sensor_data import SensorDataPayload
from ..models.responses import SensorDataResponse, OutdoorAQIData
from ..config.settings import settings


class HTTPClient:
    """HTTP client for backend API communication."""

    def __init__(self, api_url: Optional[str] = None, timeout: int = 10):
        """
        Initialize HTTP client.

        Args:
            api_url: Base API URL or full sensor-data URL (defaults to settings)
            timeout: Request timeout in seconds
        """
        url = api_url or settings.api_url

        # Normalize to base URL (remove /api/sensor-data if present)
        if url.endswith('/api/sensor-data'):
            self.base_url = url.replace('/api/sensor-data', '')
        else:
            # Assume it's already a base URL
            self.base_url = url.rstrip('/')

        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def send_sensor_data(self, payload: SensorDataPayload) -> Optional[SensorDataResponse]:
        """
        Send sensor data to backend.

        Args:
            payload: Sensor data payload

        Returns:
            Response from backend or None if failed
        """
        try:
            sensor_data_url = f"{self.base_url}/api/sensor-data"
            response = self.session.post(
                sensor_data_url,
                json=payload.model_dump(),
                timeout=self.timeout
            )

            if response.status_code == 201:
                return SensorDataResponse(**response.json())
            else:
                print(f"❌ HTTP Error {response.status_code}: {response.text}")
                return None

        except requests.exceptions.ConnectionError:
            print(f"❌ Connection Error: Cannot reach backend at {self.base_url}")
            return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout: Backend took too long to respond")
            return None

        except Exception as e:
            print(f"❌ Unexpected error sending sensor data: {e}")
            return None

    def fetch_outdoor_aqi(self, station_idx: Optional[int] = None) -> Optional[OutdoorAQIData]:
        """
        Fetch outdoor AQI data from backend station cache.

        Args:
            station_idx: Station index (defaults to settings)

        Returns:
            Outdoor AQI data or None if failed
        """
        station_idx = station_idx or settings.station_idx

        if not station_idx:
            print("⚠️  No station_idx configured")
            return None

        try:
            # Construct station URL
            station_url = f"{self.base_url}/api/devices/public/stations/{station_idx}"

            print(f"📡 Fetching outdoor data from: {station_url}")

            response = self.session.get(station_url, timeout=self.timeout)

            if response.status_code == 200:
                data = OutdoorAQIData(**response.json())
                print(f"✅ Outdoor AQI data fetched successfully!")
                print(f"   City: {data.cityName}")
                print(f"   AQI: {data.aqi}")
                print(f"   PM2.5: {data.pm25} µg/m³")
                return data

            elif response.status_code == 404:
                print(f"❌ Station {station_idx} not found")
                return None

            else:
                print(f"❌ Error fetching station data: {response.status_code}")
                return None

        except requests.exceptions.ConnectionError:
            print(f"❌ Connection Error: Cannot reach backend")
            return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout: Backend took too long to respond")
            return None

        except Exception as e:
            print(f"⚠️  Could not fetch outdoor AQI: {e}")
            return None

    def fetch_device_status(self, device_id: str) -> Optional[dict]:
        """
        Fetch device settings and status from backend.

        Args:
            device_id: Device ID

        Returns:
            Device status dict with settings or None if failed
        """
        try:
            # Construct control status URL
            status_url = f"{self.base_url}/api/control/{device_id}/status"

            print(f"📡 Fetching device settings from: {status_url}")

            response = self.session.get(status_url, timeout=self.timeout)

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Device settings fetched successfully!")
                print(f"   Auto Mode: {data['status'].get('autoMode', False)}")
                print(f"   Fan Speed: {data['status'].get('fanSpeed', 0)}")
                print(f"   Sensitivity: {data['status'].get('sensitivity', 'medium')}")
                return data['status']

            elif response.status_code == 404:
                print(f"❌ Device {device_id} not found")
                return None

            else:
                print(f"⚠️  Error fetching device status: {response.status_code}")
                return None

        except requests.exceptions.ConnectionError:
            print(f"❌ Connection Error: Cannot reach backend")
            return None

        except requests.exceptions.Timeout:
            print(f"❌ Timeout: Backend took too long to respond")
            return None

        except Exception as e:
            print(f"⚠️  Could not fetch device status: {e}")
            return None

    def close(self):
        """Close the HTTP session."""
        self.session.close()
