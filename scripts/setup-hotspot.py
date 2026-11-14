#!/usr/bin/env python3
"""Create a password-protected, opt-in hotspot; never activate during setup."""
import json,os,secrets,string,subprocess
from pathlib import Path
from uuid import uuid4
root=Path(__file__).resolve().parents[1]
config=Path.home()/'.config/klinekraft/hotspot.json'
if config.exists():
    print('Hotspot already configured. No credentials changed.');raise SystemExit(0)
password=''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(20))
uuid=str(uuid4())
subprocess.run(['nmcli','connection','add','type','wifi','ifname','wlan0','con-name','klinekraft-field-hotspot','connection.uuid',uuid,'autoconnect','no','ssid','Klinekraft Field Library','802-11-wireless.mode','ap','802-11-wireless.band','bg','wifi-sec.key-mgmt','wpa-psk','wifi-sec.psk',password,'ipv4.method','shared','ipv4.addresses','10.42.0.1/24','ipv6.method','disabled'],check=True,stdout=subprocess.DEVNULL)
config.parent.mkdir(parents=True,exist_ok=True)
fd=os.open(config,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump({'uuid':uuid,'password':password},f)
service=Path.home()/'.config/systemd/user/klinekraft-field-library.service'
service.parent.mkdir(parents=True,exist_ok=True)
service.write_text(f'''[Unit]
Description=Klinekraft read-only field library
[Service]
WorkingDirectory={root}/backend
ExecStart={root}/.venv/bin/python -m uvicorn klinekraft.field_library:app --host 10.42.0.1 --port 8090
NoNewPrivileges=true
Restart=on-failure
RestartSec=5
''')
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
print('Hotspot profile prepared; inactive. Credentials are shown only in the local Terminal interface.')
