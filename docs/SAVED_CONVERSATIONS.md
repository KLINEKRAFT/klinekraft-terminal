# Saved conversations (Phase 1)

Completed answers now save automatically to the Pi at
`~/.local/share/klinekraft/conversations.sqlite3`. The file has owner-only permissions.
It is independent of browser storage, the Git checkout, and the OpenAI key.
Set KLINEKRAFT_DATA_DIR on the backend to override its directory.

History opens a compact panel to search, reopen, rename and delete chats.
Search checks titles and saved message content; the latest 200 matching chats
are listed. Older chats are still stored and included in exports.
The last-opened chat ID is a browser preference. A new browser can find the same
conversations through History. Opening an article's “Ask AI” starts a new chat
with that article attached. Removing the article updates the saved context.

Each chat holds up to 200 completed question/answer pairs. At that limit, start
another chat; older answers are never silently discarded. Only six recent
messages are sent as conversation context to the model, not the entire saved
history. Saving is local and makes no additional cloud request.

If a save fails, the answer stays in the current page session, including when
switching sections. Retry save, export this chat, or save a separate copy.
Reloading/closing before saving or exporting can lose unsaved content; the
browser warns when supported. Concurrent browser edits produce a conflict
instead of overwriting another tab. An answer still being generated is not
saved, and leaving the assistant cancels waiting for that response.

Export all chats downloads a versioned JSON archive with titles, text,
citations and local image references. Image files are not embedded. This is a
portable export, not an automatic full-device backup. There is no JSON import
screen yet. For a restorable database backup, stop the user service and copy
conversations.sqlite3 to your backup drive, then start the service again.
Restore with the service stopped, preserve owner-only permissions, and restart.
Do not delete the original database as part of normal updates.

Update on the Pi:
```bash
(
set -e
cd ~/klinekraft-terminal
git pull --ff-only origin codex/sidebar-dark-mode
.venv/bin/python -m pip install -e ./backend
npm run build
systemctl --user restart klinekraft.service
)
```

Refresh the browser after updating. Historical chats from before this feature
were only in memory and cannot be recovered after their page was closed.

Verification:
```bash
.venv/bin/python -m pytest backend/tests -q
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test --config playwright.chats.config.ts
```
The dedicated browser tests use the real API and SQLite with disposable storage
and a fake AI provider. They require no API key or paid requests.
