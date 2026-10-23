# Desktop tools

From Terminal on the Pi desktop (not SSH or the Mac):

```bash
cd ~/klinekraft-terminal
bash scripts/setup-tools.sh
```

This installs lxterminal, nnn, btop and cmus from the configured Debian repositories, enables `KLINEKRAFT_TOOLS=1` in a user-service drop-in, and imports the current desktop session through the existing Games session helper. The shared helper runs at desktop login and restarts the local service with the display environment. No third-party shell installer is downloaded.

Refresh the browser and choose Home → Tools. Each utility opens in its own terminal window. Alt+Tab switches windows. Close the utility window to return; these are real local programs running as your desktop user. nnn can modify files, btop can manage processes, and cmus plays your own local music. No music is bundled; use cmus's `:add ~/Music` command to add a folder. Basic keyboard help is available through `?` in nnn and `h` in btop; cmus documentation is available with `man cmus`.

Only three fixed application IDs are accepted by the backend. It constructs fixed executable arguments with no shell, checks the desktop session and installed tools, and requires the dashboard's local-client header. Missing utilities stay disabled. The hosted demo never calls the local tools API. The launcher requests a desktop window; some terminal clients hand off to an existing terminal process, so the API cannot always track the utility's lifetime or confirm window visibility. Check for an existing window before retrying a timed-out launch.

To disable launching, remove `~/.config/systemd/user/klinekraft.service.d/tools.conf`, then run `systemctl --user daemon-reload` and `systemctl --user restart klinekraft.service`. Leave the shared desktop-session helper in place if you use Games. Installed utility packages remain available from the desktop.

Local telemetry now defaults to live and persists `host` or `preview` under `klinekraft.dataMode.v1` in browser storage. Invalid or inaccessible storage defaults to live. A failed write displays a Settings warning. Clearing browser storage resets the local default to live; the hosted demo always uses preview. Service failure shows unavailable/stale readings, never synthetic measurements. Automatic-update pause remains session-only.

Validation includes backend allowlist, header guard, unavailable/duplicate/failed launches with mocked processes, browser persistence and explicit launch tests, and the real host-telemetry integration. Pi graphical launches need on-device verification after installation.
