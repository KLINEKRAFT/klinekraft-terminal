"""Service boundary shared by future HTTP, command and MCP adapters.

Host telemetry is available; Pi peripherals and actions remain unimplemented.
"""
import os
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
    files_read_only: bool = True
    wiki_status: bool = True


def get_capabilities() -> Capabilities:
    return Capabilities(game_launch=os.environ.get("KLINEKRAFT_GAMES") == "1", battery=os.environ.get("KLINEKRAFT_BATTERY") == "x1202")
