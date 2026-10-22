# Klinekraft Terminal

A local-first computing interface for a Raspberry Pi 5 cyberdeck. React/TypeScript interface with a simulated preview and read-only live computer telemetry through Python. This is an application on Raspberry Pi OS, not a replacement operating system.

## Run on macOS

Install Node.js 22.12+ (Node 24 LTS recommended), then from this repository:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No Pi hardware, Python service, cloud account or API key is needed for the UI. Dependencies require internet during installation; the built preview uses locally bundled fonts and assets and makes no external requests. Close the tab to leave the application.

```sh
npm run build
npm run preview
```

The preview server prints its local URL (normally http://127.0.0.1:4173).

## What works

- Nine-section navigation, home dashboard, quick-access shortcuts and fullscreen control.
- Local clock and clearly labeled simulated data, or live CPU/memory/storage/network readings from the service computer.
- Explicit unavailable temperature/peripheral states and automatic reconnect with stale-data labels.
- Controlled navigation commands and Cmd/Ctrl+K focus. Try `games`, `gps status`, or `system status`.
- Switch Preview/Live computer and pause/resume updates in Settings. Preferences are session-only.
- Informative integration placeholders; `play`, `wiki` and `ask` explicitly report that their integrations are unavailable.
- FastAPI health/capabilities/system endpoints, cached background sampling and production static-file hosting.

## Brand assets

The complete supplied logo is preserved at `assets/brand/klinekraft_terminal_logo@5x.png` and displayed directly in the sidebar, including its lettering and alignment. The standalone symbol remains at `assets/brand/klinekraft_logo_geometric.png` and is used for small icons. Proportional UI assets, a favicon and an application icon are committed in `frontend/public/brand`; no import is required to run the app.

To regenerate assets from the original:

```sh
npm run brand:import -- assets/brand/klinekraft_logo_geometric.png
npm run brand:lockup -- "assets/brand/klinekraft_terminal_logo@5x.png"
npm run build
```

The import script preserves the source PNG and its colors and geometry. Square icons add transparent padding rather than stretching the mark.

## Live readings on your Mac — no Pi needed

Python 3.11+ is required (3.12 recommended). Run these **inside your project folder**:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e './backend[dev]'
npm run desktop
```

Open **http://127.0.0.1:8000**, select **Settings → Dashboard data → Live computer**, then Home. `npm run desktop` builds the UI and starts the local Python service. Keep Terminal open; Ctrl+C stops it. See [Mac setup and troubleshooting](docs/MAC_DEVELOPMENT.md).

Live data belongs to the computer running the service, not necessarily the browser. On your Mac it reports macOS readings; on a future Pi it reports Linux readings. CPU temperature is normally unavailable on macOS. X1202 and GPS are not configured. Network links do not establish internet access. No simulated fallback is used when the backend is offline.

For hot-reload frontend development, run `npm run backend` in one Terminal and `npm run dev` in another. `/api/system` provides read-only host snapshots; `/api/capabilities` lists implemented integrations. No command execution endpoint is exposed.

## Verification

```sh
npm run build
npx playwright install chromium
npm test
npm run test:integration
.venv/bin/python -m pytest backend/tests
```

Browser tests cover the three requested display sizes, local-only resources, navigation, controlled commands, preview/live controls, connection failures and recovery. The integration suite runs a real Python service and reads it through the built UI. See [verification](docs/VERIFICATION.md) for the checks actually run and their limits.

## Repository guide

| Location | Purpose |
| --- | --- |
| `frontend/src` | Shell, reusable brand components, CSS tokens and preview/live data providers |
| `frontend/public/brand` | Brand manifest and generated assets  |
| `assets/brand` | Original source PNG  |
| `backend/klinekraft` | FastAPI routes and shared service boundary |
| `scripts/import-brand.mjs` | Lossless original preservation and proportional asset generation |
| `deploy` | Pi user-service and desktop-autostart examples; not installed |
| `tests`, `backend/tests` | Browser acceptance and service contract tests |
| `docs` | Research, architecture, hardware, design, installation and roadmap |

## Scope and next steps

ROM catalog/launching, GPS, offline maps, Kiwix, file management, PTY terminal, AI, MCP and power control are **not implemented**. No games, BIOS files, ZIM archives or map data are included. Pi compatibility is an architectural assessment, not hardware certification.

Next: try live telemetry on your Mac, then add approved desktop launch actions. Validate the same telemetry service on the Pi when hardware is ready. See [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and [GitHub research](docs/GITHUB_RESEARCH.md).
