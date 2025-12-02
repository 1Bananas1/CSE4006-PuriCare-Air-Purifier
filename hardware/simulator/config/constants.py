"""
Constants and sensor ranges for the air purifier simulator.
"""
from typing import Dict, TypedDict


class SensorRange(TypedDict):
    """Type definition for sensor range."""
    min: float
    max: float
    unit: str


# Sensor value ranges and units
SENSOR_RANGES: Dict[str, SensorRange] = {
    "RH": {"min": 30, "max": 70, "unit": "%"},
    "CO": {"min": 0, "max": 9, "unit": "ppm"},
    "CO2": {"min": 400, "max": 2000, "unit": "ppm"},
    "NO2": {"min": 0, "max": 100, "unit": "ppb"},
    "PM10": {"min": 0, "max": 150, "unit": "µg/m³"},
    "PM25": {"min": 0, "max": 100, "unit": "µg/m³"},
    "TEMP": {"min": 18, "max": 28, "unit": "°C"},
    "TVOC": {"min": 0, "max": 1000, "unit": "ppb"},
}

# Air Quality Index thresholds for PM2.5
PM25_THRESHOLDS = {
    "good": 15,
    "moderate": 35,
    "unhealthy": 75,
    "very_unhealthy": 150,
}

# Fan speed range
FAN_SPEED_MIN = 0
FAN_SPEED_MAX = 10

# Sensitivity levels
SENSITIVITY_LEVELS = ["low", "medium", "high"]
