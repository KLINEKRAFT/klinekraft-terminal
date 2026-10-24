"""Store a provider key locally, outside the repository, without echoing it."""
import getpass
import os
from pathlib import Path
import subprocess

if os.geteuid() == 0:
    raise SystemExit('Run as your normal Pi user, not with sudo.')
key = getpass.getpass('OpenAI API key (hidden while you type/paste): ').strip()
if not key or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in key):
    raise SystemExit('Invalid key format. Nothing was saved.')
directory = Path.home() / '.config/klinekraft'
directory.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(directory, 0o700)
path = directory / 'ai.env'
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, 'w') as file:
    os.fchmod(file.fileno(), 0o600)
    file.write('OPENAI_API_KEY=' + key + '\n')
dropin = Path.home() / '.config/systemd/user/klinekraft.service.d'
dropin.mkdir(parents=True, exist_ok=True)
(dropin / 'ai.conf').write_text('[Service]\nEnvironmentFile=%h/.config/klinekraft/ai.env\n')
subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
subprocess.run(['systemctl', '--user', 'restart', 'klinekraft.service'], check=True)
print('AI key saved locally. Refresh Klinekraft and open AI assistant. No API request has been made yet.')
