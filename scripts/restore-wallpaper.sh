#!/usr/bin/env bash
# Restore the existing Klinekraft wallpaper on both Pi HDMI outputs.
set -euo pipefail
wallpaper_file=${1:-"$HOME/Pictures/Klinekraft/klinekraft-terminal.png"}
if [ ! -f "$wallpaper_file" ]; then
  printf 'Wallpaper not found: %s\n' "$wallpaper_file" >&2
  exit 1
fi
python3 - "$wallpaper_file" <<'PY'
import configparser, pathlib, shutil, sys
image = pathlib.Path(sys.argv[1]).resolve()
root = pathlib.Path.home() / '.config/pcmanfm/default'
root.mkdir(parents=True, exist_ok=True)
paths = set(root.glob('desktop-items-*.conf'))
paths.update(root / ('desktop-items-' + output + '.conf') for output in ('HDMI-A-1', 'HDMI-A-2'))
for path in paths:
    config = configparser.ConfigParser(interpolation=None)
    if path.exists():
        backup = path.with_name(path.name + '.before-wallpaper-restore')
        if not backup.exists(): shutil.copy2(path, backup)
        config.read(path)
    if not config.has_section('*'): config.add_section('*')
    config['*']['wallpaper'] = str(image)
    config['*']['wallpaper_mode'] = 'center'
    config['*']['wallpaper_common'] = '1'
    if 'desktop_bg' not in config['*']: config['*']['desktop_bg'] = '#f2f0ea'
    with path.open('w') as handle: config.write(handle, space_around_delimiters=False)
PY
pcmanfm --reconfigure
pcmanfm --set-wallpaper="$wallpaper_file" --wallpaper-mode=center
printf '%s\n' 'Wallpaper restored for both HDMI ports.'
