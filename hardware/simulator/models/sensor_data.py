"""
Pydantic models for sensor data.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict


class SensorReadings(BaseModel):
    """Individual sensor readings."""
    RH: float = Field(..., description="Relative Humidity (%)")
    CO: float = Field(..., description="Carbon Monoxide (ppm)")
    CO2: float = Field(..., description="Carbon Dioxide (ppm)")
    NO2: float = Field(..., description="Nitrogen Dioxide (ppb)")
    PM10: float = Field(..., description="Particulate Matter 10 (µg/m³)")
    PM25: float = Field(..., description="Particulate Matter 2.5 (µg/m³)")
    TEMP: float = Field(..., description="Temperature (°C)")
    TVOC: float = Field(..., description="Total Volatile Organic Compounds (ppb)")

    class Config:
        json_schema_extra = {
            "example": {
                "RH": 50.0,
                "CO": 0.5,
                "CO2": 450.0,
                "NO2": 10.0,
                "PM10": 20.0,
                "PM25": 10.0,
                "TEMP": 22.0,
                "TVOC": 100.0,
            }
        }


class SensorDataPayload(BaseModel):
    """Payload sent to backend API."""
    deviceId: str
    timestamp: str
    sensors: Dict[str, float]

    class Config:
        json_schema_extra = {
            "example": {
                "deviceId": "1234567890",
                "timestamp": "2025-12-01T10:30:00Z",
                "sensors": {
                    "RH": 50.0,
                    "CO": 0.5,
                    "CO2": 450.0,
                    "NO2": 10.0,
                    "PM10": 20.0,
                    "PM25": 10.0,
                    "TEMP": 22.0,
                    "TVOC": 100.0,
                }
            }
        }
