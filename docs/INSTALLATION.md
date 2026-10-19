# Installation and development

## macOS preview

Use Node 22.12+ and npm, preferably Node 24 LTS. Run `npm ci`, then `npm run dev` from the repository root and visit http://127.0.0.1:5173. All hardware readings are fixtures. Python is optional for UI work. Do not install Pi packages, enable I2C or execute vendor battery scripts on the Mac.

To preview a production bundle: `npm run build`, then `npm run preview`. Close the tab to exit, or use the Return to desktop explanation. Cmd/Ctrl+K focuses the command input. Navigation commands are local and never invoke a shell. Fullscreen requires a browser user gesture; Escape leaves browser fullscreen.

Import the provided logo using `npm run brand:import -- "/absolute/path/to/klinekraft logo_geometric@5x.png"`. The original is preserved; generated images are proportional. Rebuild afterward.

## Python development

Use Python 3.11+, ideally 3.12. Create `.venv` with `python3 -m venv .venv`, activate it, and run `python -m pip install -e './backend[dev]'`. Start `python -m uvicorn klinekraft.main:app --host 127.0.0.1 --port 8000`. The development Vite server proxies `/api` to that address. The preview does not depend on it. Production static hosting is available after `npm run build`; start/restart the backend after building because mount detection happens on startup.

## Raspberry Pi — proposed preview deployment

These are untested Pi deployment instructions for the preview, not completion of hardware integration. Start with Raspberry Pi OS 64-bit Desktop and its Chromium browser. Place the repository at `~/klinekraft-terminal`, build/install dependencies as above. Never run the application as root. The optional Python service uses no hardware drivers yet.

Copy `deploy/klinekraft.service.example` to `~/.config/systemd/user/klinekraft.service` after reviewing paths. Run `systemctl --user daemon-reload`, then `systemctl --user enable --now klinekraft`. Visit http://127.0.0.1:8000 and check `journalctl --user -u klinekraft`. To stop/remove autostart, `systemctl --user disable --now klinekraft`.

After confirming the server is ready, the desktop entry example can be copied to `~/.config/autostart/klinekraft.desktop`. It uses Chromium fullscreen, not a locked-down kiosk. F11/Escape can leave fullscreen, and Alt+F4 closes Chromium to reveal the desktop. Touch users have the in-app exit guidance, but closing an OS-launched window from JavaScript is not reliable; an actual touch-only native exit control is a production-phase requirement. Do not claim that the current button closes Chromium.

Graphical startup can race service readiness. Before unattended deployment, add a bounded readiness check and retry UI, and test the compositor/session configuration used by the installed OS. Remove the desktop entry to disable browser autostart. These examples are not installed by any repository command.

## Offline behavior

Install npm/Python dependencies beforehand. At runtime the built UI and fonts are served locally; no CDN, analytics, maps or AI request is made. Keep the local server running. This is not an installed PWA, and a stopped local server cannot be replaced by a browser cache. Future Kiwix/maps require separately downloaded, licensed content and a free-space budget.
