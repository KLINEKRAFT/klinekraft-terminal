# Claude redesign / Pi integration

Merged GitHub main 72fc2a8 (PR #41) into the Pi's current branch.
The published b228c4f tree was used to distinguish the subsequent Pi work
from Claude's redesign when resolving conflicts; both Git histories remain
parents of this merge.

Retained the redesigned shell, Home, Maps fallback, Library, Paint, organizer
conflict recovery, converter, resilient feeds and shared style sheets.
Preserved Pi trip recording, volume, radio, speech, voice presets in Settings,
fresh Shackleton chats with on-demand History, direct weather/document speech,
PDF zoom, card dismissal and local-model latency tuning. Brief me, Tools and
Away use identical borderless controls (36px, 14px Inter) at 1024x600.

Validation:
- Backend: 149 passed.
- Unit: 8 passed.
- Browser: 95/99 initially; four stale test assumptions updated for the
  merged keyboard order, outside-click source dismissal and nested summaries.
  Targeted recheck: 15/15, including all four initial failures.
- Chat persistence: 2 passed after updating selectors and explicitly reopening
  saved History on reload, consistent with the requested fresh welcome screen.
- Hosted demo: 1 passed; built into /tmp, leaving the Pi's production build intact.
- Production TypeScript/Vite build passed. Vite retains its existing large-chunk
  warning.
- Live Home checked at 1024x600: no document overflow; all three Home actions
  have matching typography, dimensions and transparent borders.

No user notes or other personal data were migrated or overwritten.
