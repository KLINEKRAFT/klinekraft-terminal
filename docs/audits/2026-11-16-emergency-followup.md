# Emergency quick references, archive backup and offline performance

## Changes

Emergency now opens with four locally bundled quick-reference cards for outages, drinking water, severe bleeding and shelter/evacuation. The original source links and review date are shown. These are short reference summaries, not a complete first-aid course or live emergency alerts. Readiness is available in a disclosure below the cards. Four Markdown copies were imported into the local Library for assistant retrieval.

Sources checked November 16, 2026:
- CDC power outage safety: https://www.cdc.gov/natural-disasters/response/what-to-do-protect-yourself-during-a-power-outage.html
- CDC water safety: https://www.cdc.gov/water-emergency/about/index.html
- American Red Cross severe bleeding: https://www.redcross.org/take-a-class/resources/learn-first-aid/bleeding-life-threatening-external
- Michigan evacuation and shelter: https://www.michigan.gov/miready/family-preparedness-guide/before-during-and-after-a-disaster/evacuation-and-shelter-in-place

The encrypted backup already covered imported Library copies. Added the original Cold War archive directory, including provenance manifest, and checksum validation of restored originals. Restore checks use a separate directory and do not replace live user data.

A smaller installed Qwen2.5 1.5B model was benchmarked on a separate loopback port. It answered the historical identification prompt but omitted the requested citation IDs. It also returned an off-topic answer for the water prompt. It is not promoted to production. Conversational stop words were allowing irrelevant retrieval; those words are now excluded and a regression test verifies drinking-water relevance. Live retrieval now returns CDC water guidance. The Qwen3 4B model is retained; local context is bounded to two 900-character Library excerpts and one 800-character Wikipedia excerpt to reduce prompt processing. This trades breadth for speed; users can open complete sources or ask narrower follow-ups.

## Validation

Production build, ten backend tests, two Emergency browser tests (including all APIs unavailable) and compact-layout tests at 1024×600 and 1024×560 passed. An initial browser run overlapped the build and saw the old bundle; after the build completed, both tests passed.

Backup snapshot 71f7a562 was restored into an isolated directory: database integrity passed with 911 research records; all three original scan hashes match the source manifest. A subsequent snapshot 02a2979c also includes the four newly added quick-reference notes.

Physical Wi-Fi-off audit passed all 14 checks: Library (915 records), map archive and fonts, Wikipedia, a sample Tulsa route, organizer reads, saved references, local generation, phone-library isolation and frontend. Ethernet was disconnected and an external TCP probe failed. Wi-Fi was restored automatically. The 4B model answered the same historical question with valid citations in 133.6 seconds including startup, versus 222.9 seconds previously. This is an observed single-run improvement, not a controlled benchmark; background load differed. Phone hardware and every route were not tested.

The user reported intermittent display blanking. Kernel logs recorded repeated HDMI ELD errors around 13:50–13:51; vcgencmd reported throttled=0x0. Display diagnosis continues separately.
