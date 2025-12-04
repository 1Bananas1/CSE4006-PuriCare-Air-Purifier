"""
Configuration management using pydantic.
Loads settings from .env file with validation.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Device Configuration
    device_id: str

    # API Configuration
    api_url: str
    websocket_url: str

    # Timing Configuration
    update_interval: int = 300  # seconds

    # Station Configuration
    station_idx: Optional[int] = None

    # Simulation Configuration
    enable_outdoor_aqi: bool = True
    enable_websocket: bool = True

    # Audio Detection Configuration
    enable_audio_detection: bool = False  # Set to True to enable cough detection
    cough_threshold: int = 5  # Number of coughs to trigger aggressive mode
    cough_tracking_window_hours: float = 3.0  # Time window for tracking coughs

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
