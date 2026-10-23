# Klinekraft Terminal

A local-first computing interface for a Raspberry Pi 5 cyberdeck. React/TypeScript interface with a simulated preview and read-only live computer telemetry through Python. This is an application on Raspberry Pi OS, not a replacement operating system.

## Run on macOS

Install Node.js 22.12+ (Node 24 LTS recommended), then from this repository:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No Pi hardware, Python service, cloud account or API key is needed for the UI. Dependencies require internet during installation; the built preview uses locally bundled fonts and assets. External websites open only when you choose a bookmark or launch page. Close the tab to leave the application.

```sh
npm run build
npm run preview
```

The preview server prints its local URL (normally http://127.0.0.1:4173).

## What works

- Nine-section navigation, home dashboard, quick-access shortcuts and fullscreen control.
- Rotating, time-aware greetings for Colin and a brief entrance animation (disabled by reduced-motion preferences).
- Pinned bookmarks and an automatically saved quick-notes pad on Home.
- Library bookmarks with add/edit/remove and new-tab opening, plus a default launch URL in Settings. Browser preferences persist locally.
- Local clock and clearly labeled simulated data, or live CPU/memory/storage/network readings from the service computer.
- Explicit unavailable temperature/peripheral states and automatic reconnect with stale-data labels.
- Controlled navigation commands and Cmd/Ctrl+K focus. Try `games`, `gps status`, or `system status`.
- Switch Preview/Live computer and pause/resume updates in Settings. Telemetry preferences are session-only.
- Informative integration placeholders; `play`, `wiki` and `ask` explicitly report that their integrations are unavailable.
- FastAPI health/capabilities/system endpoints, cached background sampling and production static-file hosting.

## Browser bookmarks and launcher

Open **Library → Add bookmark**, enter a name and a complete `https://` or `http://` address, then save. Select a bookmark to open it in a new tab; Edit and Remove manage the saved list. Choose **Pin to Home** to show a bookmark on the dashboard, or **Unpin** to remove the shortcut without deleting the bookmark. Local addresses such as `http://localhost:8080` are supported for local services.

In **Settings → Your starting page**, save a default launch URL. **Library → Open launch page** opens it when requested; nothing launches automatically. Clear launch URL removes this preference. The `browser` and `bookmarks` workspace commands navigate to Library.

Bookmarks and the launch URL are stored in this browser's local storage. They survive reloads but do not sync across devices or between Vercel and the local app. Clearing site data removes them. If storage is blocked, the app explains that changes are temporary. Only HTTP(S) addresses without embedded credentials are accepted. This does not launch native applications or install offline content.

Quick notes on Home save as you type, up to 20,000 characters. Notes stay in this browser and survive navigation and reloads; clearing site data removes them. If saving fails, the note stays available in the open app with an explicit warning so you can copy it. The greeting picks a phrase on each app load and adapts to morning, afternoon, or evening without changing randomly while you work.

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

Live data belongs to the computer running the service, not necessarily the browser. On your Mac it reports macOS readings; on a future Pi it reports Linux readings. CPU temperature is normally unavailable on macOS. GPS is not configured; X1202 readings require the optional Pi setup. Network links do not establish internet access. No simulated fallback is used when the backend is offline.

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

## Files, offline Wikipedia and X1202 battery

The local app can browse Documents/Downloads and download copies of files. Library includes Kiwix reader status and a link to search installed offline Wikipedia archives. See [Files and Wikipedia setup](docs/FILES_AND_WIKI.md) for the Pi installer and starter archive download.

The optional X1202 adapter reads battery voltage and estimated charge through I2C. See [battery setup](docs/BATTERY_SETUP.md). It does not install automatic shutdown or charging controls. Physical readings still need verification on your Pi.

## Scope and next steps

ROM catalog/launching, GPS, offline maps, file editing, PTY terminal, AI, MCP and power control are **not implemented**. No games, BIOS files, ZIM archives or map data are bundled; the Pi setup downloads a starter ZIM separately. Pi compatibility is an architectural assessment, not hardware certification.

Next: try live telemetry on your Mac, then add approved desktop launch actions. Validate the same telemetry service on the Pi when hardware is ready. See [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and [GitHub research](docs/GITHUB_RESEARCH.md).

## Vercel web demo

The repository includes `vercel.json`: Vercel installs with `npm ci`, runs
`npm run build:demo`, and publishes `dist`. Import this GitHub repository with
the repository root as the root directory. No environment variables are required.
Git integration deploys updates pushed to the configured production branch.

The hosted demo uses simulated data and disables Live computer in Settings.
It cannot read your Mac or Pi, launch desktop applications, or run the Python
service. Logos and fonts are served with the app. The local `npm run desktop`
and `npm run dev` workflows retain live-service support.

To preview the hosted build locally: `npm run build:demo && npm run preview`.
