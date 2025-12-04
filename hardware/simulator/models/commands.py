"""
Pydantic models for control commands.
"""
from pydantic import BaseModel, Field
from typing import Union, Literal


class ControlCommand(BaseModel):
    """Base control command received from WebSocket."""
    type: str = Field(..., description="Command type")
    value: Union[bool, int, str] = Field(..., description="Command value")


class FanSpeedCommand(BaseModel):
    """Fan speed control command."""
    type: Literal["fan_speed"]
    value: int = Field(..., ge=0, le=10, description="Fan speed (0-10)")


class AutoModeCommand(BaseModel):
    """Auto mode control command."""
    type: Literal["auto_mode"]
    value: bool = Field(..., description="Enable/disable auto mode")


class SensitivityCommand(BaseModel):
    """Sensitivity control command."""
    type: Literal["sensitivity"]
    value: Literal["low", "medium", "high"] = Field(..., description="Sensitivity level")


class PowerCommand(BaseModel):
    """Power control command."""
    type: Literal["power"]
    value: bool = Field(..., description="Power on/off")
