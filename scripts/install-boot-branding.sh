#!/usr/bin/env bash
# Install Klinekraft branding without changing login policy or rebooting.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $(id -u) != 0 ]]; then
  echo "Run with sudo: sudo bash scripts/install-boot-branding.sh" >&2
  exit 1
fi
for file in /etc/plymouth/plymouthd.conf /etc/lightdm/pi-greeter.conf; do
  if [[ ! -e "$file.before-klinekraft" ]]; then cp -a "$file" "$file.before-klinekraft"; fi
done
install -d /usr/share/plymouth/themes/klinekraft /usr/share/klinekraft
install -m 644 frontend/public/brand/lockup-640.png /usr/share/klinekraft/lockup.png
install -m 644 frontend/public/brand/logo-128.png /usr/share/klinekraft/logo.png
install -m 644 frontend/public/brand/lockup-640.png /usr/share/plymouth/themes/klinekraft/splash.png
cat > /usr/share/plymouth/themes/klinekraft/klinekraft.plymouth <<'THEME'
[Plymouth Theme]
Name=Klinekraft Terminal
Description=Klinekraft Terminal boot branding
ModuleName=script
[script]
ImageDir=/usr/share/plymouth/themes/klinekraft
ScriptFile=/usr/share/plymouth/themes/klinekraft/klinekraft.script
THEME
# Retain the OS theme's sizing and status-message behavior.
sed '1i Window.SetBackgroundTopColor(0.949, 0.941, 0.918);\nWindow.SetBackgroundBottomColor(0.949, 0.941, 0.918);' /usr/share/plymouth/themes/pix/pix.script > /usr/share/plymouth/themes/klinekraft/klinekraft.script
python3 - <<'CONFIG'
from pathlib import Path
p=Path('/etc/lightdm/pi-greeter.conf')
s=p.read_text()
values={'default-user-image':'/usr/share/klinekraft/logo.png', 'desktop_bg':'#f2f2f0f0eaea', 'wallpaper':'/usr/share/klinekraft/lockup.png', 'wallpaper_mode':'center'}
lines=[]
for line in s.splitlines():
 key=line.split('=',1)[0]
 lines.append(key+'='+values[key] if key in values else line)
p.write_text('\n'.join(lines)+'\n')
CONFIG
plymouth-set-default-theme klinekraft
update-initramfs -u -k all
printf 'Klinekraft boot and login branding installed. Restart when ready to verify.\n'
