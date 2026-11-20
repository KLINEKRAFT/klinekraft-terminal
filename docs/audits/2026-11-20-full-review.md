# Klinekraft Terminal: full review, November 20, 2026

Scope: every screen at 1024×600, in light and dark mode, against the real FastAPI service. Line-by-line code review of the frontend (~60 components) and the backend routes. All four test suites were run. Fixes are on branch `claude/wonderful-curie-stkzpv`.

## The verdict

There is a great product in here. The engineering underneath is careful in the places that matter:

- The local-only API guard holds up.
- No subprocess call uses `shell=True`.
- File paths are checked against traversal.
- MapLibre cleans itself up.
- Markdown is sanitised.
- Revision conflicts are detected.

The surface does not show that care yet. Every screen looks like it was designed on a different day, by a different person, for a different product. That is literally true: `styles.css` is 3,866 lines, and new rules were appended to the end and override earlier ones. The numbers:

| What | Count in `styles.css` |
| --- | --- |
| Font sizes | 33 (from 6px to 96px) |
| Hard-coded colours | 72 |
| Corner radii | 11 |
| `!important` | 65 |
| Minified one-line blocks over 300 characters | 22 |

The design system document describes Rams and Braun. The CSS describes an archaeology dig.

The product asks the user to understand it, when it should understand the user. These questions show the problem:

- **Two command systems.** Ctrl+K opens a search palette, and a separate command bar sits at the bottom of Home. They don't know about each other. Until today the command bar could not open Notes, Paint, Calendar or Calculator, and its help text listed commands that were wrong.
- **Field, Dim, the "i" button and Live Computer in the header on every screen.** These are four controls about power and telemetry, fighting the page title for attention. Most people need them once a day.
- **Emergency is item 12 of 12 in the drawer**, below Calculator and Settings. This is the screen that justifies a cyberdeck existing. Until today, searching "water" or "bleeding" found nothing, because the bundled first-aid guides were not searchable.
- **Maps with no region installed is a blank beige rectangle.** It shows a dismissible "No offline map region is installed." There is no basemap, no "here's how to fix it", and the info panel said "NaN GB saved".

## What I fixed

All fixes were verified in the browser, at 1024×600, against the real service.

### Safety and data loss

| Issue | Fix |
| --- | --- |
| A Notes or Calendar save conflict (409, for example two tabs or a phone) locked Notes. Every switch, New and Trash failed. The conflicting draft also survived reloads, so the only escape was clearing browser storage by hand. | Added **Keep mine as a copy** and **Load Pi version**. Nothing is discarded silently. |
| Every validation error (422) showed as "The local service is unavailable. Update or restart Klinekraft." This included a note over the size limit and a long attachment name. | `localJSON` now shows the real reason ("Not saved: …"). Errors also carry an HTTP `status` so callers can branch on it. |
| Emptying a latitude or longitude field in Briefing settings silently saved **0, 0**, which is in the Gulf of Guinea. | Empty fields are blocked with a message. |
| Every calculated route was saved forever, at up to 4 MB each. That grows the SQLite database and every backup until the SD card fills. | Only the newest 50 are kept (`routing.py`). |
| Hotspot Stop could interleave with a 40-second Start. | Stop now takes the same lock. |

### Functional bugs

| Issue | Fix |
| --- | --- |
| Universal Search could not find the bundled emergency guides. | Guides are indexed locally and instantly. "boil" finds Drinking water, and Enter opens that guide on the Emergency page. |
| Pressing Enter in search did nothing while the Kiwix search was slow (up to 15 seconds), even with results on screen. | Enter picks the top result whenever there is one. |
| The command bar could not open Notes, Paint, Calendar, Calculator or "maps", and its help text was wrong. `ask …` said "AI providers are not configured", even though Shackleton works. | Every section is routable by name, plus about 30 aliases (`calc`, `sos`, `radar`, `wifi`…). Help text is defined once. The drawer closes on navigate. |
| The command-result toast had paper-coloured text on a paper background, so it was invisible, and it sat bottom-left. | It now has one definition, bottom-right, readable in both themes. "Opened …" confirmations fade after 2.5 s. |
| Calculator rounded to 12 significant digits: 999999999999 + 2 showed **1000000000000**. | Uses 15 digits, so 0.1 + 0.2 still shows 0.3. |
| Calculator: `2+3 =` then `×4 =` gave **14**, because it kept extending the old expression. | An operator after `=` continues from the answer (20). A digit starts a new calculation. |
| Radar: the "Install the offline basemap" error was wiped by the next radar fetch, leaving "Loading radar…" forever. | It is now a separate, permanent error. (`weather-radar.spec.ts` "never presented as clear weather" now passes.) |
| Network: one failing hotspot request froze the radio status, and an error never cleared after recovery. | The two update independently (`allSettled`). |
| Maps info showed "NaN GB saved" when no region was installed. | Fixed, and the status now names the setup script. |
| The hosted Vercel demo sent 9 `/api` requests that could only 404, which broke its own test contract. | `localJSON` refuses straight away in demo mode. |

### Performance

The clock state lived at the root of `App` and ticked every second. That re-rendered the **entire application** once a second, including all five Library panels, which stay mounted while hidden. The clock is now its own tiny component. Telemetry staleness uses a separate 2-second check that only re-renders when the state actually flips.

### Visual cohesion

- **One tab style.** Library had grey native-looking boxes with no padding. Field Briefing had huge, full-width blue blocks. Both now use quiet text tabs with a filled logo-blue pill for the active view, matching the Maps toolbar. Everything is built from tokens, so dark mode follows.
- **Screen Cast.** The raw checkbox glued to an unstyled native button is now an aligned option-and-action row, with a primary button.
- **Calendar.** "No events for 2026-11-20." now reads "No events on Friday, November 20."
- **Home.** Removed the orphaned `↗` that floated after "Away".

### Tests

- Fixed two stale tests that targeted UI that no longer exists (the "Applications" nav, the always-visible sidebar, "AI assistant").
- Results:

| Suite | Before | After |
| --- | --- | --- |
| Browser (Playwright) | 56 / 64 | **59 / 64** |
| Backend (pytest) | 134 / 134 | 134 / 134 |
| Demo | 0 / 1 | **1 / 1** |
| Unit | 3 / 3 | 3 / 3 |

The 5 remaining failures (`gps`, `map-collections` ×3, `weather-radar` frame time) all wait for an installed offline map region. They can only pass on the Pi. **These tests should mock `/api/maps` and the PMTiles source so CI can run them.**

## Found, deliberately not changed (your call)

1. **Briefing hides every saved Severe or Extreme alert when one 30-second poll fails.** A test asserts this on purpose ("a lost service hides the live ticker"), presumably so expired alerts are never shown as live. The cost is that a backend hiccup can make a saved tornado warning vanish for 30 seconds. Suggestion: keep showing it with a "last checked 2 min ago" stamp, and hide it only after the alert's own expiry time.
2. **Games empties the whole list on one failed 5-second poll**, also by design per test. Suggestion: keep the list, disable Play and show the error.
3. **Organizer history has no limit.** Every autosave (1.6 s after typing stops) keeps a full previous copy, up to 100 KB, forever. The History endpoint returns all of them. Collapse saves made close together (for example one per 5 minutes), and keep the last N.
4. **`GET /api/organizer?kind=drawing` returns every drawing's full PNG**, up to about 4 MB each, just to list titles. Return only id and title, and fetch a body on open.
5. **Paint can lose up to 1 second of strokes when you switch section** if the recovery draft is too large for localStorage. Save on unmount when dirty. It also re-encodes a full PNG on every title keystroke.
6. **Shackleton:** leaving the page mid-answer aborts the request, but the server keeps its "busy" lock for up to 240 s. The next question then gets "An answer is already being prepared". Let the answer finish in the background and save it.
7. **Power toggles race the 10 s poll**, so Field or Dim can briefly flip back. The shutdown countdown also only updates every 10 s on a 60 s timer.
8. **GPS freshness compares the receiver's clock with the Pi's.** With no RTC battery and no NTP when you boot offline, every fix may be rejected. Run chrony with gpsd, or time fixes on arrival.
9. A 30-second-old fix is drawn as "Live GPS position" and used for Follow. At 60 mph that is half a mile out of date.
10. `crypto.randomUUID()` throws if the UI is ever opened over plain HTTP from a LAN IP rather than localhost.
11. The Wi-Fi hotspot password is sent on every 10 s poll. Serve it only when "Show" is pressed.

## The Steve Jobs list: what I'd do next, in order

1. **Make Emergency one tap from anywhere.** Move it to slot 01, or give it a permanent red header button. Add one big "I need help" entry that leads with first aid, water and power. It's the reason a deck exists.
2. **Kill the command bar. Keep Ctrl+K.** One way to go places. Search already finds apps, notes, places, guides and Wikipedia. Fold in "commands" as results, and bind a hardware key on the deck to open it.
3. **Empty the header.** Search, Briefing bell and theme belong there. Field, Dim and the power "i" go into one battery glyph that opens a popover. Live/Simulated becomes a dot, not tiny 9px mono text.
4. **Delete the CSS and rebuild it from a real scale.**
   - Type: 12 / 14 / 16 / 20 / 28 / 48.
   - Spacing: 4 / 8 / 12 / 16 / 24 / 32.
   - Radius: 4 / 8 / pill.
   - Colour: the 7 tokens you already documented.
   - One button component, one field, one select, one switch, one tab.

   Today Library, Games, Notes, Emergency, Paint and Network each invent their own buttons. Some are native grey boxes and some are 26px-tall chips below touch size.
5. **Home must answer "is my deck OK?" in one glance.**
   - Today CPU, memory and storage each show both a sparkline and a meter, which is the same information twice.
   - Network shows twice, as rates in the readings row and again as a link.
   - The device row has a double rule.
   - Labels are 9–10px.

   Instead: battery, time, temperature and connectivity as four large numbers, then your pinned things.
6. **Maps must never be blank.** Ship a tiny bundled vector outline (the US GeoJSON is already in `assets/maps`). Show a non-dismissible "Install street maps" card with the exact command. Let online imagery work even before a region is installed.
7. **Library empty states should sell the feature.** "No files in this view." next to two collapsed accordions is a dead end. Show what goes here and the one action that fills it.
8. **Paint:**
   - The toolbox scrolls at 600px tall.
   - Two text tools have identical "T" icons.
   - The File button overlaps the toolbar's top rule.
   - The pencil hint promises right-click colour, which is not implemented.
9. **Notes:** "+" and "New" do the same thing, and Save/New float in the middle of the editor. Pick one New and pin the save state to the corner.
10. **Calculator:** the right half of the screen is an empty History column. Either fill it with a unit converter (°F/°C, mi/km, gal/L) or centre the machine.

## Code-health notes

- `App.tsx` has dead code: the `Feature` component and the `integrations` table can never render. If they did, they would say "No GPS receiver connected" on Games.
- The header number comes from `sections` but the drawer number from `navigationSections`, so Emergency is "/15" in one place and "12" in the other. It is hidden at the moment, but it is wrong.
- Several `aria-label`s sit on plain `div`s, so screen readers ignore them. The Away ticker text is `aria-hidden`.
- The exit dialog is a hand-made `role="dialog"` with no focus restore. Every other dialog uses `<dialog>`.
- The AwayCanvas shader keeps redrawing the same frame at 24 fps while paused, and "Pause" recompiles the shaders. That is GPU work on a battery device for nothing.
- Vite's dev server allows cross-origin requests from other localhost ports, such as Kiwix on 8081. Set `server.cors: false`. This affects dev only.
