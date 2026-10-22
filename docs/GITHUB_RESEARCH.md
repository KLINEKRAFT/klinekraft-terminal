# GitHub research and reuse decisions

Researched 2026-10-19. Evidence: repository metadata and README files through GitHub, release redirects and commit Atom feeds, plus an inspected shallow checkout of Geekworm's vendor scripts. `research/github-snapshot.json` records observed release URLs, commit dates and repository descriptions. Release versions below are observations, not dependencies added to this app. A recent commit is a maintenance signal, not proof of quality. ARM64 hardware testing has not occurred.

## Comparison

| Project / purpose | Platforms / ARM64 assessment | License observed | Latest GitHub release; latest commit observed | Documentation / integration effort | Recommendation |
| --- | --- | --- | --- | --- | --- |
| [psutil](https://github.com/giampaolo/psutil) — system metrics | Linux, macOS, Windows, BSD; Linux ARM64 suitable, verify package/wheel on chosen OS | BSD-3-Clause | No GitHub release resolved; 2026-10-19 | Extensive platform/API docs; low | Reuse behind a read-only sampler; temperature may be unavailable |
| [RetroArch](https://github.com/libretro/RetroArch) — Libretro frontend | README explicitly lists Raspberry Pi, Linux and macOS; ARM64 core availability is per-core | GPL-3.0; core licenses vary | v1.22.2; 2026-10-19 | CLI/man pages and documentation center; medium | Wrap installed executable with argv, never fork or embed emulator code |
| [xterm.js](https://github.com/xtermjs/xterm.js) — browser terminal | Browser JS; CPU architecture independent, requires PTY backend | MIT | 6.0.0; 2026-10-13 | Clear API, addons and PTY distinction; high because session security matters | Reuse renderer; build narrow Python POSIX PTY bridge later |
| [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) — tools/transports | Python 3.11+; Python/Pydantic dependencies need ARM64 install check | MIT | v2.3.0; 2026-10-17 | Current v2 docs and migration guide; medium | Reuse official SDK and shared Python services; no protocol fork |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) — vector maps | Modern browser/WebGL; Pi Chromium GPU validation required | BSD-3-Clause | v6.15.0; 2026-10-19 | Extensive API/examples; medium | Reuse renderer, lazy-load in Maps, bundle local data/style resources |
| [PMTiles](https://github.com/protomaps/PMTiles) — single-file tile archive | JS/Python readers; JS architecture independent; conversion tool separately packaged | BSD-3-Clause implementations; CC0 specification | No GitHub release resolved; 2026-09-16 | Format and MapLibre examples; medium | Prefer regional local archives + byte-range serving; map data has separate licensing |
| [Kiwix tools](https://github.com/kiwix/kiwix-tools) — ZIM hosting/search | GNU/Linux/POSIX; verify Pi ARM64 package and libzim/libkiwix dependencies | GPL-3.0 | 3.8.2; 2026-10-01 | Detailed build/dependency docs; medium | Wrap kiwix-serve/search, don't rebuild ZIM search/rendering |
| [gpsd mirror](https://github.com/ntpsec/gpsd) — receiver abstraction | Unix/Linux, Raspberry Pi package availability to verify; hardware receiver support separate | BSD, see COPYING | Releases hosted elsewhere; 2026-10-14 | Detailed receiver/install/protocol docs; medium | Reuse gpsd, gpspipe/gpsmon. Canonical project is on GitLab |
| [Geekworm x120x](https://github.com/geekworm-com/x120x) — UPS samples | Explicit X1202 target; SMBus/GPIO depends on Pi board/OS setup | No clear root license found | No GitHub release resolved; 2024-05-14 | Small scripts, no root README; high due hardware qualification | Research only; no source copying. Validate gauge and board revision first |
| [Pi Kiosk](https://github.com/geerlingguy/pi-kiosk) — Chromium startup | README demonstrates Pi 5 and graphical Pi OS | GPL-3.0 | No GitHub release resolved; 2026-04-27 | Concise practical guide, explicitly not robust/security hardened; low/medium | Reference startup approach; create own minimal service/autostart with escape path |
| [RomM](https://github.com/rommapp/romm) — ROM catalog/player | Self-hosted server/browser; current ARM64 image not independently inspected | AGPL-3.0 | 5.4.0; 2026-10-14 | Broad product docs and migration/saves features; high integration footprint | Reference catalog concepts; prefer small local SQLite index for initial native launcher |
| [Cockpit](https://github.com/cockpit-project/cockpit) — Linux administration dashboard | Linux host plus browser; distro package availability to verify for ARM64 | Mixed LGPL-2.1+, GPL-3.0+, BSD-3, CC-BY-SA | 369; 2026-10-19 | Extensive admin/dev docs; high to embed | Reference terminal/session practices; do not re-theme a full sysadmin stack |
| [Cyber Controller](https://github.com/LxveAce/cyber-controller) — cyberdeck device tools | README advertises Linux/macOS/Windows/ARM; exact Pi 5 qualification not established | MIT root, upstream components separate | v2.0.1; 2026-09-10 | Documents known hardware limits; high/mismatched scope | Do not reuse: firmware/security-device workflow differs from this product |

No code from these repositories was copied. UI, command navigation, service scaffold and deployment examples are original. GPL/AGPL components remain separately installed integrations; revisit redistribution obligations before packaging binaries. Brand ownership and project licensing are separate from dependency licenses.

## Search coverage and rejected assumptions

GitHub searches covered Raspberry Pi cyberdeck dashboards, React Linux dashboards, RetroArch/ROM launchers, gpsd/Pi navigation, offline MapLibre/PMTiles, Pi kiosk and Geekworm X1202. Direct repository/README inspection covered system monitoring, browser terminals, Python MCP, Kiwix and ROM catalogs. Generic dashboard results were often unrelated or aimed at device flashing. Search ranking does not establish suitability. The archived `anthony-mills/raspberrypi-carputer` is not a preferred foundation.

`geekworm-com/x1202` and `ES-DE/ES-DE` returned 404. The former was corrected to the vendor's `x120x`. ES-DE's canonical development is hosted on [GitLab](https://gitlab.com/es-de/emulationstation-de); current release/license/ARM64 packaging still need a dedicated check. Keep ES-DE optional as an external launcher, not a foundation dependency. Do not equate the older EmulationStation GitHub project with current ES-DE. Old emulator metadata can be imported only after preserving original saves and validating paths/core mappings.

## Stack recommendation

Use the requested React/TypeScript/Vite and FastAPI/Pydantic stack. It adds no desktop runtime beyond Chromium already on Pi OS. SQLite is appropriate for one machine. Keep the first hardware milestone read-only. Wrap existing tools through adapters; fork none. Build only the Klinekraft interaction layer, catalog/approved command orchestration and narrow hardware adapters.

Pi 5 ARM64 suitability is an engineering assessment supported by upstream Linux/Pi/browser support, not a completed deployment test. Gate production on actual ARM64 installation, WebGL/driver behavior, RAM/thermal profiling, touchscreen and peripherals. Avoid claiming that every N64 core/game will run well.

## Specific integration findings

- RetroArch explicitly supports launcher integration and a CLI. Resolve stored IDs/paths and use argument arrays; arbitrary titles must never become shell strings.
- xterm.js explicitly is not a shell. A real PTY process and secure session lifecycle are required.
- Kiwix supplies `kiwix-manage`, `kiwix-search`, `kiwix-serve`; use these rather than writing a ZIM reader.
- PMTiles requires local range-capable hosting and complete local styles, glyphs and sprites for offline maps.
- The official MCP SDK's current README uses v2 `MCPServer` and Python 3.11+, so old API examples should not be copied blindly.
- X1202 vendor samples expose voltage and estimated charge; no verified time remaining or battery-health API. See [hardware notes](HARDWARE.md).

## Remaining research gates

Full official MCP specification review, current ChatGPT custom connector requirements, ES-DE release/ARM64 packaging, GPS receiver model compatibility, vendor board-revision documentation and actual Pi package tests remain before those phases. There is no need to install or expose any of those integrations to preview Phase 1.

## Host telemetry integration update — 2026-10-22

psutil 7.2.2 is now installed as a normal dependency, following the reuse decision above. Read-only collection is exercised in Linux x86_64 tests; missing macOS sensor APIs are covered with fixtures. ARM64/macOS physical execution is not claimed. No upstream source was copied.
