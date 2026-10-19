# Roadmap and completion gates

## Phase 1 — research and foundation (this delivery)

Implemented: repository scaffold, tokens, typography, navigation, home preview, controlled navigation commands, feature placeholders, backend health/capabilities, brand import pipeline, documentation and automated checks. Original logo import is pending the source file. Pi execution and macOS execution were not physically tested; instructions are provided. GitHub research is recorded with known verification gaps.

## Phase 2 — functional UI prototype

Import/review actual logo. Review readability at physical 7-inch size. Build games browser with clearly labeled fixture records, assistant conversation mockup, map layout and system tools. Do not treat this delivery's informative placeholder pages as completed feature mockups. Add loading, unavailable, stale, empty and error states before hardware wiring. Test touch/keyboard and controller use where appropriate.

## Phase 3 — Pi integration

First vertical slice: live read-only psutil telemetry, a typed API and production source labels. No mock fallback in production. Then gpsd and a vetted X1202 adapter. Add SQLite catalog, filesystem scanning and safe RetroArch launch. Test actual supported cores; N64/PlayStation performance depends on game/core. Separate approved commands from genuine PTY access.

ROM migration gate: create a read-only inventory of the old card, calculate hashes, and back up ROMs, BIOS, saves, savestates and metadata. Copy to staging without overwriting the original. Match cores and save formats; retain both versions for conflicts. Import ES-DE/EmulationStation metadata with validated paths. Verify a representative save loads before switching libraries. Never include copyrighted ROMs or BIOS in this repository.

## Phase 4 — AI and MCP

Official SDK adapters, streaming/history, credential storage, permission UI, shared tool registry and local stdio MCP. Verify current specification and current OpenAI/Claude client support. No unrestricted shell tool.

## Phase 5 — offline tools

Kiwix service, library discovery/search, local map regions and full local style resources, tracks/waypoints/GPX. Test cold startup without internet and disk capacity/error recovery. Data download/import must remain explicit.

## Phase 6 — production polish

Benchmark Pi startup/idle memory/thermals, audit session security, test actual touchscreen, fullscreen exit, controller focus, service readiness, crash recovery and safe power behavior. Validate systemd and graphical-session autostart on the selected Raspberry Pi OS release. No automatic shutdown or privileged service until bench-tested. Maintain the Linux desktop escape path.
