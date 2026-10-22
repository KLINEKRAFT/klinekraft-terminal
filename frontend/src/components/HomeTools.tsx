import { useState } from "react";
import { ArrowUpRight, Pin } from "lucide-react";
import type { BrowserStore } from "../bookmarks";

const noteKey = "klinekraft.quick-note.v1";
export function useQuickNote() {
  const [state, setState] = useState(() => {
    try {
      return {
        text: localStorage.getItem(noteKey) ?? "",
        status: "Saved on this browser",
        failed: false,
      };
    } catch {
      return {
        text: "",
        status: "Storage unavailable · notes will be temporary",
        failed: true,
      };
    }
  });
  function change(text: string) {
    try {
      localStorage.setItem(noteKey, text);
      setState({ text, status: "Saved on this browser", failed: false });
    } catch {
      setState({
        text,
        status: "Not saved · keep this tab open and copy your note",
        failed: true,
      });
    }
  }
  return { ...state, change };
}

export function greeting(hour: number, choice: number) {
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const options = {
    morning: [
      "Good morning, Colin.",
      "Morning, Colin. Systems ready.",
      "Rise and tinker, Colin.",
      "Morning mission, Colin?",
    ],
    afternoon: [
      "Good afternoon, Colin.",
      "Afternoon, Colin. Make something.",
      "Your afternoon command post, Colin.",
      "Afternoon mission, Colin?",
    ],
    evening: [
      "Good evening, Colin.",
      "Evening shift, Colin.",
      "After-hours mode, Colin.",
      "Evening, Colin. One more idea?",
    ],
  };
  return options[period][choice];
}

export function HomeTools({
  browser,
  note,
  openLibrary,
}: {
  browser: BrowserStore;
  note: ReturnType<typeof useQuickNote>;
  openLibrary: () => void;
}) {
  const pins = browser.data.bookmarks.filter((item) => item.pinned);
  return (
    <section className="home-tools" aria-label="Personal workspace">
      <div className="home-pins">
        <div className="section-heading">
          <h2>
            <Pin size={13} /> Pinned bookmarks
          </h2>
          <button onClick={openLibrary}>Manage</button>
        </div>
        {pins.length ? (
          <ul>
            {pins.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.url}
                >
                  <span>{item.title}</span>
                  <ArrowUpRight size={13} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Keep your regular stops close.
            <br />
            <button onClick={openLibrary}>
              Pin a bookmark from Library <ArrowUpRight size={12} />
            </button>
          </p>
        )}
        {browser.warning && (
          <span className="home-warning" role="alert">
            {browser.warning}
          </span>
        )}
      </div>
      <div className="home-note">
        <div className="section-heading">
          <h2>
            <label htmlFor="quick-note">Quick notes</label>
          </h2>
          <span
            role={note.failed ? "alert" : "status"}
            className={note.failed ? "home-warning" : ""}
          >
            {note.status}
          </span>
        </div>
        <textarea
          id="quick-note"
          value={note.text}
          onChange={(e) => note.change(e.target.value)}
          placeholder="An idea, a reminder, your next mission…"
          maxLength={20000}
          spellCheck
        />
      </div>
    </section>
  );
}
