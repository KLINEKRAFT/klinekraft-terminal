# Notes recovery

Notes retain each previously saved text version in `organizer_history`, in the
same SQLite transaction as the replacement. Calendar text uses the same history.
A revision conflict does not overwrite the item or add a history entry. Drawing
PNGs are excluded. History is private to the local app and included automatically
in the existing consistent database backup.

Use **History** at the top of an open note to preview and restore an earlier version.
Restoring creates a new revision and retains the overwritten copy. Version dates
show when the copy was backed up, rather than claiming its original creation time.
History starts when this feature is installed; it cannot recreate earlier edits.

Undo/Redo and Ctrl+Z / Ctrl+Shift+Z work while the editor remains open, including
after autosave. The in-memory stack retains 250 editing states. Persistent saved
history remains available after switching notes or restarting the app.

The trash-can icon beside each list item moves it to Trash. Open Trash and use the
restore arrow to bring it back. There is no permanent-delete control. Saving or
trashing does not discard text entered while a request is pending.

Checks: backend overwrite/conflict/restore/archive test; browser select-all →
Backspace → autosave → Undo/Redo; reload → History restore; Trash and restore;
existing note switching success and save-conflict checks.
