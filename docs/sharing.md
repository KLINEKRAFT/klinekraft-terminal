# Phone and Mac file sharing

The Pi uses the official LocalSend ARM64 Debian package. LocalSend opens from
Home → Tools → Share · LocalSend, or the desktop application menu. The launcher
uses a fixed executable, without a shell or user-supplied arguments.

Current device setup:

- Device name: Klinekraft Cyberdeck
- Incoming folder: `~/Downloads/Received`
- HTTPS enabled; Quick Save off so incoming transfers require acceptance
- Dark appearance with orange accent
- Desktop-login autostart: `~/.config/autostart/klinekraft-share.desktop`
  runs `/usr/bin/localsend_app --hidden`

Install LocalSend on the phone/Mac and connect both devices to the same local
network. On iPhone, allow Local Network access. Choose Send, select a file,
then select Klinekraft Cyberdeck and accept on the Pi. Alt+Tab switches from
Terminal to the LocalSend window. No cloud account is required.

LocalSend's own settings control its destination, appearance, and acceptance
policy. Its per-user configuration is outside this repository and contains
private keys; never commit that file. No public port forwarding is needed.

Installed release: 1.18.2+64 from
https://github.com/localsend/localsend/releases/tag/v1.18.2

Package SHA-256 verified against the official GitHub release asset digest:
`bbd8347b7979f936d3bae176a3f0d9b81431605707c585270d6240f7670feb1f`.

Validation: launcher unit tests and frontend build. LocalSend's local HTTPS
info endpoint confirms its configured alias and receive capability. The first
phone-to-Pi transfer still needs to be completed on the user's phone.
