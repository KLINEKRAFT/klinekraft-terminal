# Screen Cast

Network → Screen Cast → Start Screen Cast. On an iPhone/iPad open Control Center → Screen Mirroring → Klinekraft Deck. On a Mac use Control Center → Screen Mirroring. Both devices must share a local network; the deck hotspot is an alternative to home Wi-Fi. Show pairing PIN in Terminal when prompted. Each start creates a fresh PIN.

Fullscreen is selected before starting; changing it requires stop/start. Stop Mirroring on the phone closes its mirror window and returns to Terminal. Stop Screen Cast in Network turns off the receiver. It is not enabled at boot. Audio uses the Pi desktop's selected output. The receiver does not control your phone, transfer files, or record streams.

Local content does not need internet, but online streaming does. Protected video can be blank. UxPlay's receiver state indicates its process is running, not that a phone is connected. iPhone playback, audio output, fullscreen and hotspot mirroring require device acceptance testing.

Installed from Debian Trixie: UxPlay 1.71.1-1. Run `bash scripts/setup-casting.sh` to reinstall dependencies and the opt-in user unit. The Pi desktop session must supply WAYLAND_DISPLAY and XDG_RUNTIME_DIR to systemd --user (the existing desktop setup does this). Request resolution is 1024×600 at 30 fps, using software H.264 decoding and Wayland video output. PIN configuration is mode 600 at ~/.config/klinekraft/uxplayrc and is returned only through the guarded local API with Cache-Control: no-store. No credentials are committed.

Troubleshooting: check `systemctl --user status klinekraft-cast.service` and `avahi-browse -t _airplay._tcp`. Receiver name should be Klinekraft Deck. Guest Wi-Fi client isolation or VPNs can prevent discovery. The service suppresses stdout/stderr to avoid storing pairing PINs and client identifiers in journals.

Upstream: https://github.com/FDH2/UxPlay
