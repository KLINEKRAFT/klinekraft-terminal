# GPS and offline maps

Status: planned; UI coordinates are explicitly simulated. No map is presented as operational.

Reuse gpsd to normalize USB receiver data; its upstream source is [gitlab.com/gpsd/gpsd](https://gitlab.com/gpsd/gpsd), with a [GitHub mirror](https://github.com/ntpsec/gpsd). The README documents receiver protocols and local client port 2947. Use `gpspipe`, `gpsmon` and the receiver compatibility list during Pi commissioning. Avoid bespoke NMEA parsing until gpsd proves insufficient.

Design the adapter around disconnected, connected/no-fix, 2D fix, 3D fix and stale states. Consume TPV and SKY data, retaining absent optional fields as null. Latitude/longitude require a valid fix; altitude, speed, track and error estimates may be missing. Do not label a mode-2 fix as having reliable altitude. Retain the last known position with its timestamp, but mark it stale after signal loss. Use exponential reconnect backoff and cancellation. macOS uses a deterministic fixture source.

MapLibre GL JS is the recommended renderer. Use local PMTiles regions and HTTP byte-range serving; PMTiles' JS implementation can read ranges without a dedicated tile database server. MBTiles is an alternative when a SQLite tile endpoint is useful. Neither is implemented. Keep style JSON, sprites, glyphs and tiles local; downloading tiles alone does not produce an offline map. Respect source attribution and redistribution terms. Avoid bulk scraping public OSM tile servers. Preflight archive size against the SD card; the full planet and full Wikipedia may exceed the storage budget.

Test an installed region with external networking disabled, zoom/pan beyond bounds, missing glyphs, corrupt archives and disk-full conditions. Benchmark WebGL and memory on the Pi 5. Position display is not route guidance: offline routing requires a separate engine/data decision. Later tracks need time-ordered samples, filtering of invalid fixes, batched writes, explicit recording controls and GPX export. No routing or tracks are claimed in Phase 1.
