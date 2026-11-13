# Games on the Pi

Klinekraft can import, browse, search, favorite and launch NES, SNES and Genesis/Mega Drive games using local RetroArch cores. This requires the Pi desktop. The hosted demo does not access your games or launch programs.

## From the Mac to the Pi

Keep the backup at `~/Games/Klinekraft/roms` on the Mac. The flash drive remains unchanged. Eject the flash drive normally before moving it to the Pi. Connect it and the SAFFUN controller's USB receiver to the Pi; the receiver is a USB controller connection, not Bluetooth pairing. Which of the two supplied dongles matches the controller still needs testing.

On the **Pi desktop**, update and build the app, then locate the USB mount:

```bash
cd ~/klinekraft-terminal
git pull --ff-only origin codex/sidebar-dark-mode
npm ci
npm run build
lsblk -o NAME,LABEL,FSTYPE,SIZE,MOUNTPOINTS
```

Use the actual path printed for NO NAME. For example, only if mounted at `/media/klinekraft/NO NAME`:

```bash
bash scripts/setup-games.sh "/media/klinekraft/NO NAME/retropie/roms"
```

The installer installs RetroArch and Nestopia. It also installs Snes9x and Genesis Plus GX if available in your configured apt sources. Debian distributes those two cores in non-free; if absent, setup reports that clearly and their Play buttons remain disabled. The installer does not silently rewrite apt sources or download arbitrary emulator binaries. Run `apt-cache policy libretro-snes9x libretro-genesisplusgx` to diagnose availability.

It then copies supported games, backs up saves, enables the launcher, and connects the backend to your graphical desktop. Run this from a Terminal window on the Pi desktop, not from a headless SSH session. A desktop-autostart helper refreshes the service's display environment on later logins. The game service override disables the backend's private /tmp so RetroArch can see X11/XWayland sockets; other service restrictions remain. It does not run as root.

Refresh `http://127.0.0.1:8000/` and open Games. Click Play to open RetroArch full screen on the Pi. If it fails, read `~/Games/Klinekraft/last-game.log`. A single active launch is allowed. The frontend reports startup failures and nonzero exits. Manual RetroArch sessions outside this launcher are not tracked.

## Import behavior and saves

Source files are never moved or deleted. ZIPs are read without extracting paths onto your filesystem. Supported ROM members are copied to isolated content folders using a SHA-256 content ID. The scanner checks NES signatures and Genesis headers; SNES files use their `.sfc`/`.smc` extension and size layout. This is classification, not an emulator compatibility guarantee. Files named `.md` in `sega32x` are correctly classified as Genesis when their header confirms it. Actual 32X, ambiguous binary formats, large or corrupt files are skipped and reported. Each ROM must fit within 32 MB.

Byte-identical ZIP/unpacked copies share one catalog entry. Different regions, revisions, copier headers and modified ROMs remain separate unless their bytes are identical. Favorites stay in this browser's local storage.

Save files (`.srm`, `.sav`, `.state*`, up to 32 MB each) are backed up under `~/Games/Klinekraft/save-backups`, retaining source folder structure and content hashes. A uniquely matched `.srm` is copied into a per-game active save folder only if no active save already exists. Conflicts remain backed up for manual selection; `.sav` and save states are not blindly converted or activated. Original saves and newer active progress are never overwritten by reimport. A missing game match is recorded in the report.

Library paths:

- `~/Games/Klinekraft/catalog.json`: imported game metadata.
- `~/Games/Klinekraft/content/<id>/game.*`: copied ROM.
- `~/Games/Klinekraft/saves/<id>/game.srm`: active battery-backed save.
- `~/Games/Klinekraft/import-report.json`: skipped files, conflicts and counts.

To import again without installing packages:

```bash
cd ~/klinekraft-terminal
.venv/bin/python -m klinekraft.game_import "/actual/USB/path/retropie/roms"
```

Choose Refresh games afterward. Back up the entire `~/Games/Klinekraft` directory to retain current progress. Future save data is written by the emulator, not to the USB originals.

## Controller and returning to Klinekraft

Keep a keyboard handy for first setup. Connect one SAFFUN receiver, turn on the controller, and verify its buttons in RetroArch. If needed, use Settings → Input → RetroPad Binds → Port 1 Controls. Use F1 to open the menu and Quit RetroArch to return to the dashboard. Do not assume a controller button mapping until it has been physically tested. This setup does not impose a controller exit-button combination or overwrite your RetroArch controls.

## Boundaries and verification

Only explicit Play clicks call the launch endpoint. Typed workspace commands open Games but never execute a command. Launch requests take a catalog ID, never an executable, shell string, arbitrary core or user-supplied path. Fixed system-to-core mappings and an argument array select RetroArch. The local custom-header guard is shared with Files; CORS remains disabled and the service must stay loopback-only.

Automated tests cover importer classification, ZIP/unpacked duplication, save preservation/conflicts, invalid IDs/paths, fixed launch arguments, filtering, favorites and disabled launch states. Real emulator performance, sound, display startup, imported save compatibility and the SAFFUN receiver must be verified on the Pi. No ROM content is bundled.
