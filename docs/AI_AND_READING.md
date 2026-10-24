# Wikipedia reading view and cloud AI

Library searches the installed Kiwix Wikipedia archive and opens a simplified article inside Klinekraft. Typography, colors and controls follow the terminal theme. Reading and local images work without internet. Original layout remains available for equations, complex tables and unsupported image formats. Text is extracted, never executed as HTML. Images retain original licensing; original article links provide credit details.

AI assistant uses OpenAI gpt-4.1-mini. Create an API key at https://platform.openai.com/api-keys and enable API billing (separate from a ChatGPT subscription). Set a project budget/usage alert in your OpenAI account.

On the Pi, after pulling this branch:
```bash
cd ~/klinekraft-terminal
.venv/bin/python -m pip install -e ./backend
npm run build
systemctl --user restart klinekraft.service
python3 scripts/setup-ai.py
```

The hidden prompt writes ~/.config/klinekraft/ai.env with owner-only permissions and adds a systemd user service environment drop-in. Do not paste your key into chat or commit it. Setup makes no billable request. Restart the service after key changes. No key is sent to the browser.

Use **AI assistant**, or open a Library article and choose **Ask AI about this**. With local Wikipedia enabled, general questions search the first installed Wikipedia archive for up to three articles. Article-context questions use that article. Only small excerpts, image captions, the question and up to six recent messages are sent to OpenAI. The archive and image files stay on the Pi. Images displayed with answers are chosen from retrieved articles, not generated. Images may be omitted when unavailable or not relevant.

Citations are restricted to retrieved sources, but an AI claim can still be wrong; inspect its sources. If the starter archive does not cover the topic, the answer explicitly indicates the lack of local sources and may use model knowledge. Chat is kept in memory until reload, with at most twelve turns displayed. Cloud AI needs internet. Local Wikipedia remains available independently.

Local endpoints require the terminal's custom request header. Kiwix access is fixed to 127.0.0.1:8081 and archive content paths, with bounded reads and redirects. The AI has no shell or file-modification tools.

Validation uses Kiwix catalog/search/article fixtures and mocked OpenAI responses; it does not exercise your Pi archive or a paid account. After installation, search a known topic, open the article, choose Ask AI, and check the source links.
