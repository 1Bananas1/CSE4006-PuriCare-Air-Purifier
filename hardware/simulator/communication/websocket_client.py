"""
WebSocket client for real-time communication with frontend.
"""
import socketio
from typing import Optional, Callable
from ..config.settings import settings
from ..models.commands import ControlCommand


class WebSocketClient:
    """WebSocket client for bidirectional communication."""

    def __init__(
        self,
        websocket_url: Optional[str] = None,
        device_id: Optional[str] = None,
        on_command_callback: Optional[Callable[[ControlCommand], None]] = None
    ):
        """
        Initialize WebSocket client.

        Args:
            websocket_url: WebSocket server URL (defaults to settings)
            device_id: Device ID for room joining (defaults to settings)
            on_command_callback: Callback function when control command received
        """
        self.websocket_url = websocket_url or settings.websocket_url
        self.device_id = device_id or settings.device_id
        self.on_command_callback = on_command_callback

        self.sio = socketio.Client()
        self.connected = False

        # Register event handlers
        self._register_handlers()

    def _register_handlers(self):
        """Register WebSocket event handlers."""

        @self.sio.event
        def connect():
            """Handle connection established."""
            print("🔌 WebSocket connected!")
            self.connected = True
            # Join device-specific room
            self.sio.emit('join_device', self.device_id)

        @self.sio.event
        def disconnect():
            """Handle disconnection."""
            print("🔌 WebSocket disconnected")
            self.connected = False

        @self.sio.event
        def joined_device(data):
            """Handle successful room join."""
            print(f"✅ Joined device room: {data.get('deviceId', 'unknown')}")

        @self.sio.event
        def device_control(data):
            """Handle control command from frontend."""
            try:
                command = ControlCommand(**data)
                print(f"\n🎮 CONTROL COMMAND RECEIVED")
                print(f"   Type: {command.type}")
                print(f"   Value: {command.value}")

                # Call callback if registered
                if self.on_command_callback:
                    self.on_command_callback(command)

            except Exception as e:
                print(f"❌ Error processing command: {e}")

    def connect(self) -> bool:
        """
        Connect to WebSocket server.

        Returns:
            True if connection successful, False otherwise
        """
        if self.connected:
            print("⚠️  Already connected to WebSocket")
            return True

        try:
            print(f"🔌 Connecting to WebSocket: {self.websocket_url}")
            self.sio.connect(
                self.websocket_url,
                auth={'token': 'simulator'}
            )
            return True

        except Exception as e:
            print(f"⚠️  WebSocket connection failed: {e}")
            print(f"   Continuing in HTTP-only mode...")
            return False

    def disconnect(self):
        """Disconnect from WebSocket server."""
        if self.connected:
            self.sio.disconnect()
            self.connected = False
            print("🔌 WebSocket disconnected")

    def is_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self.connected

    def emit(self, event: str, data: dict):
        """
        Emit event to server.

        Args:
            event: Event name
            data: Event data
        """
        if self.connected:
            self.sio.emit(event, data)
