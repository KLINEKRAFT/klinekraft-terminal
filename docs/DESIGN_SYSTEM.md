# Design system

The visual direction follows Rams/Braun instrumentation and Swiss typography: warm surfaces, strong alignment, fine rules, functional controls and limited accent color. No gradients, scanlines, glows, glass or gaming decoration.

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#F2F0EA` | Main canvas |
| `--panel` | `#E4E1DA` | Warm secondary surface |
| `--ink` | `#242424` | Text and primary rules |
| `--muted` | `#69675F` | Secondary labels |
| `--line` | `#D2CFC6` | Dividers |
| `--blue` | `#003DA5` | Focus, information |
| `--orange` | `#FF6A00` | Active navigation and preview indicator |

Tokens live in `frontend/src/styles.css`. Orange is an indicator rather than small body text. Selection also has a filled background and `aria-current`, so color is not the only cue. Focus uses a visible blue outline. Primary font: Inter; technical labels: IBM Plex Mono; wordmark: Archivo Expanded Regular, lowercase, following the supplied geometric sans-serif reference. This is a visual match in direction, not an identification of the reference font. Fonts ship locally through Fontsource (SIL Open Font License); no Google Fonts request is required.

Layout starts with a 204px sidebar at 1024×600. Dashboard columns use `minmax(0,1fr)` to prevent overflow. Large screens add whitespace and typography size, rather than stretching a bitmap. Below 850px, metrics and quick access reflow; smaller phone layouts are outside the primary acceptance target. Touch controls are at least 44px high. Navigation is native buttons; keyboard focus, Cmd/Ctrl+K and Escape are supported. Motion is limited to hover transitions and respects reduced-motion preferences.

## Brand contract

`KlinekraftLogo`, `KlinekraftWordmark`, `KlinekraftBrandLockup` are separate reusable components. The logo component renders only when the asset manifest indicates that the original has been imported. No generic K or approximate SVG is used. `scripts/import-brand.mjs` preserves the PNG byte-for-byte and resizes with `fit: inside`; square icons use transparent padding with `fit: contain`. Colors, silhouette and proportions are not redrawn. Keep at least 10px clear space in the lockup. The supplied original is committed in `assets/brand/klinekraft_logo_geometric.png`; the sidebar uses a 36px mark beside a 21px lowercase wordmark at the primary display size. Monochrome transformation is deliberately not implemented.

The preview always displays a simulated-data badge. A live computer clock is distinct from simulated hardware readings. Planned feature screens explain missing capabilities without disabled controls that pretend to work.

The wordmark uses the actual `Archivo_Expanded-Regular.ttf` supplied by the user, rather than stretching normal-width glyphs. The provided web snippet uses `wdth: 100` (normal width); selecting the static Expanded cut makes the requested width explicit. The symbol and two-line wordmark are vertically centered, with a 6px gap before the secondary label.

## Complete supplied lockup

The active sidebar now displays the complete `klinekraft_terminal_logo@5x.png` artwork as a single proportional image. This supersedes the separately typeset Archivo wordmark in the sidebar and preserves the owner’s exact lettering and alignment. Archivo remains available for the reusable standalone wordmark component. The lockup is served in 320px and 640px versions; the separate symbol continues to supply square icons.
