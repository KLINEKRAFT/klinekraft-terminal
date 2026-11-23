# Shackleton voice companion

The local backend owns microphone capture and speech playback independently of Chromium. A small GTK layer-shell window supplies a desktop/Away indicator; the web app supplies a fallback overlay, a persistent mute button, and preferences under Settings → Speech → Hands-free Shackleton.

Say **Shackleton**, pause for the animation, then give the request. Wake detection uses a local constrained Vosk vocabulary; it is an initial implementation that still needs room/microphone calibration, not a custom trained openWakeWord model. The default seven-second follow-up window can be changed or disabled. **Shackleton, stop**, the Stop button, or Mute invalidates the current request so late answers cannot speak or save. An interrupted provider request may continue consuming provider resources until its bounded timeout finishes.

Appearance: fine particle hologram or Liquid Core. Canvas work is limited to 24 fps, precomputes sphere positions, batches dots by depth, skips hidden surfaces, caps pixel ratio, and respects reduced-motion in the browser. The native overlay uses Cairo and runs only while active. Listening uses microphone amplitude; speaking uses the decoded speech audio amplitude. Thinking has separate motion. Idle is a compact mute badge.

## Privacy and online behavior

Ambient audio stays in the Pi's RAM and is discarded. Only after wake does a bounded request buffer exist (maximum 35 seconds). Microphone audio is never written to a file. Online Scribe transcription explicitly requests `enable_logging=false`; rejection or unavailability falls back to local Vosk transcription. The current account's synthetic zero-retention test was rejected/unavailable, so local recognition remains the usable path. Rejected online requests are cooled down for five minutes. No request retries with weaker retention settings.

Online answering uses the existing OpenAI key, with local AI fallback for eligible service failures. Speech uses the existing selected ElevenLabs voice, with espeak-ng fallback. These cloud text services retain their own account policies; the no-recording guarantee above concerns microphone audio on the deck and the requested transcription retention mode.

Only completed text requests/answers and sources are saved into ordinary chat History, under `Voice · …`. Raw recordings are not saved. History can be opened, exported, or deleted normally. Voice sessions are separate from the currently open typed chat. Typed chat adds optional automatic read-aloud and Stop response.

## Supported local commands

- What time is it?
- What is the weather today? / Brief me.
- Check battery. / GPS status. / Where am I?
- Open notes / maps / library / weather / calculator / games / settings.
- Play radio. / Stop radio. / Volume up. / Set volume to fifty percent.
- Create a note remember the spare batteries.
- Save that to Notes. (Last completed voice answer.)
- Set a five minute timer. / Set a timer for five minutes. / Cancel timers.
- Mark this location as camp. (Requires a fresh GPS fix.)
- Read this page. (Current PDF/text page, selected text, or visible Terminal page.)
- Explain this passage. (Uses current page context plus the chosen AI.)
- General questions use existing saved Wikipedia, research library, and weather references.

Page and radio controls require an open Terminal app. The frontend acknowledges their completion; unsaved Paint protection still applies. They cannot execute arbitrary shell commands. Destructive system commands are not enabled.

Timers are saved privately and survive a backend restart; they require a running deck for audible alerts. Overdue timers are announced when the service resumes and becomes idle. Timers do not wake powered-off hardware. Radio ducking is per stream, so it does not reduce the system volume or the assistant's own voice. Browser read-aloud shares radio focus and stops another browser reader before starting.

## Installation and operation

Run `scripts/setup-voice.sh` for the Vosk model, optional Python voice dependencies, and the desktop indicator. The existing `klinekraft.service` runs the microphone worker. `klinekraft-voice-overlay.service` runs the desktop indicator as the logged-in user. The backend starts muted unless enabled in Settings; this preference is private and persists across restarts. This is available after desktop login, not at the password screen.

Settings: `~/.config/klinekraft/voice.json` (0600). Model: `~/.local/share/klinekraft/voice/vosk-model-small-en-us-0.15`. Timers: `~/.local/share/klinekraft/voice-timers.json` (0600). Text chats use the existing conversations database. No model or credentials are committed.

## Sources consulted

- Three.js point size and depth attenuation: https://threejs.org/docs/pages/PointsMaterial.html
- Canvas batching/caching and pixel ratio: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Audio/state-driven visualizers: https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/
- ElevenLabs UI inspiration: https://ui.elevenlabs.io/
- Local command pipeline: https://contributors.home-assistant.io/architecture/platform/voice/
- Vosk small English model and Raspberry Pi support: https://alphacephei.com/vosk/models
- Scribe retention: https://elevenlabs.io/docs/api-reference/speech-to-text/convert

The implementation is original and uses these as references, rather than importing whole assistant frameworks or their artwork.

## Validation — November 23, 2026

- Owner confirmed: “Wakes and answers” using the connected USB microphone and speaker.
- Synthetic wake/stop samples passed with the constrained wake vocabulary; four unrelated samples were rejected. This is not a comprehensive false-wake benchmark.
- Full backend suite: 159 passed before the final voice-dismissal adjustment; 31 focused voice/assistant tests passed afterward (including the added dismissal regression).
- Six browser tests passed at the small-screen layout, covering voice UI, native/browser overlay coordination, PDF citation reading, saved audio, and radio playback. Eight existing unit tests and TypeScript/build checks passed.
- Native Wayland overlay and backend services are active. The model is installed locally; no microphone recordings are saved.
- Final conversational adjustment: low-confidence local utterances are ignored, common dismissals close the follow-up window, and voice model replies use a short plain-language prompt with clarification for unclear speech.
- Still needs broader field testing: recognition with radio/background noise, many accents/distances, long offline conversations, and restart/overdue-timer behavior on the actual deck (timer persistence is covered in tests).
