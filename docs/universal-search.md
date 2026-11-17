# Universal search and secondary panels

The header magnifying glass and Ctrl/Cmd+K open Search Terminal from any workspace. Search finds apps immediately; two or more characters also search saved notes (including formatted body text), the indexed research library, saved map locations, and the local map catalog. Archived notes are excluded. Results open the note editor, document preview at its matching page, or selected map pin. The existing footer still runs app commands with Enter.

Search uses only the Pi's existing local APIs. It does not send queries to external services. Notes and place metadata are cached for the lifetime of the search dialog, while indexed document searches are debounced and cancelled when the query changes. Each source can fail independently; available results remain usable and unavailable sources are named. Opening a note uses the editor's existing save-before-switch behavior and retains draft recovery.

Escape closes search and returns focus. Tab and arrow keys navigate results; Enter on a result opens it. Results are capped at 80, with a refinement notice when capped. Search is constrained to the viewport and scrolls inside the dialog.

`DetailsPanel` standardizes secondary controls in Library, Briefing, Emergency, Network, notebook saves, and System hardware information. Panels are closed initially and share a native exclusive disclosure group. Essential errors and status messages remain outside them. Small information popovers close on an outside click or Escape.

Shackleton's approved head logo is stored locally as `/shackleton.svg`, preserving the supplied SVG geometry. Its display box is 115 by 120 CSS pixels (half the comparison mockup's 230 by 240). Theme CSS renders black on light and white on dark backgrounds.
