# Field Briefing and map collections

Use navigation → **Field Briefing** for the seven-day forecast, weather and earthquake reports, space weather, NASA Earth events, asteroid approaches and astronomy. The bell remains a quick-access panel. New readings need internet; timestamped cached readings remain visible offline. These feeds are not a guaranteed emergency notification service.

Maps now has a **Street / Satellite** toggle, **Saved places**, a US address search, and locally searchable collections. Selecting a collection shows its points on the map. Selecting a result drops a pin and fills the place-name field for saving or offline route planning.

## Coverage

- 61 national-park catalog entries excluding Hawaii, based on the NPS API snapshot. Sequoia and Kings Canyon share an NPS entry. Alaska and US territories are included. Offline street coverage remains lower 48 + Alaska; some territory pins are outside that archive.
- Four Oklahoma NPS destinations: Chickasaw, Washita Battlefield, Oklahoma City National Memorial, and Fort Smith. These are not all designated National Parks; Fort Smith spans Arkansas/Oklahoma.
- 256 entrances listed as open to the public in ODWC's WILMA dataset. These are wildlife-area access points, not all Oklahoma public land or property boundaries. Current rules and closures must be checked with ODWC.
- Four selected preserved missile facilities: Delta-01, Delta-09, Oscar-Zero and Missile Site Park. This is a historical visitor collection, not a complete inventory of decommissioned silos. Control facilities are labeled separately from silos.

Park reference points and boundary centers are not necessarily road entrances. Choose an appropriate entrance before planning a route.

## Sources and refresh

- [NPS parks and places API](https://www.nps.gov/subjects/developer/api-documentation.htm). `scripts/update-map-catalog.py` refreshes the checked-in public JSON explicitly; `NPS_API_KEY` is optional. The shared demo allowance may return HTTP 429. A failed refresh does not replace the installed catalog.
- [USGS/NPS park boundaries](https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/29): Redwood and American Samoa initial pins use boundary-extent centers, noted on each pin. A successful NPS API refresh replaces those with NPS reference points.
- [ODWC WILMA entrances](https://www.wildlifedepartment.com/server/rest/services/PublicWILMA/WILMAFeatures/MapServer/1): query `OPENTOPUBL='Yes'`, verify response count against the server, and preserve official entrance IDs.
- [USGS Imagery Only](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer): online raster imagery, with USGS/USDA attribution. Historical dates/resolution vary. It is not live imagery and is not predownloaded. No bulk imagery downloader is installed.
- [Census Geocoder](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html): approximate US street-address locations. Search submits explicitly, not on each keystroke. Successful matches are cached in the local SQLite database and can be repeated offline. Unmatched or unavailable queries are not cached.

Personal saved places and address queries stay in the private Pi database, included by the existing database backup. They are not in the public catalog or repository. The public field-library hotspot does not expose these map APIs.

## Small-screen redesign (November 17, 2026)

The UI review found that the map's permanent control column reduced its viewing area, unrelated controls competed for attention, route endpoints depended on the most recently selected pin, and the briefing mixed forecasts and event reports into one long document.

Implemented changes:

- Maps uses a full-width canvas with Find, Places, Route and Layers panels. The close button or Escape dismisses the panel; choosing a result closes it automatically. The last map view is remembered privately in browser storage. First use starts around Tulsa.
- Search matches saved places and all installed collections locally while typing. Street-address lookup remains an explicit action. Collections use readable result rows instead of long native dropdowns.
- A selected-pin bar provides Save, Start and Destination. Route endpoints have independent labels and can be swapped. Tapping a different map point clears the previous place name.
- Briefing opens to Weather, with separate Radar, Events and Science views. Location and source controls live in Settings. Tulsa is the default; Use Tulsa restores it without changing alert preferences until Save settings is pressed.
- Weather adapts the large current-temperature display and hourly score from [KLINEKRAFT/WEATHER](https://github.com/KLINEKRAFT/WEATHER/tree/63ed98c43e1dcca34efb8368e8007f49166632f4), keeping Terminal typography, colors and imperial units. Hourly bar heights show relative forecast temperature; exact values remain visible. Current readings are labeled model estimates. Missing measurements stay unavailable rather than becoming zero.
- Events can be filtered by weather, earthquakes or space weather and by unread status. Acknowledgement updates the bell/ticker immediately. Severe weather reports get a shortcut above the forecast. Source failures never become an “all clear.”
- Radar uses the existing offline MapLibre/PMTiles basemap instead of adding a second map library. Only the open radar view requests imagery. The slider and displayed timestamp are separate: a failed frame preserves the previous image and its actual frame-generation time.

### Radar limits

[RainViewer's public API](https://www.rainviewer.com/api/transition-faq.html) provides past radar, generally two hours at ten-minute intervals, with Universal Blue tiles and native zoom through level 7. Higher map zoom enlarges available imagery. This implementation requests 512-pixel tiles for the selected frame only; playback advances at a deliberately conservative ten-second cadence, pauses on map movement or a hidden page, and is off by default. No future radar, satellite IR, bulk prefetch or offline radar coverage is claimed. Blank radar areas can reflect missing coverage. Provider attribution remains visible.

Forecasts, event snapshots, collections and street maps remain readable offline. New forecasts, alerts, address lookups, satellite imagery and radar require internet. Feed timestamps and errors remain visible.

### GPS testing

The GPS button reads a local gpsd receiver on loopback port 2947, accepts only a 2D/3D fix timestamped within 30 seconds, and never substitutes an IP/browser location. It does not install/configure gpsd, poll a receiver continuously, or change the weather location. At implementation time gpsd was inactive and no serial receiver was detected; actual hardware testing is still pending. The app reports “No fresh GPS fix” honestly until the receiver/service supplies one.
