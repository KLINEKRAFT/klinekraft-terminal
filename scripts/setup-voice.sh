#!/bin/bash
set -euo pipefail
cd "$HOME/klinekraft-terminal"
.venv/bin/pip install -e './backend[voice]'
voice_dir="$HOME/.local/share/klinekraft/voice"
mkdir -p "$voice_dir"
if [ ! -d "$voice_dir/vosk-model-small-en-us-0.15" ]; then
  curl --fail --location --retry 2 https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o "$voice_dir/model.zip"
  python3 -m zipfile -e "$voice_dir/model.zip" "$voice_dir"
  rm "$voice_dir/model.zip"
fi
sudo apt-get install -y gir1.2-gtklayershell-0.1 python3-gi-cairo ffmpeg
install -m 644 systemd/klinekraft-voice-overlay.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now klinekraft-voice-overlay.service
printf '%s\n' 'Voice installed. Enable the microphone in Terminal → Settings → Speech.'
