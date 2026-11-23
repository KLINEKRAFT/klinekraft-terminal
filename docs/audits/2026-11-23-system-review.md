# System and merged-design review — November 23, 2026

## Repairs

- Desktop wallpaper was configured for HDMI-A-1 while the monitor is now on
  HDMI-A-2. Restored the existing Klinekraft image and centered presentation on
  both outputs. Added scripts/restore-wallpaper.sh; it preserves configuration
  backups and can repeat the repair without editing the image.
- Field/Dim polling could apply a response started before a successful toggle.
  Mutation generations now discard outdated polls and skip polling during writes.
- Paint's one-second autosave left a navigation gap when local recovery storage
  was full. Page navigation now waits for the current save, saves newer strokes,
  and remains on Paint if persistence fails. Revision checking remains intact.
- The live event ticker could cover Return to desktop. The navigation drawer
  now stacks above ticker/popover controls. Native modal dialogs stay above both.

## Verification

- Backend: 149 passed; unit tests: 8 passed.
- Baseline browser suite: 98/99. Its failure exposed the ticker/drawer bug.
- Updated build and targeted suite: 18 passed, including the original failure
  and new regression checks for stale power polls and Paint storage failures.
- Additional delayed-save Paint regression: passed; newer strokes are saved with
  the updated revision before navigation completes.
- Production TypeScript/Vite build passed; existing bundle-size warning remains.
- Live cloud Shackleton answered a simple question in 2.1 seconds; offline
  Shackleton answered in 17.7 seconds after model readiness. Cold model reload
  took about 54 seconds. These checks did not save a conversation.
- ElevenLabs credential read succeeded; the selected David voice was listed.
  No paid ElevenLabs speech generation was needed for this audit.
- Live SQLite quick_check: ok. Nine notes, two calendar events, ten drawings;
  the Pensa M&m recipe is present. Note history is currently small (8 entries).
- Catalog: 2,600 games. Library: 915 documents; three Kiwix books available.
  Routing: 120 segments, coverage ready. Weather/science snapshots current.
- Scheduled encrypted Drive backup completed: snapshot 2853cf45. This audit did
  not perform a physical boot restore or a fresh full download of that snapshot.
- USB speaker remains the default output, unmuted at 60%. A PCM2902 mono input
  is detected as the default source; recording was not activated.
- GPS hardware and gpsd are detected, but there is no current satellite fix.
- Display: 1024x600 preferred mode, scale 1. No Pi throttling flags; about 49 GB
  storage free. Battery around 14% with external power detected during testing.

## Limits / follow-up

The checks cover the current build and connected services, not every possible
hardware condition. AirPlay pairing, phone hotspot switching, shutdown/battery
cutoff and a new outdoor GPS drive were not repeated because they interrupt the
session or need physical participation. Online speech playback and speaker
acoustics were not re-auditioned. General voice conversations remain deferred.

Claude's remaining architectural suggestions (drawing-list payload reduction,
long-running AI request persistence, optional note-history retention and GPS
clock behavior on an offline cold boot) remain future work. No note history was
pruned and no user files were deleted.
