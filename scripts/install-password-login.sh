#!/usr/bin/env bash
# Enable the owner's requested password login; never restart the desktop here.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $(id -u) != 0 ]]; then
  echo 'Run with sudo bash scripts/install-password-login.sh' >&2
  exit 1
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for file in /etc/lightdm/lightdm.conf /etc/lightdm/pi-greeter.conf; do
  test -f "$file"
  cp -a "$file" "$file.before-password-login-$stamp"
done
install -d /usr/share/klinekraft /usr/share/themes/Klinekraft-Login/gtk-3.0
install -m 644 frontend/public/brand/lockup-640.png /usr/share/klinekraft/lockup.png
install -m 644 frontend/public/brand/logo-128.png /usr/share/klinekraft/logo.png
cat > /usr/share/themes/Klinekraft-Login/gtk-3.0/gtk.css <<'CSS'
@import url("../../PiXonyx/gtk-3.0/gtk.css");
@define-color theme_selected_bg_color #0227ff;
@define-color theme_selected_fg_color #ffffff;
@define-color selected_bg_color #0227ff;
@define-color selected_fg_color #ffffff;
entry { border-radius: 4px; padding: 8px; }
entry:focus { border-color: #0227ff; box-shadow: inset 0 0 0 1px #0227ff; }
button { border-radius: 4px; padding: 6px 12px; }
button.suggested-action { background-image: none; background-color: #0227ff; color: white; }
CSS
python3 - <<'PY'
from pathlib import Path
import configparser
p=Path('/etc/lightdm/lightdm.conf')
s=p.read_text().splitlines()
# Existing settings live in Seat:*; retain all other sections/comments.
section=''
for index,line in enumerate(s):
    if line.strip().startswith('['): section=line.strip()
    if section=='[Seat:*]' and line.split('=',1)[0].strip() in {'autologin-user','autologin-session','autologin-user-timeout'}:
        s[index]='# Disabled for Klinekraft password login: '+line
p.write_text('\n'.join(s)+'\n')
p=Path('/etc/lightdm/pi-greeter.conf')
c=configparser.ConfigParser();c.read(p)
c['greeter'].update({'default-user-image':'/usr/share/klinekraft/logo.png',
                     'desktop_bg':'#f2f2f0f0eaea','wallpaper':'/usr/share/klinekraft/lockup.png',
                     'wallpaper_mode':'center','gtk-theme-name':'Klinekraft-Login'})
with p.open('w') as f:c.write(f,space_around_delimiters=False)
PY
lightdm --show-config
printf '\nPassword login configured for next boot. Current session stays running.\n'
