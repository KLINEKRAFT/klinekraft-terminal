#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
ai_root="$HOME/.local/share/klinekraft/ai"
model="$ai_root/models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
sudo apt-get install -y cmake libssl-dev
mkdir -p "$ai_root/models" "$HOME/.config/systemd/user"
if [ ! -d "$ai_root/llama.cpp" ]; then
  git clone --depth 1 --branch v1.0.0 https://github.com/ggml-org/llama.cpp.git "$ai_root/llama.cpp"
fi
if [ "$(git -C "$ai_root/llama.cpp" rev-parse HEAD)" != 'b1b770d90d94cad9e9ea5b993bdbc383a522fb28' ]; then
  echo 'Unexpected llama.cpp revision; inspect before building.' >&2
  exit 1
fi
cmake -S "$ai_root/llama.cpp" -B "$ai_root/llama.cpp/build" -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON -DLLAMA_BUILD_TESTS=OFF
nice -n 10 cmake --build "$ai_root/llama.cpp/build" --target llama-server -j 2
if [ ! -f "$model" ]; then
  curl -fL --retry 3 -C - -o "$model.partial" 'https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF/resolve/4edb920b6f14e3b9284d4502a6485103d72cde05/Qwen3-4B-Instruct-2507-Q4_K_M.gguf'
  echo "8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc  $model.partial" | sha256sum -c -
  mv "$model.partial" "$model"
fi
echo "8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc  $model" | sha256sum -c -
mkdir -p "$HOME/.config/klinekraft"
if [ ! -f "$HOME/.config/klinekraft/local-ai.key" ]; then
  (umask 077; openssl rand -base64 32 > "$HOME/.config/klinekraft/local-ai.key")
fi
install -m 644 "$repo_root/deploy/systemd/klinekraft-ai.service" "$HOME/.config/systemd/user/klinekraft-ai.service"
systemctl --user daemon-reload
systemctl --user enable --now klinekraft-ai.service
