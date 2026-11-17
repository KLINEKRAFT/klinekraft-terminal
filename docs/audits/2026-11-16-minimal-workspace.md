# Minimal workspace redesign

## Intent and decisions

The 1024×600 deck gains space by using Home as an application launcher and making the main navigation a temporary drawer. Games follows Paint. Field and Dim are compact independent blue switches; explanatory power details live behind an information disclosure. Important failures and battery warnings remain visible. Paint and Shackleton omit redundant page headings. The command bar is on Home; Ctrl+K still reaches commands or the chat composer.

Notes/Calendar autosave previously disabled inputs and overwrote the draft with a completed request. Saves now take a snapshot, leave inputs enabled, merge the returned revision into newer local edits, and queue the newer draft. Browser recovery persists newer text. Switching is blocked on failure or edits arriving during a save. Debounce is 1.6 seconds. Untitled notes derive a title from their body. Rich notes use a version marker with an allowlisted, attribute-free HTML subset; old plain notes still load. Pasted material is plain text. Basic bold/italic/underline, headings, lists and checklist marks are supported, not full Apple Notes parity.

Calendar calculates eleven nationwide federal holidays, weekend observed dates and common US observances offline. It does not claim every state/local/religious holiday. Dates follow the local device timezone. Source: https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/

## Visual Library and games

Reviewed KLINEKRAFT/Archive-Scout README, components/item-grid.tsx and components/use-previews.ts. Adapted image-first cards, lazy previews and an in-app detail reader to local documents; did not install its live multi-provider search server. https://github.com/KLINEKRAFT/Archive-Scout

scrolltide.com and www.scrolltide.com were unavailable through web browsing; direct inspection redirected to /lander and a parked-domain page. No claim of inspecting the requested carousel design. Horizontal shelves follow the user's description. Shelf/grid/list and PDF/text filters stay within Terminal typography and colors. PDF covers are bounded local pdftoppm renders cached by digest with two concurrent renders; images require the existing local-client header. The reader retains original PDF pages and citations. Emergency combines concise field cards with the same visual Library and PDF reader.

Games uses cached Libretro cover images keyed to existing game IDs; titles match conservatively, with an explicit GoldenEye alias. No ROMs downloaded or changed. Missing art gets a title card. Favorites and explicit launch behavior stay intact. Source: https://github.com/libretro-thumbnails/libretro-thumbnails

## Paint and Shackleton

Paint keeps its raster engine. The user clarified that familiar Illustrator tools and functions are the goal, not vector output. File actions move into one dropdown; the swatch row is replaced by a compact hue/saturation wheel, native exact-color picker, and hold/right-click recent colors. Mirror drawing supports left/right, top/bottom and four-way strokes. Drag a baseline with Text on line to place text. Selection context menu supports crop, delete, duplicate, flip and rotate; undo remains available. Text/shapes flatten into PNG, not editable Illustrator vectors. Reference: https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/illustrator-tools-reference.html

Shackleton has a history drawer, selection checkboxes and revision-checked deletion of selected chats, with explicit confirmation. New portrait generated using the imagegen skill and bundled locally. Image generation in Shackleton itself is not implemented: the current offline text model cannot generate images; an online image-service integration would be a separate feature.

## Verification

Production build and 113 backend tests passed. Browser navigation selectors are migrated to a drawer helper. Game favorites are mocked in the persistence test; its synthetic favorite from an earlier run was removed. No owner notes/chats/drawings were deleted. Visual inspection covered all changed pages at 1024×600. Artwork cache completed with 2,062 covers and 538 unmatched titles; fallback cards remain for those titles. PDF cover rendering requires the installed Poppler pdftoppm utility. Existing Vite large-chunk notices remain for offline map/PDF bundles.

Browser verification: 45/46 passed in the broad regression run; the remaining command-result issue was corrected, followed by successful compact-layout and preview rechecks. The final drawer/desktop-flow recheck also passed. All 46 scenarios have passing results; the last focused reruns covered seven compact-layout/preview scenarios.
