# USB GPS

Installed for the u-blox 8 receiver on November 18, 2026.

To reinstall with the receiver connected:

```sh
sudo bash scripts/setup-gps.sh /dev/serial/by-id/usb-u-blox_AG_-_www.u-blox.com_u-blox_GNSS_receiver-if00
```

Uses `gpsd` and `gpsd-tools` only (the large graphical client package is unnecessary).
The stable device path survives USB numbering changes. The system service starts
at boot and the packaged USB hotplug rules support reconnects. `-n -b` starts
reading immediately and avoids writing configuration commands to the receiver.
The default gpsd socket listens only on localhost and its local Unix socket.

Open **Maps → GPS** to center on a fresh fix. A connected receiver without a fix
shows a waiting message; it never substitutes the saved home address or stale GPS
coordinates. Put the antenna outside or near a window with a clear sky view and
allow time for satellite acquisition. GPS reception and the installed offline
map do not require Wi-Fi; satellite imagery and online address search still do.

For terminal diagnostics:

```sh
cgps -s
```

The API accepts only timestamped fixes between 5 seconds in the future and 30
seconds old. Keep the system clock accurate. Outdoor reception was verified on November 19 with a live 3D fix.

## Home and Maps

Home shows the live coordinates, used/visible satellite counts and fix age.
Click the position to open Maps. The small compass shows **direction of travel
relative to true north**, not the direction the case faces. It is hidden below
1 m/s (about 2.2 mph), when reported speed uncertainty exceeds motion, when
direction uncertainty exceeds 45°, or when the fix is stale. Stationary facing
direction requires a separate calibrated heading sensor.

Maps has a separate live blue position dot, GPS centering, and an optional
Follow toggle. Dragging the map or selecting a place stops Follow. Losing the
fix removes the dot and turns Follow off. Save this spot captures a fresh fix
when Save is pressed, into the existing saved-places database. Route → Use GPS
as start captures the current position as a route endpoint. No continuous
location history is recorded; existing map viewport persistence still applies.

Keep the receiver outside the enclosure with a clear sky view on a reliable
USB extension. It can be unplugged and reconnected; allow time to reacquire a
fix. gpsd starts automatically, so no diagnostic terminal needs to remain open.
The monitor should retain its separately tested power supply.

Validation: production build, eight backend map tests and four browser tests,
including GPS loss, course visibility, saved coordinates, route start and
1024×600 layout. Live receiver returned a 3D fix with 8 of 14 satellites used
during integration verification.
