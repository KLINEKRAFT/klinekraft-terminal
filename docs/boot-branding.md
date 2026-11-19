# Boot and login branding

Install from the repository root with `sudo bash scripts/install-boot-branding.sh`.
Requires the Raspberry Pi OS pix Plymouth theme and pi-greeter configuration.
Uses the existing logo artwork and Terminal paper color (#f2f0ea), with a separate
Plymouth theme so the supplied pix theme remains intact. Regenerates installed
initramfs images. The login greeter uses the same logo and background.

This does not alter firmware/early kernel splash graphics, automatic login,
or reboot the machine. Desktop autostart opens a maximized Chromium app window
via the separately installed desktop integration. Automatic login skips the greeter.
Actual appearance and startup must be checked on the next restart.

Original configuration is retained in `/etc/plymouth/plymouthd.conf.before-klinekraft`
and `/etc/lightdm/pi-greeter.conf.before-klinekraft` (first installation only).
To restore, copy those files over the respective configuration files, then run
`sudo update-initramfs -u -k all`. No user data or browser profile is changed.

## Password login (optional)

When requested by the owner, `sudo bash scripts/install-password-login.sh`
disables the existing Seat:* autologin entries and installs a separate
Klinekraft-Login GTK theme using the original blue K artwork, paper background,
and blue focus accents. It backs up both LightDM configuration files with a
`before-password-login-TIMESTAMP` suffix and does not restart LightDM or reboot.
`lightdm --show-config` verifies the resulting session configuration.

The existing LightDM PAM keyring hooks are left unchanged. A matching login and
keyring password should unlock the login keyring during normal password login;
this must be verified at the next real login. Never erase or remove encryption
from the keyring to suppress a prompt. To revert this login change, restore the
two matching timestamped configuration backups before the next boot.
