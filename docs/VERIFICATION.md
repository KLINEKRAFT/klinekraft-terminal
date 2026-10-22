# Verification record

## Live telemetry milestone — 2026-10-22

Environment: managed Linux x86_64 workspace, Node 24.19.0, Python 3.12.14. No physical Raspberry Pi, GPS, X1202, ELECROW touchscreen or macOS host was available.

- TypeScript strict checking and Vite production build passed.
- Nine Python tests passed: actual API lifecycle, host rejection, truthful capability reporting, unavailable service response, independent metric failures, missing macOS temperature API, CPU-only temperature selection, unit conversion and stale snapshots.
- Eight browser tests passed: the three display sizes, local-only resources, navigation, commands, settings, live data, backend failure/recovery, invalid responses and mode changes during an in-flight request.
- One end-to-end integration test passed against an actual Uvicorn/psutil service. The built UI fetched the same-origin API and displayed this environment’s measured host values. No mocked HTTP response was used in that integration test.
- Both preview and live home layouts fit 1024×600 without horizontal or vertical page scrolling. Preview also passed 1280×720 and 1920×1080 checks.
- `git diff --check` passed.

Run from the repository root after installing frontend and backend dependencies:

```sh
npm run build
.venv/bin/python -m pytest backend/tests
npm test
npm run test:integration
```

This environment uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` for the browser commands. On macOS use `npx playwright install chromium` first, then run normally. Starlette currently emits a test-client HTTP dependency deprecation warning; all backend tests pass.

`docs/screenshots/home-live-1024x600.png` demonstrates the live UI using a deterministic macOS API fixture; it is not evidence of executing on the user's Mac. The real service test writes its screenshot to ignored `test-results/real-host-dashboard.png`. Other committed home screenshots show the explicit simulated preview.

React review covered cancellation, response validation, no mock fallback in live mode, effect cleanup, native controls/labels, source/freshness indicators and locally bundled fonts. The first test pass found an ambiguous status-role locator after adding service status text; the command feedback now has an accessible name, and the suite passes.

## Remaining physical validation

Mac execution should be tried using [MAC_DEVELOPMENT.md](MAC_DEVELOPMENT.md); it is supported by cross-platform psutil APIs but has not been run on a physical Mac here. Pi ARM64 package installation, touch calibration, WebGL, thermal behavior, peripheral drivers and autostart remain unverified. CPU temperature is expected to be unavailable on macOS without extra helpers. Network link state does not establish internet access. Desktop launch and native exit are not part of this milestone.

## Existing brand foundation

The supplied original logo and complete lockup are preserved unchanged. Proportional assets and icons are committed. The shell, original layout and offline font loading were validated in the preceding foundation milestone.
