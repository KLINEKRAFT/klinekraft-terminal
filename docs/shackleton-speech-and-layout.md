# Shackleton chat and read-aloud — November 20, 2026

Shackleton opens a fresh welcome/composer each time its page mounts. Saved chats
remain in History, now a centered modal instead of a sidebar. Failed saves
still recover their unsaved answer rather than discarding it for a blank page.
The conversation uses a centered column, normal paragraph wrapping, Markdown
headings/lists/tables/code, quieter answer actions and a simpler composer.
Reference/source details are retained behind disclosure controls.

Local AI explanation is now the initial chat mode. Direct quotations remain
available as "Quote guides directly" in Chat settings and that preference is
remembered. Answer engine selection remains independent of speech engine.

Each answer has Read aloud / Stop and Copy. Speech never starts automatically,
and leaving the chat or selecting a different conversation stops playback.
The latest rendered audio stays in memory for replay without regenerating;
it is released on leaving the page. Code blocks are skipped and Markdown
markers/URLs/citation markers are removed from spoken text.

## Offline voice
Installed espeak-ng (29.4 MB including dependencies). This is a basic synthetic
voice, not a natural ElevenLabs voice. Backend synthesis takes text on stdin,
returns WAV, and never invokes the cloud. Reinstall if needed:

    sudo apt-get install espeak-ng

## ElevenLabs
Chat settings → Read-aloud voice → ElevenLabs. Enter the API key privately in
Terminal and Save voice settings. Credentials are verified with the voices
endpoint without generating paid speech. The key is stored at
~/.config/klinekraft/speech.json with permissions 0600, never returned by the
status endpoint and never placed in Git or browser storage.

Default voice: George (JBFqnCBsd6RMkjVDRZzb), warm mature British male, confirmed
through the connected ElevenLabs voice catalog. Model: eleven_flash_v2_5.
Official documentation:
https://elevenlabs.io/docs/api-reference/text-to-speech/convert/
API key page:
https://elevenlabs.io/app/api/api-keys

Only the requested answer is sent to ElevenLabs when Read aloud is pressed
with that engine selected. Internet and account credits are required.
There is no automatic fallback between local and cloud engines. A failed
ElevenLabs request offers the option to select Offline voice manually.
No microphone permission, recording or conversational voice agent was added.

## Verification
32 backend checks passed for speech credentials, provider isolation, text
cleanup, existing knowledge and offline behavior. Seven browser checks passed
for fresh entry, saved-history access, formatting, read/stop, private setup,
PDF citations and keyboard flow. Earlier browser timeouts were caused by RAM/
swap pressure; tests passed after temporarily unloading the local AI model.
The model was restarted afterward.

A real offline WAV was generated through the live API and successfully played
through PipeWire. Live ElevenLabs synthesis remains pending the user's API key.

## Voice presets

Read-aloud settings offer David (WdZjiN0nNcik2LBjOHiv), George,
Daniel and Adam, plus a custom ID field. Existing selections stay unchanged
until Save voice settings is pressed. Voice changes invalidate the read-aloud
audio cache. These are cloud voices; the separate basic offline engine remains
available. Voice library availability depends on the connected ElevenLabs account.

## Brief me and saved listening

Home → Brief me builds a deterministic summary from the deck's weather/alert
snapshot, system battery reading and GPS. It labels missing/stale sources and
includes the configured weather location and checked times. It does not infer
safety from an empty feed or send exact GPS coordinates to the voice service.
Review the text, then choose Read aloud or Read & save audio.

Notes → Listen opens the current draft as plain text. Library PDF previews →
Listen reads the current page; text documents can also be read. The passage is
editable before synthesis, with a 16,000-character limit. Scanned PDFs without
a text layer require OCR. Reading a draft does not modify or save the note.

Each Listen window has a Saved audio drawer, with timestamps, playback and
two-step deletion. Recordings are private files in
~/.local/share/klinekraft/saved-audio (0600 files, 0700 new directory). This
is a local audio collection, not a promise of cloud backup. Saving is explicit;
ordinary Read aloud remains temporary. The collection allows 100 recordings
and blocks new generation once existing audio totals 250 MB (one generation
can add up to 25 MB). Replay never calls ElevenLabs. Use the Offline engine to
create new audio without internet; ElevenLabs generation requires credentials,
voice access, internet and credits. Voice selection stays in Shackleton settings.

Validation: backend storage/replay/deletion/quota tests; browser checks for
stale briefings, saving and replaying without synthesis, current PDF page,
and current note draft. Live offline synthesis/save/replay/delete verified.
Cloud synthesis is unchanged and is not invoked by automated checks.

Weather now offers Weather summary using today's forecast date in the forecast
location's timezone: conditions, high/low, precipitation probability, maximum
wind and sunset. Missing dates are reported rather than substituting another
day. Paused or stale feeds are labeled as saved data. It uses the same audio
preview/save controls as Brief me.

Shared secondary cards close on outside clicks. Modal backdrop dismissal calls
the existing cancel handler to preserve component state and focus cleanup;
clicks inside and drags starting inside are not backdrop dismissal. Nested audio
cards close independently of their document reader. Inline notebook/history
accordions keep their existing behavior.

## Simplified playback

Voice engine, presets and API credentials now live in Settings → Speech,
shared by Shackleton, weather and documents. Weather summary and document
Listen play directly with a Stop button, without preview dialogs or saving.
Weather starts “Weather in [location] today,” omits spoken dates/timestamps,
and still labels stale forecasts. Notes and Brief me retain their audio-save
controls. Long document text is read in sequential bounded requests; closing
or changing the document stops playback. PDF zoom controls range from 25% to
200%, with the percentage button resetting to fit width (100%).
