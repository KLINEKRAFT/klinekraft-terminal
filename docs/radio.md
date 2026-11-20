# Internet radio

The header radio icon next to the speaker opens a compact player on every
page. Play KEXP, Stop radio to release the stream, or expand Add station to
save another name and direct HTTPS audio URL. Supported codecs depend on the
installed browser; direct MP3/AAC streams are the intended inputs. Website,
playlist and authentication URLs are not automatically resolved.

KEXP's official 160 kbps AAC-LC endpoint:
https://kexp.streamguys1.com/kexp160.aac
Verified against https://www.kexp.org/streaming-urls/ on November 19, 2026.

Playback stays mounted across Terminal page changes and popup closure, but
stops on refresh/app closure. There is no autoplay or automatic reconnection
after restarting the app. Stream stalls time out with a retry message.
The system speaker control affects this player's default output, along with
other apps. Audio level in the player itself stays at unity.

Station choices are in radio_stations in the private SQLite database and are
included in the encrypted daily backup. Streams go directly from the chosen
station to the browser; the backend stores station metadata and does not proxy
arbitrary network destinations. Internet is required; this is not an FM tuner.
KEXP is built in; additional stations can be removed.

Verified: production build, two backend storage/validation tests, three
browser tests for station persistence, page navigation, stopping playback,
volume and compact Home layout. A separate real KEXP playback test on the Pi's
Chromium reached readyState 4 with advancing playback and no media error,
then stopped and removed the stream URL.
