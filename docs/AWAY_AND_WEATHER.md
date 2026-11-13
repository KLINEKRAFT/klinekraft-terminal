# Away and outdoor temperature

Home has a small Tulsa outdoor-temperature row and an Away button. CPU temperature remains separately labeled.

Away opens settings and a live preview. Choose Gradient drift, Contour lines or Liquid chrome, adjust three background colors and the message color, and enter a message (160 characters maximum). Typeface options are the terminal's existing Inter and IBM Plex Mono. Ticker message is optional. Pause motion stops the background and ticker; system reduced-motion preferences are honored.

Start Away fills the browser window. The fullscreen button requests browser fullscreen. Move the pointer or use the keyboard to reveal controls. Settings returns to editing; Close Away or Escape returns to Home (the browser may consume the first Escape to exit fullscreen). Settings persist in this browser; clearing site data resets them. This is a visual Away mode, not a security lock or a system screensaver daemon. It does not inhibit the Pi's existing five-minute screen blanking or launch automatically when idle.

The three procedural shaders are adapted from [away-message-dual](https://github.com/KLINEKRAFT/away-message-dual), revision `7558df5ceb29097cf83cdb7372fb3f6fefbe29dc`. No particle layer, pointer ripples, remote fonts, extra effects, or Three.js dependency is included. Rendering is limited to 24 fps and at most 960×540 pixels, with rendering skipped in hidden tabs. Unsupported WebGL falls back to static colors with a visible notice. Actual Pi GPU performance still needs device testing.

Tulsa coordinates and the Open-Meteo approach come from [WEATHER](https://github.com/KLINEKRAFT/WEATHER), revision `63ed98c43e1dcca34efb8368e8007f49166632f4`. Home requests only current outdoor temperature in Fahrenheit, directly from Open-Meteo, every 15 minutes while visible. No location permission or API key is needed. The timestamp uses Tulsa's Central time. Last known data is labeled after a fetch failure or when over 45 minutes old; readings over 24 hours old are hidden. Internet is required for new weather readings. A successful cached reading remains available offline. Attribution links to Open-Meteo.

Validation: production TypeScript/build, browser tests for settings persistence, allowed backgrounds, ticker, offline weather and corrupt storage; Chromium visual checks for shaders, fullscreen and small layouts. Weather browser tests use a controlled response. Live Open-Meteo access is unavailable from the restricted build environment and must be verified on the Pi.
