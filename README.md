# Klinekraft Terminal

A local-first computing interface for a Raspberry Pi 5 cyberdeck. Phase 1 foundation: React/TypeScript preview, warm industrial design, and a small Python service scaffold. This is an application on Raspberry Pi OS, not a replacement operating system.

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
- Local clock, clearly labeled simulated CPU/memory/storage/temperature/network/GPS, unavailable battery state.
- Controlled navigation commands and Cmd/Ctrl+K focus. Try `games`, `gps status`, or `system status`.
- Pause/resume simulated updates in Settings. Preferences are session-only.
- Informative integration placeholders; `play`, `wiki` and `ask` explicitly report that their integrations are unavailable.
- Optional FastAPI health/capabilities endpoints and production static-file hosting.

## Brand assets

The supplied original is preserved at `assets/brand/klinekraft_logo_geometric.png`. The sidebar pairs it with the lowercase Archivo Expanded wordmark. Proportional UI assets, a favicon and an application icon are committed in `frontend/public/brand`; no import is required to run the app.

To regenerate assets from the original:

```sh
npm run brand:import -- assets/brand/klinekraft_logo_geometric.png
npm run build
```

The import script preserves the source PNG and its colors and geometry. Square icons add transparent padding rather than stretching the mark.

## Optional backend

Python 3.11+ is required (3.12 recommended).

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e './backend[dev]'
python -m uvicorn klinekraft.main:app --host 127.0.0.1 --port 8000
```

With `dist/` built, http://127.0.0.1:8000 serves the complete preview. `/api/health` and `/api/capabilities` describe the scaffold honestly. The frontend currently uses its own explicit preview provider; it does not consume hardware API data. No production hardware mode exists yet.

## Verification

```sh
npm run build
npx playwright install chromium
npm test
.venv/bin/python -m pytest backend/tests
```

Browser tests cover the three requested display sizes, local-only resources, navigation, controlled commands and preview controls. See [verification](docs/VERIFICATION.md) for the checks actually run and their limits.

## Repository guide

| Location | Purpose |
| --- | --- |
| `frontend/src` | Shell, reusable brand components, CSS tokens and explicit preview provider |
| `frontend/public/brand` | Brand manifest and generated assets  |
| `assets/brand` | Original source PNG  |
| `backend/klinekraft` | FastAPI routes and shared service boundary |
| `scripts/import-brand.mjs` | Lossless original preservation and proportional asset generation |
| `deploy` | Pi user-service and desktop-autostart examples; not installed |
| `tests`, `backend/tests` | Browser acceptance and service contract tests |
| `docs` | Research, architecture, hardware, design, installation and roadmap |

## Scope and next steps

Real telemetry, ROM catalog/launching, GPS, offline maps, Kiwix, file management, PTY terminal, AI, MCP and power control are **not implemented**. No games, BIOS files, ZIM archives or map data are included. Pi compatibility is an architectural assessment, not hardware certification.

Next: review the 1024×600 preview on the actual display, then implement and test read-only Pi system telemetry. See [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and [GitHub research](docs/GITHUB_RESEARCH.md).
