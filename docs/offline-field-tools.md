# Offline field tools

## Shackleton

Settings in Shackleton selects **Offline · this Pi** (default) or **Cloud · OpenAI**. Mode is retained in this browser. Offline never falls back to the cloud. Research library is enabled by default. Wikipedia retrieval searches installed archives, including WikiMed. References are retrieved at question time; downloading guides does not train the model.

**Direct-reference mode is the offline default.** It displays source excerpts verbatim without an AI request and works even if the local model service is stopped. The visible mode button switches to AI explanation for general questions. During testing the original 1.5B candidate contradicted generator guidance, so it was replaced and is not used by the service. The stronger model is still not a substitute for the original emergency/medical reference.

Installed local model: Qwen3-4B-Instruct-2507 GGUF Q4_K_M, quantized by LM Studio Community from Qwen’s instruction model; repository revision `4edb920b6f14e3b9284d4502a6485103d72cde05`, SHA256 `8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc`. Engine: llama.cpp v1.0.0 commit `b1b770d90d94cad9e9ea5b993bdbc383a522fb28`. The 8 GB Pi serves one request at a time, three CPU threads, 6144 context tokens, bounded excerpts/history/output. A small model is less capable than the cloud model; always inspect cited original guidance for consequential decisions. Text and text-based PDF attachments work locally; images require cloud mode. A general two-sentence answer took about 25 seconds in the disconnected test; longer answers can take a minute or more. Direct-reference mode returned its excerpts in about 0.3 seconds.

Run `bash scripts/setup-offline-ai.sh` to reproduce installation. The service binds only `127.0.0.1:8082` and requires a private per-device API key (never committed). Kiwix remains on port 8081. `systemctl --user status klinekraft-ai` checks it. `systemctl --user stop klinekraft-ai` frees its memory; `start` restores it. No model download is needed after installation.

## Library and emergency dashboard

Library searches SQLite FTS5 with word stemming, relevance ranking, source snippets and matching PDF page links. Original files and stable document IDs remain intact. FTS triggers track imports, updates and deletions. Shackleton shares the search index and limits duplicate sections of the same manual.

Emergency is sidebar section 14. Its topic buttons open stored references without using AI. Readiness reflects installed maps, indexed documents and local model availability, not current danger or live alerts. Contacts/plans use Notes; the dashboard does not invent contact details or stock levels.

`python3 scripts/load-emergency-library.py --date YYYY-MM-DD --import-local` adds official publisher references, keeping existing cached downloads. The manifest records sources, editions, hashes and failures. `scripts/ocr-library.py` uses OCRmyPDF on image-only indexed PDFs; OCR text augments the index without changing original PDF bytes. OCR can contain recognition errors; consult the image. The expanded Hesperian chapters span 2025 health, 2024 dental and 2012 environmental-health editions. Old publication dates remain visible.

WikiMed: `wikipedia_en_medicine_maxi_2026-10.zim`, official Kiwix download SHA256 `9a1570f2f346aa18694ee520e0483f19b7447f69e0970e2f727c53ccf0dcc7d6`. Stored in `~/Documents/Wikipedia` and served by the existing Kiwix unit. Kiwix is browsable from Library and searched by Shackleton. It is separate from the numbered research-document count.

## Routes

GPS / Maps → Offline route planner: select a point, set it as start, choose a second point, then calculate. Driving, cycling and walking profiles use BRouter 1.7.10 locally, bound to `127.0.0.1:17777`. Successful routes save in the existing SQLite database; reopen them from Saved routes or export GeoJSON. No live traffic, closure information, address geocoder or turn-by-turn guidance is provided. A GPS receiver is not needed to plan a route manually.

`bash scripts/setup-routing.sh` installs the engine and service. `python3 scripts/download-routing.py` installs 5-degree routing segments for lower 48 + Alaska, excluding Hawaii. Rectangular coverage includes neighboring regions. On initial install 120 segments occupied about 1.76 GiB. Data is separate from PMTiles. Downloads stage before publishing; sizes are checked against the publisher index and hashes recorded in `~/.local/share/klinekraft/routing/coverage.json`. Very long or unavailable routes may fail within the bounded routing time; plan shorter legs.

## Phone access

Network → Field connections → Phone hotspot. Setup: `python3 scripts/setup-hotspot.py`. It creates a WPA2-protected, non-autoconnecting NetworkManager profile and a private random password. Start is explicit because this Pi has one Wi-Fi interface: starting disconnects existing Wi-Fi. Join **Klinekraft Field Library** using the password shown in the local UI, then open `http://10.42.0.1:8090` on the phone. No internet is needed. Stop hotspot and reconnect normal Wi-Fi when finished.

A disconnected acceptance test verified reference search, general local inference, routing and this library with no default internet route. Normal Wi-Fi was restored afterward. The public service binds only the hotspot IP and exposes search and document reads from collections beginning `Emergency - `. Putting a document into such a collection makes it available to hotspot participants. Notes, chat, files, hardware controls, AI calls and private collections are not exposed. The private Terminal remains loopback-only. The phone page has no remote scripts/fonts or write endpoints.

## Off-grid messages

Network → Field connections → Off-grid messages. Installed Meshtastic Python package 2.7.11. Attach a **configured Meshtastic LoRa USB radio**, choose its serial device and Connect. The deck does not flash firmware, change radio region/channel keys, or send test messages automatically. It uses the radio's existing primary channel, with broadcast or known node recipients. Send is explicit and limited to 200 UTF-8 bytes.

Messages are locally persisted; a transmitted message is labeled **Queued to radio; delivery unconfirmed**. No delivery acknowledgment is claimed. There is no radio connected on the current Pi, so over-air delivery cannot yet be verified. Built-in Wi-Fi and Bluetooth do not replace LoRa hardware. Connection is explicit after app-service restart.

## Sources

- https://github.com/ggml-org/llama.cpp
- https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF
- https://github.com/abrensch/brouter
- https://brouter.de/brouter/segments4/
- https://python.meshtastic.org/
- https://github.com/ocrmypdf/OCRmyPDF
- https://languages.hesperian.org/pages/en/pdf.html
- https://download.kiwix.org/zim/wikipedia/

Internet-in-a-Box, Kolibri and Argos Translate reference documents are included as further-learning material. Their full application stacks are not installed over the custom Terminal.
