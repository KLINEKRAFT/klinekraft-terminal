# Universal search and secondary panels

The header magnifying glass and Ctrl/Cmd+K open Search Terminal from any workspace. Search finds apps immediately; two or more characters also search saved notes (including formatted body text), the indexed research library, every installed Kiwix archive, saved map locations, and the local map catalog. Archived notes are excluded. Results open the note editor, document preview at its matching page, illustrated Kiwix article, or selected map pin. Kiwix articles can be passed directly to Shackleton as source context. The existing footer still runs app commands with Enter.

Search uses only the Pi's existing local APIs. It does not send queries to external services. Notes and place metadata are cached for the lifetime of the search dialog, while indexed document and Kiwix searches are debounced and cancelled when the query changes. Sources render progressively, so Kiwix latency does not block notes or documents. Each source can fail independently; available results remain usable and unavailable sources are named. Opening a note uses the editor's existing save-before-switch behavior and retains draft recovery.

Escape closes search and returns focus. Tab and arrow keys navigate results; Enter on a result opens it. Results are capped at 80, with a refinement notice when capped. Search is constrained to the viewport and scrolls inside the dialog.

`DetailsPanel` standardizes secondary controls in Library, Briefing, Emergency, Network, notebook saves, and System hardware information. Panels are closed initially and share a native exclusive disclosure group. Essential errors and status messages remain outside them. Small information popovers close on an outside click or Escape.

Shackleton's approved head logo is stored locally as `/shackleton.svg`, preserving the supplied SVG geometry. Its display box is 115 by 120 CSS pixels (half the comparison mockup's 230 by 240). Theme CSS renders black on light and white on dark backgrounds.


## Illustrated Wikipedia expansion · November 17, 2026

Installed `wikipedia_en_top_maxi_2026-09.zim` from the official Kiwix catalog. Its title is **Best of Wikipedia**, described by its catalog as a selection of the best 50,000 Wikipedia articles. It contains complete selected articles with illustrations; it is not all of English Wikipedia. The original Wikipedia 100 and October 2026 WikiMed archives remain installed.

- File size: 6,991,081,681 bytes (6.51 GiB).
- SHA-256 verified before activation: `7c08d2a7557ef7e3da751bb429d081e1c7c8971e50fee4fef097021a03ea6b0a`.
- Source: https://download.kiwix.org/zim/wikipedia/wikipedia_en_top_maxi_2026-09.zim
- Download staged outside the active archive glob, resumed through official Metalink mirrors, then atomically moved into `~/Documents/Wikipedia/` after verification.
- Existing `scripts/run-kiwix.sh` discovers the archive on service startup. The Kiwix service was restarted and its catalog, article text and images verified locally.

The backend searches all installed archives, including non-Wikipedia publishers, using a shared three-worker pool. Catalog pagination avoids the prior four-archive search limit and repeated catalog fetches. Duplicate Wikipedia titles favor illustrated Maxi editions. Partial failures are reported; a total failure is an error rather than a misleading empty result. Shackleton uses the same search implementation. Library → Wikipedia now defaults to **All archives** and allows selecting one archive explicitly.
