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
