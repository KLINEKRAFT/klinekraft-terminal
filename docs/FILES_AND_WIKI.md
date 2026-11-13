# Files and offline Wikipedia on the Pi

From `~/klinekraft-terminal`, update dependencies and build:

```bash
npm ci
.venv/bin/python -m pip install -e ./backend
npm run build
systemctl --user restart klinekraft.service
bash scripts/setup-local-content.sh
```

The last command installs Debian's `kiwix-tools`, creates Documents/Wikipedia and Downloads if absent, downloads the latest small English 100-article ZIM offered by Kiwix (current unqualified filename supported, mini preferred when available, maximum 1 GiB), and starts a user service at login. Existing ZIM archives are retained and skip the starter download. Internet is needed for installation; reading downloaded articles works offline. This is a starter selection, not the full Wikipedia. The download is checked for expected size and ZIM signature, not a cryptographic publisher signature.

Open **Files** to browse Documents or Downloads and download a copy of a regular file up to 100 MB. No edit, delete, upload or execute endpoint exists. Hidden entries and symlinks are excluded; directories show up to 500 entries with a notice when truncated. These are literal `~/Documents` and `~/Downloads` folders, not localized XDG paths. Downloads use browser memory, hence the size cap. Use the desktop file manager for larger files or changes.

Open **Library → Wikipedia → Open Wikipedia**. Kiwix opens in a separate tab; choose an archive and use its search. The app checks the reader on opening Library and when selecting Check reader. It does not fabricate ready status or search results. The hosted Vercel demo does not query local files or Kiwix.

For a larger collection, use https://library.kiwix.org to select and download a ZIM into `~/Documents/Wikipedia`, check available disk space first, then run:

```bash
systemctl --user restart klinekraft-wiki.service
```

The API and Kiwix reader bind only to loopback. Files endpoints require the app's custom header and do not enable CORS, so unrelated web pages cannot read the local API through a browser. This is a single-user desktop app, not an authenticated multi-user network file server. Keep both services on loopback. Kiwix uses port 8081; the app uses 8000. The browser must run on the same Pi.

Troubleshooting:

```bash
systemctl --user status klinekraft.service klinekraft-wiki.service --no-pager -l
curl -H 'X-Klinekraft-Client: local-ui' http://127.0.0.1:8000/api/wiki
```

To stop Wikipedia startup: `systemctl --user disable --now klinekraft-wiki.service`. Archives remain on disk. Files and bookmarks continue to work independently.


If an earlier installer said no starter archive was found, update the app and rerun `bash scripts/setup-local-content.sh`. The downloader now accepts Kiwix's `wikipedia_en_100_YYYY-MM.zim` names as well as variant names. Run battery setup separately so a failed archive download cannot skip I2C configuration.
