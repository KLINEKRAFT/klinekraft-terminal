# Emergency reference library

Run from the repository root:

```sh
.venv/bin/python scripts/load-emergency-library.py --date YYYY-MM-DD --import-local
```

Requires curl, Ghostscript, Poppler tools (pdfinfo/pdftotext), and the backend's
BeautifulSoup dependency. Downloads the curated `assets/emergency/sources.json`
to `~/Documents/Emergency Library`, preserving original PDFs/HTML, source URLs,
retrieval dates, SHA-256 hashes, and extraction gaps in `manifest.json`.
`START HERE.md` links the originals and explains offline limitations and citations.
Personal downloaded publications are not committed to this repository.

Sections are bounded below the research importer's 8 MiB/32,000-byte limits.
A source publishes sections only after all sections have been generated. Empty-text
PDF pages are retained for viewing and explicitly recorded as image-only ranges.
HTML snapshots omit external images and linked material. Completed sources are
reused on reruns; failed sources are retried. This is not an automatic update feed.
The import endpoint is called repeatedly to complete collections beyond its
50-file batch size. The generated manifest reports downloaded files; validate
actual indexed rows before claiming successful ingestion.

The optional `https_dns` source setting uses Google's HTTPS DNS resolver for
public Army hosts that the deck's usual DNS could not resolve. HTTPS certificate
verification stays enabled, and system network settings are not changed.

Medical sources include dated military guidance and WHO materials intended for
trained providers. The separate collection preserves that context in AI excerpts.
Original PDF pages and tables remain the reference; retrieval is not clinical
validation. The current cloud AI needs internet. Offline reading and local text
search do not. No local model is installed by this script.

Research retrieval ranks matching files before applying the candidate limit,
selects an excerpt containing the most query terms, and favors topical titles.
This prevents recently added manuals from hiding older relevant references.
Regression tests cover older-file retrieval and relevant text deep in a document.
