# Architecture

## Decision

Retain React + TypeScript + Vite, Python 3.11+ + FastAPI + Pydantic, and SQLite for later catalog/history data. Run the built UI in system Chromium. No Electron runtime, Node server or container stack is required on the Pi. Vite is a development/build tool only. The eventual FastAPI process serves UI and API on the same loopback origin.

This foundation separates browser preview fixtures from backend capabilities. The backend is intentionally small and does not invent hardware services. `services.py` is the shared service boundary for future HTTP, command and MCP adapters. `preview.ts` contains only presentation fixtures and navigation routing; it must never grow a shell executor. Once operational commands exist, browser and MCP adapters must call a single Python command/service registry, not duplicate business logic.

## Intended data flow (not all implemented)

React → same-origin FastAPI → approved services → system/GPS/battery adapters and SQLite.
Local MCP stdio → the same approved services. AI provider adapters run on the backend and use official SDKs; API credentials never enter the browser bundle. Streaming needs cancellation, bounded context, per-request cost/error states and explicit network availability.

SQLite suits single-device catalogs, favorites, history, waypoints and tracks. Use migrations, indexed normalized titles, parameterized queries, foreign keys and explicit transactions. Evaluate WAL and batched writes against SD-card wear. Store bulky ROMs, ZIMs, artwork and map archives on disk, not as database blobs. Database implementation is deferred.

## Hardware boundary

Expose value, units, source (`real`, `simulated`, `unavailable`), sample time and stale status for each measurement. Missing sensors are null, never zero. Keep sampling outside request handlers; do not block an async loop with psutil sampling intervals. Poll modestly (initial target: 3 seconds for dashboard) and back off on disconnects. Production mode must be explicit, fail honestly and never silently fall back to mocks.

## Process and security boundary

Bind to 127.0.0.1; reject unknown Host headers. Localhost alone is not sufficient security for a future shell. Before adding mutations, require strict Origin checks, session authentication, CSRF protection, bounded request sizes and explicit approval for sensitive actions. WebSocket PTY sessions need ownership, origin checks, idle timeout, resize bounds, output backpressure and cleanup on disconnect. Python's POSIX `pty` is appropriate for Linux/macOS; xterm.js only renders the terminal. Keep PTY independent of the approved command bar and inaccessible to remote model tools.

Game launching: resolve an indexed game ID, validate real paths against configured ROM/core roots, verify the selected core, then pass an argument array to a subprocess with `shell=False`. Never concatenate game titles into commands. Ambiguous matches require selection. Track child exit, prevent duplicate launches, release resources and return to the shell. Favorites and recent activity change only after confirmed actions.

No cloud services are needed for the preview. Kiwix and RetroArch remain separate processes with their own licenses. Do not copy GPL/AGPL projects into the frontend or copy unlicensed vendor scripts. No project-wide license has been assigned on the owner's behalf.

## Limits

ARM64 suitability is supported by upstream platform information; there has been no Pi, actual touchscreen, GPS or battery test. Verify distro packages, WebGL drivers, Chromium memory, audio/controller behavior, thermal load and suspend/power behavior on the actual hardware before production. macOS hardware behavior is not claimed to match Linux.
