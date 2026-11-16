# Klinekraft Terminal — UI/UX audit and cyberdeck research

Reviewed November 16, 2026. Target: Pi 5, 1024×600 display, plus a 1024×560 viewport allowing room for the desktop panel. Recommendations below are proposed work, not claims that every change has been implemented.

## Delivered in this pass

Moved the independent Dim control into the upper-right header. It is a compact labeled switch using Terminal colors, logo-blue active state, keyboard focus indication, reduced-motion support, and an accessible checked state. Its existing Pi-persisted preference remains independent of Field Mode. The production build and both small-screen power-control tests passed. Light and dark appearance were visually checked.

## Scope and evidence

Inspected all 14 primary screens in the live local application, plus System sensor details in the preceding temperature check, settled Library/Notes states, and expanded Paint. Captured screenshots at 1024×600 and measured scrolling/overflow at 1024×560. No page-wide horizontal overflow was observed. This is a screen and workflow inspection, not a claim that every dialog, keyboard path, document format, game, or hardware integration was exhaustively tested. Existing user content was not deliberately edited; Notes recovered and autosaved an existing browser draft during navigation.

Local screenshots and measurements: `/home/klinekraft/.local/state/klinekraft/ui-audit-20261116/`. These contain local workspace views and should not be published as a public screenshot set.

## Highest priorities

1. **Make Notes switching natural.** The current implementation disables other notes and New while any editor draft is open, even after it says Saved. Users must discover Close editor before switching. Save pending edits before switching, allow switching immediately when clean, and remain on the current note with a clear retry if saving fails. Keep revision conflict protection.
2. **Give Paint its canvas back.** Multiple toolbar rows, the global header, command footer, palette, and help text leave a very small drawing area. At the reduced viewport, even the toolbox scrolls. Collapse secondary operations into a menu; show options only for the selected tool; place colors in a compact strip. Preserve the requested app sidebar in an expanded-workspace mode; make true fullscreen a distinct optional mode.
3. **Make Library a focused reader.** Research files, project notebook, Wikipedia, and bookmarks are stacked. Introduce tabs or a source selector with one sticky search row. Display friendly titles rather than `.txt` and `(part 01)` artifacts. Group document parts and retain source/collection metadata in details.
4. **Use one control style.** Library, Screen Cast, Field Mode, and some settings expose gray native-looking controls among otherwise styled controls. Define shared buttons, fields, selects, switches, focus rings, and disabled states. Keep the Klinekraft palette and restrained visual language.
5. **Make status trustworthy and understandable.** Distinguish Installed, Available, Starting, Running, and Tested. Emergency currently labels configured local AI as Ready; the backend checks configuration, not a fresh successful generation. Show last successful backup separately from local autosave. Do not imply 868 imported records means 868 independent complete manuals.

## Screen-by-screen findings and solutions

| Screen | Observed issue | Proposed solution and acceptance check |
|---|---|---|
| Home | Battery appears in both the power strip and device readings. Several technical labels are very small. GPS occupies space while unconfigured. Quick notes explicitly save only in this browser. | Keep a single compact global status area; emphasize next actions and recent work. Hide or collapse unconfigured devices. Move quick notes to Pi-backed Notes or clearly label their separate storage. Main values and primary labels readable at 100% zoom; no guessing where a note is saved. |
| Games | 2,600 entries make an alphabetical list slow to browse. Region/revision strings and repeated titles add noise; search and filters scroll away. | Sticky search/system/favorites row, recent games, friendlier titles with region details on demand, optional grouping by title/system, and a controller setup shortcut. Verify favorites and recent selection persist; preserve exact ROM identity for launch. |
| Shackleton | Large multi-line composer and sharing text compete with a short conversation viewport. Reference mode, model mode, and network state are spread across controls. Existing answers can be dense paragraphs. | One clear mode selector: Offline references / Offline AI / Cloud. Compact composer that expands while typing; put detailed data-sharing explanation in an accessible disclosure without hiding cloud destination. Show named source chips, reading/open actions, and visible generating/cancel state. Preserve scroll position when reading older replies. |
| GPS / Maps | Right sidebar consumes map area and scrolls independently. Coordinates are the main manual search option; availability caveats and archive size take persistent space below the map. | Collapsible Places / Route drawer, saved-place quick access, smaller GPS badge and an information popover for coverage/date. Distinguish offline route planning from unavailable live navigation. Keep attribution visible and miles/feet. Make start/end selection obvious without requiring coordinate typing. |
| Library | Separate tools stack into a long page; loaded document results add another scrollbar. File-part names and native controls look unfinished. | Tabs for Documents, Wikipedia, Notebook, Bookmarks; unified entry search with clear scope; compact results and a reader pane. Group fragments by source document. Show local availability, source, date, and a clear Back to results action. Test a result-to-reader-to-original-search round trip. |
| Notes | Saved draft keeps navigation and New disabled until Close editor. Draft recovery initially shows Unsaved changes before autosaving. Two sidebar layers reduce writing width. | Save-before-switch behavior with failure/conflict handling, shorter previews, optional collapsible note list, a stable Saved/Saving/Not saved badge, and recoverable trash. Confirm switching between two saved notes requires one click and never loses an edit. |
| Paint | Canvas is small in normal layout, several tools need scrolling, labels wrap inside narrow buttons, and expanded fullscreen removes the app navigation. | Compact file menu, contextual tool options, one-column icons with tooltips/shortcuts, smaller palette, and a larger canvas workspace. Separate Expand workspace from Fullscreen. Target at least half the available workspace for drawing at 1024×600; validate at 560 height too. |
| Calendar | Month grid is useful but event list/editor split creates a small scrolling list and a large empty editor. Selected date text is ISO-formatted. | Month/Agenda toggle, friendly U.S. date heading, agenda-first empty state, event indicators on dates, and open editor only after selection. Keep local-only behavior explicit; do not imply phone/calendar sync. |
| Calculator | Works visually, but it needs vertical scrolling at 560 height. The percent rule is easy to overlook, and there is no conversion workspace. | Reduce spacing enough to keep all keys visible, add copy-result/history reuse, and offer a separate U.S./metric converter for distance, temperature, volume, and weight. Preserve the documented percent behavior rather than silently changing arithmetic. |
| Files | Tall rows show few files. File entries emphasize download rather than viewing, and Documents/Downloads exclude a direct Received shortcut. | Compact list with name/type/size, clear Open versus Download actions, breadcrumbs, search, sorting, and a Received shortcut. Add “Open in file manager” for permitted folders. Keep path restrictions and avoid exposing private files to the phone library. |
| Network | Screen Cast is above connectivity. Wi-Fi is represented only as wlan0 up/down. Hotspot is hidden in a disclosure, and there is outdated milestone wording. | Connected network/status first, then cards for Phone hotspot, Receive screen, File sharing, and Radio. Show actual connection state and plain-language effects. Offer a timed test/return option based on the rollback used successfully today. Keep passwords hidden until requested. Remove obsolete milestone copy. |
| System | Four graphs dominate the viewport; processes and hardware readings sit below. Process list adds a second scroll area. Some labels are very small. | Compact overview with Fahrenheit temperature, battery, free storage, service health, and last backup; expandable graphs and process details. Use one main scroll region. Retain logo-blue graphs, with a tested contrast treatment for dark mode. |
| Settings | Appearance, browser-local preferences, and temporary settings have inconsistent persistence. Browser launch URL gets a large section. | Groups for Display, Units, Startup, Storage/backup, and Advanced. Mark “Saved on Pi,” “This browser,” and “This session” consistently. Keep U.S. units as the default. Move demo/simulated data into Advanced. Include the display controls here as well as their header shortcuts. |
| Emergency | Fast topic buttons are useful. Readiness counts dominate the top; result list is deeply nested. AI Ready is configuration-based. | Put curated quick-reference documents first, with source/date/local availability. Move resource counts into details; distinguish configuration from checked service health. Show battery, offline map access, and phone-sharing state compactly. Keep AI optional and never present this as a live emergency alert feed. |

## Cross-screen design rules

- Preserve the current logo, dark neutral surfaces, and Klinekraft blue. Reduce decorative labels before shrinking useful text. Orange can remain a deliberate action/selection accent rather than a second general-purpose status system.
- Aim for primary controls at least 32px tall for the current pointer/keyboard layout; offer larger touch controls where needed. Treat 12–14px as a useful working range for ordinary labels instead of tiny widely spaced status text.
- Make one primary scroll area per page; keep search or the current action nearby. At 560px height, System and Emergency have nested scroll regions, Paint’s toolbox scrolls, and Calculator needs page scrolling.
- Consolidate the top power strip into a compact status tray later. The new Dim switch stays in the header and does not change services.
- Move the command footer to a compact expandable launcher or Ctrl+K palette, reclaiming vertical space on tool-heavy screens. Ensure the tiny keyboard does not require function keys for critical actions.
- Distinguish data safety from UI convenience: autosave, local persistence, cloud backup, and recoverability are different states.
- Global Dim is a visual overlay; it does not reduce the physical screen backlight or establish battery savings.

## Research: what other builders are doing

The following are examples and proposals, not installed additions or verified performance claims for this deck.

### Local launcher / appliance experience

A maker’s Pi 5 build uses a local HUD launcher for maps, SDR++, Kiwix, media, Meshtastic, and emulation, with a fullscreen browser on startup. That resembles this deck’s architecture. Their animated globe and large offline model are inspiration, not suitable defaults for this small display and battery budget. Prioritize instant app access and restrained status visuals. [Builder’s account](https://www.reddit.com/r/cyberDeck/comments/1sf7zei/build_update_4_waiting_for_parts_so_i_upgraded/).

Raspberry Pi’s own kiosk guide documents booting Chromium through labwc autostart. This deck already has app-style startup; the next step is consistency between the app and desktop, plus a dependable exit and recovery path. [Official kiosk guide](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/).

### Matching desktop, shortcuts, and physical controls

Labwc supports configurable key bindings, menus, and startup behavior. Use the existing desktop rather than replace it: matching wallpaper/window colors, a short launcher row, and Super-key shortcuts for Terminal, Notes, Maps, Files, screenshot, and return-to-deck. Offer a printable shortcut card. Preserve default escape routes and existing OS bindings. [Labwc configuration guide](https://labwc.github.io/getting-started.html).

A USB macro pad or encoder could later provide tactile app shortcuts and volume controls. Dimming would still be visual unless the screen hardware exposes brightness control. Prefer a USB input device first; any GPIO control needs a pin-conflict review against the UPS.

### Field hardware and useful status

The ifnull cyberdeck repository documents an offline-content kit with a separate router, SDR, explicit power switches, and small e-ink/LCD status displays. Some phases are listed as build tasks, so treat it as a documented design rather than proof every subsystem is complete. Useful ideas here: a tiny always-readable power/status display and clearer labels for charging, output power, and shutdown. Its solar/battery wiring is for different hardware and should not be copied onto this UPS. [Build repository](https://github.com/ifnull/cyberdeck).

An SDR receiver is a plausible later radio-listening addition; SDR++ supports Linux and several receiver backends. It requires appropriate receiver hardware/antenna, build compatibility checks, and a power/CPU test on this ARM64 Trixie installation. It is not a replacement for a dedicated alerting weather radio. [SDR++ project](https://www.sdrpp.org/).

Meshtastic hardware can supply off-grid messaging and, on GPS-equipped nodes, position. The deck currently reports no radio attached. Select hardware only after deciding range, power, and portability needs; do not imply that the existing Wi-Fi hotspot itself provides long-range messaging. [Supported hardware](https://meshtastic.org/docs/hardware/devices/).

### Visual direction and things to skip

Raspberry Pi’s cyberdeck build guide emphasizes designing around the intended use and enclosure. For this deck, continue the Klinekraft identity across launcher, desktop, boot screen, and accessories, using a static technical/grid wallpaper and legible monochrome icons. Existing boot-branding scripts should be inspected and reused instead of stacking another splash system. [Official cyberdeck guide](https://www.raspberrypi.com/news/create-your-own-cyberdeck/).

Use eDEX-UI as visual reference only: its original maintainer archived the project. A whole extra animated desktop shell would add maintenance and resource use without improving the existing Terminal workflow. [Maintainer’s status](https://github.com/GitSquared/edex-ui/issues/769).

Do not enable a blanket read-only overlay as a cosmetic “appliance mode”: Raspberry Pi’s documentation states those temporary filesystem changes disappear at reboot. This project relies on persistent notes, drawings, game saves, credentials, and backups; storage separation would have to be designed and tested first. [Raspberry Pi configuration](https://www.raspberrypi.com/documentation/computers/configuration.html).

## Suggested delivery order

1. Fix Notes switching and unify controls on Library, Network, and the power strip.
2. Reclaim space in Paint and Library; simplify Shackleton’s composer and status.
3. Clarify Emergency readiness and show real backup freshness in System.
4. Harmonize the desktop theme and add easy keyboard shortcuts using the current labwc environment.
5. Consider GPS/radio/macro-pad hardware after the core interface is comfortable.

TV casting and spare-card recovery remain deferred at the user’s request. No new radio hardware, desktop replacement, or filesystem mode was installed during this audit.
