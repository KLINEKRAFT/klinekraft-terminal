"""Service boundary shared by future HTTP, command and MCP adapters.

Host telemetry is available; Pi peripherals and actions remain unimplemented.
"""
from typing import Literal
from pydantic import BaseModel


class Capabilities(BaseModel):
    mode: Literal["host-telemetry"] = "host-telemetry"
    hardware_connected: bool = False
    system_telemetry: bool = True
    game_launch: bool = False
    gps: bool = False
    battery: bool = False
    ai: bool = False
    terminal: bool = False


def get_capabilities() -> Capabilities:
    return Capabilities()
