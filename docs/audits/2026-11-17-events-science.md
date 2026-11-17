# Events, scientific research, and Shackleton rendering

## User-facing behavior

The bell opens Events & Science on any page. A bottom ticker rotates unacknowledged, non-stale reports; Pause freezes it. Severe/extreme weather reports take priority over informational reports. The live ticker hides if the local service becomes unavailable. Acknowledgements and settings persist on the Pi. Defaults: Tulsa (36.154, -95.993), nearby earthquakes M2.5+ within 300 miles, worldwide M6+. Location label and coordinates are independently editable. These are reported events, not earthquake early warnings. The ticker operates while Terminal is open; there are no OS push notifications or audible alarms.

Sources: NWS active actual alerts at configured coordinates; USGS past-day M2.5+ feed; recent NOAA SWPC bulletins; Open-Meteo seven-day forecast; NASA EONET, APOD, and asteroid approaches. NWS expires at its supplied expiry. Quake reports leave the list after 24 hours. SWPC reports are displayed for 24 hours from issue and retain their original message for validity context; this is not a complete active watch/warning inventory. A missing feed never implies an all-clear. Every feed has a saved timestamp and stale state, with stale reports excluded from the ticker. Geographic weather caches are isolated by coordinates.

The service polls in a background task, with bounded requests and three workers. Feeds have per-source TTLs. NASA APOD/asteroids use the shared DEMO_KEY unless NASA_API_KEY is set in the service environment; failed long-TTL requests back off for up to an hour. OpenAlex optionally accepts OPENALEX_API_KEY. No paid plan or account was created. On live verification all sources responded except APOD, which reported a provider HTTP error / timeout. Its panel explicitly shows unavailable data.

Library → Research searches OpenAlex and Europe PMC. Searches are cached for 24 hours. Save reference stores metadata and abstract with provenance in Science research. Available open-access Europe PMC full text is downloaded only on an explicit click, via a fixed API path and validated PMC ID, parsed without XML entities, and saved as readable text retaining license content. Download is bounded to 8 MB; saved full text to 250,000 characters with an explicit truncation marker; the search index covers the first 32,000. Arbitrary publisher URLs are not fetched. Source links open separately.

Shackleton defaults to including locally cached event reports for matching questions. Offline mode never performs online research searches. Cloud settings expose an explicit online-paper-search checkbox; its label discloses the external providers. Results become numbered external citations and remain clickable after conversation storage. Scientific abstracts are not validated safety instructions. Markdown supports headings, lists, emphasis, tables and code. Raw HTML is skipped, unsafe link protocols are blocked, and Markdown images cannot automatically load remote resources.

Maps has an Earthquakes switch using the cached USGS feed. Blue circles show magnitude, click opens title, and the age/stale status is visible. It does not download new basemap coverage.

## Validation

Production build passed. Final full backend suite: 120 passed. Nine focused browser checks passed, followed by five alert/research/Markdown/layout rechecks and four final briefing checks including service failure and severe-report priority. Live checks confirmed both research providers, an actual Europe PMC full-text XML response, readable cached weather through offline Shackleton, and an enabled earthquake overlay without browser errors. Inspected Home, Events dialog, Maps and Shackleton at 1024×600. Existing npm audit findings concern pre-existing Vite/sharp dependencies, not the new Markdown libraries; existing large offline-map/PDF bundle warnings remain.

## Primary references

- https://www.weather.gov/documentation/services-web-api
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- https://www.spaceweather.gov/content/data-access
- https://open-meteo.com/en/docs
- https://eonet.gsfc.nasa.gov/docs/v3
- https://api.nasa.gov/
- https://help.openalex.org/api/
- https://europepmc.org/RestfulWebService
- https://github.com/remarkjs/react-markdown

## Hologram artwork

Built-in image generation, transparent output, saved to `frontend/public/brand/shackleton-hologram-head.png`. Original blue portrait remains. Final prompt:

> Revise this Shackleton hologram logo: HEAD ONLY, from top of swept hair to bottom of chin, include ears. Completely remove all neck, collar, coat, shoulders and torso. Preserve recognizable Ernest Shackleton face. Render the head as thousands of very fine luminous dithered blue dots / point-cloud stippling, with density and transparency creating three-dimensional facial depth. Electric cobalt blue #123aff with restrained cyan highlights. Fine digital halftone, airy holographic projection; no polygon edge lines, no wireframe grid, no solid filled facets, no horizontal stripes, no heavy outer glow. Crisp readable portrait silhouette, centered floating head on genuinely transparent background with comfortable margins. No text, symbols, pedestal or background panel.
