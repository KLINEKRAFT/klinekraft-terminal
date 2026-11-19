# Whole-monitor blackouts when opening Maps

Owner reports the entire MPI7002 display goes black / No signal, with its USB
power coming from the Pi and the deck charger connected. This is distinct from
an isolated WebGL canvas flicker.

Observed before changes:
- Native display mode 1024×600 at 60.044 Hz, scale 1, adaptive sync disabled.
- Pi throttling/undervoltage flags 0x0; CPU approximately 137°F (58.2°C).
- PMIC input sampled around 4.96 V and HDMI rail around 4.98 V at rest.
- Boot power metadata: max_current 3000, usb_max_current_enable 0,
  usb_over_current_detected 0. USB peripherals therefore share the low 600 mA budget.
- Repeated HDMI audio `Unknown ELD version 0` messages during the reported period.
  These are not proof of the root cause; no accompanying GPU crash or OOM found.
- RAM available about 1.6 GiB and swap nearly full; avoid unnecessary render load.

Installed mitigation: one map worker, pixel ratio capped at 1, low-power WebGL
preference, 64 cached tiles per source, two cached zoom levels, no label fade,
instant camera movement when choosing GPS/places/presets, and resize calls only
when container dimensions change (coalesced to one animation frame). Shared
basemap limits also apply to weather radar. This reduces resource pressure;
it does not establish or repair a physical display-power/HDMI fault.

No HDMI mode, boot firmware, USB current override or desktop session was changed.
A separate USB supply for the monitor with HDMI retained is the next diagnostic
comparison. Do not force the higher USB current budget on an unverified supply.
Physical screen stability must be confirmed by the owner after that comparison.

References:
- https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-009856-WP-1-USB%20Power%20delivery%20on%20Raspberry%20Pi%205.pdf
- https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/

Validation: production TypeScript/Vite build passed; five browser tests passed
covering offline collection search, GPS status, map panels/fullscreen, high-DPI
canvas sizing and page teardown, and radar frame/error handling. These automated
checks do not verify physical HDMI/monitor stability.
