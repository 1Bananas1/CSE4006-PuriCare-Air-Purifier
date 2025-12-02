"""
Event sender for cough detection events.

Sends cough detection events to the Heroku backend API (which then stores in Firestore).
Backend endpoints need to be implemented - see BACKEND_TODO.md
"""
import requests
from typing import Optional
from datetime import datetime

from ..config.settings import settings


class CoughEventPayload:
    """Payload for cough detection event."""

    def __init__(self, device_id: str, cough_type: str, confidence: float, timestamp: str):
        self.deviceId = device_id
        self.eventType = "cough_detected"
        self.coughType = cough_type
        self.confidence = confidence
        self.timestamp = timestamp

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "deviceId": self.deviceId,
            "eventType": self.eventType,
            "coughType": self.coughType,
            "confidence": self.confidence,
            "timestamp": self.timestamp
        }


class EventSender:
    """
    Sends cough detection events to backend API.

    NOTE: Backend endpoints need to be implemented first!
    See hardware/simulator/BACKEND_TODO.md for implementation requirements.
    """

    def __init__(self, api_url: Optional[str] = None, timeout: int = 10):
        """
        Initialize event sender.

        Args:
            api_url: Base API URL (defaults to settings)
            timeout: Request timeout in seconds
        """
        url = api_url or settings.api_url

        # Normalize to base URL
        if url.endswith('/api/sensor-data'):
            self.base_url = url.replace('/api/sensor-data', '')
        else:
            self.base_url = url.rstrip('/')

        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def send_cough_event(
        self,
        device_id: str,
        cough_type: str,
        confidence: float,
        timestamp: Optional[str] = None
    ) -> bool:
        """
        Send cough detection event to backend API.

        The backend will store this in Firestore.

        Args:
            device_id: Device ID
            cough_type: Type of cough detected
            confidence: Detection confidence (0-1)
            timestamp: ISO timestamp (defaults to now)

        Returns:
            True if successful, False otherwise
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + "Z"

        payload = CoughEventPayload(
            device_id=device_id,
            cough_type=cough_type,
            confidence=confidence,
            timestamp=timestamp
        )

        try:
            # Backend endpoint (needs to be implemented)
            event_url = f"{self.base_url}/api/events/cough"

            print(f"\n📤 Sending cough event to backend API...")
            print(f"   URL: {event_url}")
            print(f"   Device: {device_id}")
            print(f"   Type: {cough_type}")
            print(f"   Confidence: {confidence:.2%}")

            response = self.session.post(
                event_url,
                json=payload.to_dict(),
                timeout=self.timeout
            )

            if response.status_code in [200, 201]:
                print(f"✅ Cough event sent successfully!")
                return True
            elif response.status_code == 404:
                print(f"⚠️  Backend endpoint not implemented yet (404)")
                print(f"   See hardware/simulator/BACKEND_TODO.md for requirements")
                return False
            else:
                print(f"⚠️  Backend returned status {response.status_code}")
                print(f"   Response: {response.text}")
                return False

        except requests.exceptions.ConnectionError:
            print(f"⚠️  Connection Error: Cannot reach backend at {self.base_url}")
            print(f"   Event logged locally only")
            return False

        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout: Backend took too long to respond")
            return False

        except Exception as e:
            print(f"⚠️  Error sending cough event: {e}")
            return False

    def send_aggressive_mode_alert(
        self,
        device_id: str,
        event_count: int,
        time_window_hours: float
    ) -> bool:
        """
        Send aggressive mode triggered alert to backend API.

        The backend will store this in Firestore and potentially trigger notifications.

        Args:
            device_id: Device ID
            event_count: Number of coughs detected
            time_window_hours: Time window in hours

        Returns:
            True if successful, False otherwise
        """
        try:
            # Backend endpoint (needs to be implemented)
            alert_url = f"{self.base_url}/api/alerts/aggressive-mode"

            payload = {
                "deviceId": device_id,
                "alertType": "aggressive_mode_triggered",
                "eventCount": event_count,
                "timeWindowHours": time_window_hours,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "severity": "high"
            }

            print(f"\n🚨 Sending aggressive mode alert to backend API...")
            print(f"   {event_count} coughs in {time_window_hours:.1f} hours")

            response = self.session.post(
                alert_url,
                json=payload,
                timeout=self.timeout
            )

            if response.status_code in [200, 201]:
                print(f"✅ Aggressive mode alert sent successfully!")
                return True
            elif response.status_code == 404:
                print(f"⚠️  Backend endpoint not implemented yet (404)")
                print(f"   See hardware/simulator/BACKEND_TODO.md for requirements")
                return False
            else:
                print(f"⚠️  Backend returned status {response.status_code}")
                return False

        except Exception as e:
            print(f"⚠️  Error sending aggressive mode alert: {e}")
            return False

    def close(self):
        """Close the HTTP session."""
        self.session.close()


def main():
    """Test event sender."""
    sender = EventSender()

    print("Testing cough event sender...")
    print("Note: Backend endpoints may not be implemented yet.\n")

    # Test cough event
    success = sender.send_cough_event(
        device_id="1234567890",
        cough_type="dry_cough",
        confidence=0.92
    )

    print(f"\nCough event test: {'✅ Success' if success else '⚠️  Failed (expected if backend not ready)'}")

    # Test aggressive mode alert
    success = sender.send_aggressive_mode_alert(
        device_id="1234567890",
        event_count=5,
        time_window_hours=3.0
    )

    print(f"Aggressive mode alert test: {'✅ Success' if success else '⚠️  Failed (expected if backend not ready)'}")

    sender.close()


if __name__ == "__main__":
    main()
