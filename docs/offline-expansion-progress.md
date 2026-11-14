# Offline expansion — November 13, 2026

User requested: offline Shackleton, offline routing, off-grid messaging, expanded resources, emergency dashboard, library search and hotspot access. Work is authorized through publishing/merging (standing user preference).

## Implemented
- Ranked FTS5 Library search, matching excerpts and PDF page links; same retrieval in Shackleton. Existing IDs preserved, SQLite backup saved in ~/.local/state/klinekraft/library-backups/before-offline-expansion.sqlite3.
- Offline provider with explicit Cloud/Offline choice, bounded local requests, no automatic cloud fallback. llama.cpp v1.0.0 built natively on Pi; local service 127.0.0.1:8082, private per-device API key. Existing Kiwix stays on 8081.
- **Important quality finding:** Qwen2.5 1.5B gave an incorrect generator-safety yes/no answer. Do NOT call that model validated for emergencies. Local mode now defaults to **direct reference excerpts**, clearly labeled as quotations, no model rewriting; optional AI explanation is separately selectable. Reference mode works without model service. Backend tests verify no model call in reference mode. Replaced it with checksum-verified Qwen3-4B-Instruct-2507 Q4_K_M; direct-reference mode remains the default.
- Emergency sidebar section 14, topic shortcuts, local readiness and links to maps/notes/system/network. Compact sidebar still fits 1024×560.
- 162 publisher references downloaded, 3 unavailable; 3,139 PDF pages before software readme additions. 868 indexed documents including tools manual and 2 preexisting files. WikiMed October 2026 maxi ZIM installed and checksum-verified. Kiwix multi-archive retrieval added.
- OCRmyPDF installed; image-only Oklahoma family emergency plan indexed with OCR while preserving original bytes.
- BRouter 1.7.10 running on loopback 17777. 120 segments (~1.76 GiB) cover lower 48 + Alaska, no Hawaii, border overlap. Tulsa route tested at 1326 m. Map controls and automatic SQLite route saving/restoring/export added; saved route reopened successfully in the interface.
- Meshtastic 2.7.11 installed. Explicit USB device connect, send, receive, persisted logs, no automatic sends. No radio attached: over-air test blocked on hardware. GPS also absent; manual routes work without GPS.
- Opt-in WPA2 hotspot configured with random private password, inactive by default. Network panel shows credentials only locally. Public read-only library binds 10.42.0.1:8090, exposing only Emergency collections. Test activated hotspot, verified HTTP 200 and private API 404, then restored original Wi-Fi. No secrets in repo.

## Final acceptance
- Qwen3-4B-Instruct-2507 Q4_K_M installed, checksum verified, active on authenticated loopback service. General inference tested with no internet default route: 25.2 seconds.
- Direct-reference generator query returned publisher excerpts in 0.3 seconds while disconnected; this tests retrieval separately from model inference.
- Offline BRouter route returned 1326 m, persisted in SQLite and reopened through the UI as 1.3 km. Hotspot public library returned HTTP 200; private API returned 404. Normal Wi-Fi restored and hotspot left off.
- Production frontend build, 79 backend tests and 13 browser tests passed. Compact layout tested at 1024×600 and 1024×560.
- Emergency dashboard displays 868 searchable references, maps ready and offline Shackleton ready. Deployment and recovery documented in offline-field-tools.md and imported into the local library.
- No Meshtastic radio or GPS attached. Radio transmission and a separate phone connection require hardware/user testing; software does not claim delivery.
- Remaining publisher downloads: FoodSafety.gov outage, AHA/Red Cross 2024 first aid, OSU food storms. Existing overlapping references remain available.

## Runtime notes
User confirmed plugged in. Fan working, observed temperatures approximately 54–66°C under build/inference. Models, routing data, archives and private credentials are device-local, not committed. Hotspot exposes only Emergency collections. Account quota reset/resumption cannot be scheduled automatically; this record preserves the completed work.
