"""Service boundary shared by future HTTP, command and MCP adapters.

Phase 1 deliberately exposes capabilities, not invented hardware readings.
"""
from typing import Literal
from pydantic import BaseModel


class Capabilities(BaseModel):
    mode: Literal["foundation"] = "foundation"
    hardware_connected: bool = False
    system_telemetry: bool = False
    game_launch: bool = False
    gps: bool = False
    battery: bool = False
    ai: bool = False
    terminal: bool = False


def get_capabilities() -> Capabilities:
    return Capabilities()
