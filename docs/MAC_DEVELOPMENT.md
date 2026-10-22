# Run live telemetry on your Mac

You can develop Klinekraft without a Pi. Preview mode uses fixtures; Live computer mode reads the machine running the Python backend. Neither requires a cloud API key. The original logo and design work in both modes.

## One-time setup

Open Terminal **inside the `klinekraft-terminal` project folder**. If it is in your home directory:

```sh
cd ~/klinekraft-terminal
git pull
node --version
python3 --version
```

You need Node 22.12+ and Python 3.11+ (3.12 recommended). If the folder is elsewhere, type `cd `, drag the project folder from Finder into Terminal, and press Return. If `python3 --version` reports an older version, install a supported Python from python.org or your existing package manager, then create the environment using that interpreter (for example `python3.12 -m venv .venv`). Do not use the old interpreter to create the environment.

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -e './backend[dev]'
```

If `.venv` already exists, reuse it if its Python version is supported; otherwise create a new environment with a supported interpreter. No sudo or Pi software is needed.

## Launch everything in one Terminal

```sh
npm run desktop
```

This builds the UI and starts the Python server at **http://127.0.0.1:8000**. Leave Terminal running. Open that URL, choose **Settings → Dashboard data → Live computer**, and return to Home. Stop the service with Ctrl+C.

Live mode displays CPU, logical core count, memory, root-volume storage and network interface state. CPU temperature is normally unavailable on macOS; no privileged sensor helper is installed. Battery and GPS remain unavailable because their adapters are not implemented. The host label identifies macOS/architecture rather than pretending the Mac is a Pi. Readings are rounded; memory and storage use decimal GB.

The browser's clock remains local to the browser. Data mode and pause settings are session-only; reloading defaults to Preview deliberately. The frontend never falls back to mock values after choosing Live computer.

## UI-only development

```sh
npm run dev
```

Open http://127.0.0.1:5173. The simulated preview works without Python. To use Live computer with hot reload, start `npm run backend` in a second Terminal inside the same project folder. Vite forwards `/api` to the local Python service on port 8000. `npm run preview` also forwards the API for testing an existing build.

## Updates

Stop the running service, then from the project folder:

```sh
git pull
npm ci
.venv/bin/python -m pip install -e './backend[dev]'
npm run desktop
```

## Connection states

- **Connecting:** waiting for a valid response; missing values are dashes.
- **Live computer:** latest received host sample. Individual missing sensors remain unavailable.
- **Service offline:** no valid host sample received. Check the Python terminal and URL.
- **Stale readings:** an earlier sample is retained but is no longer current. Reconnection retries automatically.
- **Updates paused:** browser refresh is paused intentionally. The backend sampler keeps running.

The backend is bound to localhost and makes no internet probes. A network link being up does not prove internet connectivity. If the browser is pointed at a remote backend, the readings belong to that server, not the browser's computer.

## What still needs a Pi

Real touchscreen/rotation testing, boot/autostart reliability, X1202 calibration and power behavior, USB GPS discovery, controller/emulator performance and enclosed thermals. Browser/native application launch and a touch-only exit remain future work. Do not install battery shutdown scripts or run Klinekraft as root to preview this milestone.
