# Offline maps

GPS / Maps uses MapLibre GL and a local Protomaps PMTiles vector archive. The first national extract covers the lower 48 and Alaska (including the Aleutians), **excluding Hawaii**, through zoom 14. The rectangular extraction bounds also include nearby border areas; this is not a political boundary clip. Zooming beyond 14 enlarges the stored detail.

Tiles, styles, fonts and scripts are served by the Pi. No remote map/font server or account is needed to view the installed region. Click a map location, or enter latitude/longitude, then name and save it. Places persist in the same SQLite database as notes and are included in the existing encrypted backup. The large, replaceable map archive is not included in daily cloud backups.

This release provides an offline atlas, coordinate lookup and saved places. It does not yet provide address search, route calculation, turn-by-turn navigation or a connected GPS receiver. Existing Home weather may still use the network independently of the map.

## Install or refresh

Use an ARM64 executable from the [official go-pmtiles releases](https://github.com/protomaps/go-pmtiles/releases); the initial install used v1.31.2. The [Protomaps download documentation](https://docs.protomaps.com/basemaps/downloads) lists dated world builds. The CLI extracts selected tiles without downloading the entire planet.

```sh
python3 scripts/setup-maps.py --pmtiles /path/to/pmtiles \
  --source https://build.protomaps.com/20261113.pmtiles
```

Allow about 10 GB for the extract and at least 15 GiB free while installing, plus space for any existing archive. Size changes between source builds. The script stages and verifies the new archive before replacing the active map. If interrupted, inspect and remove the incomplete `.partial` file before restarting; it is not resumable. An old map remains usable during extraction. Reopen Maps afterward to clear cached tiles.

Data lives in `~/.local/share/klinekraft/maps` (override with `KLINEKRAFT_MAPS_DIR`). `region.pmtiles` and `region.json` describe the active region. Fonts are Noto Sans Regular, all 256 BMP glyph blocks, from the pinned basemaps-assets commit recorded in the installer. The font's OFL license is installed alongside them. Map data credits OpenStreetMap contributors and Protomaps in the map controls.

## Design decision

[MapLibre integration](https://docs.protomaps.com/pmtiles/maplibre) supports a single locally served archive and custom Klinekraft colors. [The extraction CLI](https://docs.protomaps.com/pmtiles/cli) supports selected regions and zoom limits. This avoids bulk downloading raster tiles from public OpenStreetMap servers and keeps the atlas integrated with Terminal. Organic Maps remains a possible separate desktop option for offline routing later.
