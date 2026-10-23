# Candidate additions

Reviewed 23 October 2026. These are suggestions, not installed features. The user requested a minimal terminal, so tools should open on demand rather than add permanent Home panels.

## Reuse from KLINEKRAFT

| Repository | Useful piece | Proposed fit | Limits |
| --- | --- | --- | --- |
| [beats](https://github.com/KLINEKRAFT/beats) | Web Audio drum/synth engine, sequencer, local patterns and sample storage | A small music-making tool under Games or a future Tools page | Test Pi audio latency; bundle assets for offline use |
| [Sun-path](https://github.com/KLINEKRAFT/Sun-path) | Local solar-position and sunrise/sunset calculations; already defaults to Tulsa | Optional daylight details beside weather | Use the calculation piece, not phone camera/compass UI; validate astronomical results |
| [Archive-Scout](https://github.com/KLINEKRAFT/Archive-Scout) | Tulsa library, Oklahoma Digital Prairie and other archive adapters; research boards | Library research shortcut first, selected saved content later | Live search needs internet; some providers need keys; retain item-specific rights/attribution |
| [braun-controls](https://github.com/KLINEKRAFT/braun-controls) | Keyboard/pointer control interactions and density concepts | Reusable controls for a future audio player or settings | Keep terminal fonts; UI power switch is a visual state, not real Pi shutdown |
| [recipes-no-bs](https://github.com/KLINEKRAFT/recipes-no-bs) | Ingredients-and-steps reading format | An optional recipe reference collection in Library | Candidate based on README; offline persistence/import still needs inspection |

Source inspection: beats and Sun-path HTML/source; Archive-Scout, braun-controls and recipes-no-bs READMEs. This is a focused review of promising candidates, not a security or compatibility audit of every repository.

## Community tools

| Project | Why it fits | Connection |
| --- | --- | --- |
| [nnn](https://github.com/jarun/nnn) | Small keyboard-driven file manager; upstream explicitly supports Raspberry Pi | Local/offline |
| [btop](https://github.com/aristocratos/btop) | Detailed resource graphs and process inspection | Local/offline |
| [cmus](https://github.com/cmus/cmus) | Compact music library/player for local audio | Local/offline with music files |
| [PyRadio](https://github.com/coderholic/pyradio) | Internet radio, station favorites and playlists | Internet streaming; needs mpv, VLC or MPlayer |
| [tty-solitaire](https://github.com/mpereira/tty-solitaire) | Keyboard solitaire without a ROM or controller | Local/offline |
| [Fastfetch](https://github.com/fastfetch-cli/fastfetch) | Quick machine summary and configurable terminal identity | Local/offline |
| [Yazi](https://github.com/sxyazi/yazi) | Rich file navigation and previews | Local; preview helpers add dependencies |

These run in a real terminal. Klinekraft's current command field does not provide an interactive shell. Start with desktop terminal launchers; embedding them would need a separate PTY/terminal integration and package/license review. Prefer nnn for a small Pi footprint, or Yazi if rich previews matter. Do not install both by default.

Recommended order: a small beats tool for fun, nnn for utility, then optional daylight details. Keep the existing Away background selection limited to its three requested choices.
