# Installation and development

## macOS preview

Use Node 22.12+ and npm, preferably Node 24 LTS. Run `npm ci`, then `npm run dev` from the repository root and visit http://127.0.0.1:5173. Preview uses fixtures; Live computer mode reads the optional Python service. Python is optional for UI work. Do not install Pi packages, enable I2C or execute vendor battery scripts on the Mac.

To preview a production bundle: `npm run build`, then `npm run preview`. Close the tab to exit, or use the Return to desktop explanation. Cmd/Ctrl+K focuses the command input. Navigation commands are local and never invoke a shell. Fullscreen requires a browser user gesture; Escape leaves browser fullscreen.

Import the provided logo using `npm run brand:import -- "/absolute/path/to/klinekraft logo_geometric@5x.png"`. The original is preserved; generated images are proportional. Rebuild afterward.

## Python development

Use Python 3.11+, ideally 3.12. Create `.venv` with `python3 -m venv .venv`, activate it, and run `python -m pip install -e './backend[dev]'`. Start `python -m uvicorn klinekraft.main:app --host 127.0.0.1 --port 8000`. The development Vite server proxies `/api` to that address. The simulated preview does not depend on it. Local builds default to Live computer using `/api/system`. Settings saves your data-mode choice in this browser; choose Preview for UI work without a service. The hosted demo always stays simulated. Production static hosting is available after `npm run build`; start/restart the backend after building because mount detection happens on startup.

## Raspberry Pi desktop application

The installed Pi runs the built UI and FastAPI service at `http://127.0.0.1:8000`.
The user service `klinekraft.service` starts locally; no public website is involved.
After installing dependencies and building with `npm run build`, install or refresh
the application-menu entry and desktop-login launcher:

```sh
bash scripts/install-desktop-app.sh
```

The launcher starts the existing user service, checks readiness for a bounded time,
and opens a dedicated Chromium app window with no browser tabs or address bar.
It retains the existing Chromium profile so browser-only preferences and bookmarks
remain available. The Klinekraft icon appears in the desktop application menu.
Alt+F4 or the window close button returns to the desktop; the backend keeps running.
F11 toggles browser fullscreen. This is a desktop-integrated web application, not a
native-widget rewrite or a separately packaged Electron executable.

The installer preserves the previous launcher as `~/.local/bin/start-klinekraft.pre-app`
and previous autostart entry with `.pre-app` appended. Removing
`~/.config/autostart/klinekraft-dashboard.desktop` disables login launch without
removing the application-menu entry or deleting saves. The helper does not replace
the existing user-service configuration or its AI/battery/game integration settings.

## Offline behavior

Runtime assets, UI fonts and the backend live on this Pi. Localhost is an internal
address and works without Wi-Fi. Notes, Paint, calendar, calculator, local files,
installed games, local Wikipedia, downloaded maps and saved AI conversations are
available offline. Launching games requires installed cores and ROMs; map navigation
currently has no routing, address search or live GPS integration.

New cloud AI answers, web browsing, live weather, downloads and Google Drive backups
need internet. LocalSend needs the phone and Pi on a reachable shared network (for
example a hotspot), but does not need internet. With neither Wi-Fi nor another local
network, LocalSend cannot transfer files. A Bluetooth file-sharing service is not set up.

The November 13, 2026 offline validation ran a second backend and Kiwix server in a
separate Linux network namespace with only loopback enabled. External connectivity
failed as intended; UI/scripts/styles/worker/fonts, map ranges/glyphs, saved places,
notes/drawings, game lists/favorites, local file listing, and Wikipedia search/article
reading passed. This did not disconnect the host Wi-Fi or test every game under load.

## Live Mac development

See [MAC_DEVELOPMENT.md](MAC_DEVELOPMENT.md) for one-time Python setup and `npm run desktop`, which builds the UI and runs it with the service on port 8000. Preview remains available without Python.
