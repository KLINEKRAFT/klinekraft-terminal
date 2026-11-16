# Shackleton tests, Cold War library and Emergency readiness

## Verified on the Pi

- Online: gpt-4.1-mini answered a live identity/capability question in 2.9 seconds. A second live request retrieved and cited the saved 1961 Fallout Protection booklet, correctly identifying it as historical rather than current guidance.
- Offline: Qwen3-4B-Instruct-2507-Q4_K_M generated an answer in 88.6 seconds while OCR was running. The test process used systemd IPAddressDeny=any with loopback allowed; an external TCP probe failed as expected. Wi-Fi remained connected for the user's chat. Local model inference used loopback, with no cloud fallback. The test is not a claim of airplane-mode hardware testing.
- A final live API request using the local model and saved references correctly identified the 1968 handbook and Office of Civil Defense, cited its PDF page and collection index, and labeled it historical. It took 222.9 seconds including Field-mode model startup; Wi-Fi remained connected for this retrieval-plus-generation test.
- Local reference-only answers retrieved the historical collection index and document citations; the 1968 title was separately found in the retrieval index.
- A separate isolated audit verified local Library search, map archive/range access, map labels, Wikipedia search/article reading, a short Tulsa route, organizer reads, reference retrieval and phone-library private-route exclusion. Route writes used a temporary database copy.
- Field mode was temporarily turned off to prevent the production idle monitor stopping an inference launched by a separate test process, then restored to On. Dim was preserved. Initial warm-up failures were resolved before recording the successful test.

## Historical collection

Saved under `~/Documents/Cold War Civil Defense` and Library collection **Historical - Cold War civil defense**:

1. **Survival Under Atomic Attack (1951)** — National Security Resources Board; GovInfo scan (17 scanned PDF pages).
2. **Fallout Protection: What to Know and Do About Nuclear Attack (December 1961)** — Office of Civil Defense; Washington State DAHP-hosted scan (48 PDF pages).
3. **In Time of Emergency (1968)** — Office of Civil Defense; county-hosted scan (100 PDF pages). OCR was added to derived searchable sections; original bytes were retained.

There are 42 document sections and one collection index, all with indexed text. They represent three works, not 43 separate books. OCR is imperfect; original images remain available for checking. Source URLs, editions and original SHA-256 hashes are recorded in `assets/emergency/cold-war-sources.json` and the local manifest. Gutenberg text download failed; the 1968 scan was used instead.

This is retrieval-based knowledge, not model retraining or a claim that the assistant can browse or save files itself. Historical collections remain visible in Library but are excluded from ordinary assistant retrieval unless a question explicitly asks for history, vintage material, Cold War material or a period year. Both model prompts label historical sources as dated, not current emergency/medical guidance.

## Emergency dashboard

Replaced configured-equals-ready labels with dated checks for Library, maps, routing, offline AI, online AI, backup and backup restore. Missing tests are Not tested; failed/missing resources Need attention; older tests Need retest. Most checks expire after seven days, backup freshness after 36 hours, restore verification after 30 days. Backup labels explicitly say newer files may not yet be included. No replacement-card boot is claimed. The dashboard performs no cloud calls or automatic inference when opened.

Readiness reports stay local under `~/.local/state/klinekraft/verification`; backup checks read the existing backup status and restore records. Passing a sampled test does not guarantee every route, document or future response. The page is not a live emergency alert receiver.

## Validation

Production build, nine backend tests, the Emergency browser test, and compact-layout tests at 1024×600 and 1024×560 passed. The isolated resource audit passed all 14 checks (including the separately recorded local-generation result).
