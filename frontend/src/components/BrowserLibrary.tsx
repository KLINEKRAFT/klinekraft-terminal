import { useState, type FormEvent } from "react";
import { ArrowUpRight, Bookmark as BookmarkIcon, Globe, Plus } from "lucide-react";
import { browserUrl, type Bookmark, type BrowserStore } from "../bookmarks";

export function BrowserLibrary({
  store,
  openSettings,
}: {
  store: BrowserStore;
  openSettings: () => void;
}) {
  const { data, save, warning } = store;
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function edit(item?: Bookmark) {
    setEditing(item ?? null);
    setAdding(true);
    setTitle(item?.title ?? "");
    setUrl(item?.url ?? "");
    setError("");
    setMessage("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (!title.trim()) throw new Error("Give this bookmark a name.");
      if (!editing && data.bookmarks.length >= 100)
        throw new Error(
          "You can save up to 100 bookmarks. Remove one to add another.",
        );
      const item = {
        id: editing?.id ?? crypto.randomUUID(),
        title: title.trim(),
        url: browserUrl(url),
        pinned: editing?.pinned ?? false,
      };
      save({
        ...data,
        bookmarks: editing
          ? data.bookmarks.map((b) => (b.id === editing.id ? item : b))
          : [...data.bookmarks, item],
      });
      setAdding(false);
      setEditing(null);
      setMessage("Bookmark saved.");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  const empty = !data.bookmarks.length;
  return (
    <section className="lib-bookmarks" aria-labelledby="bookmarks-title">
      <h2 id="bookmarks-title" className="sr-only">
        Browser bookmarks
      </h2>
      <div className="lib-toolbar lib-launch">
        <Globe size={18} aria-hidden="true" />
        <div className="lib-launch-text">
          <strong>Launch page</strong>
          <span>{data.launchUrl || "Choose a starting page in Settings."}</span>
        </div>
        {data.launchUrl ? (
          <a
            className="k-btn"
            href={data.launchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open launch page <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <button className="k-btn" onClick={openSettings}>
            Set launch URL
          </button>
        )}
        {!empty && (
          <button
            className="k-btn k-btn--primary"
            onClick={() => edit()}
            disabled={adding || data.bookmarks.length >= 100}
          >
            <Plus size={16} aria-hidden="true" /> Add bookmark
          </button>
        )}
      </div>
      {warning && (
        <p role="alert" className="lib-alert">
          {warning}
        </p>
      )}
      {adding && (
        <form className="k-card lib-form" onSubmit={submit}>
          <h3>{editing ? "Edit bookmark" : "New bookmark"}</h3>
          <div className="lib-form-row">
            <label className="k-label">
              Name
              <input
                className="k-field"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label className="k-label lib-grow">
              Web address
              <input
                className="k-field"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                maxLength={2048}
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="lib-alert">
              {error}
            </p>
          )}
          <div className="lib-actions">
            <button className="k-btn k-btn--primary" type="submit">
              Save bookmark
            </button>
            <button
              className="k-btn k-btn--quiet"
              type="button"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="lib-note">
          {message}
        </p>
      )}
      {empty ? (
        !adding && (
          <div className="k-empty">
            <BookmarkIcon size={32} aria-hidden="true" />
            <h3>Keep your regular stops close</h3>
            <p>
              Save the websites you visit often and pin the best ones to Home.
              They open in a new tab when you are online.
            </p>
            <button className="k-btn k-btn--primary" onClick={() => edit()}>
              <Plus size={16} aria-hidden="true" /> Add bookmark
            </button>
          </div>
        )
      ) : (
        <>
          <ul className="bookmark-list">
            {data.bookmarks.map((item) => (
              <li key={item.id}>
                <BookmarkIcon size={18} aria-hidden="true" />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${item.title} in a new tab`}
                >
                  <strong>{item.title}</strong>
                  <span>{item.url}</span>
                </a>
                <div className="lib-actions">
                  <button
                    className="k-btn"
                    aria-label={`${item.pinned ? "Unpin" : "Pin"} ${item.title}`}
                    aria-pressed={item.pinned === true}
                    onClick={() =>
                      save({
                        ...data,
                        bookmarks: data.bookmarks.map((b) =>
                          b.id === item.id ? { ...b, pinned: !b.pinned } : b,
                        ),
                      })
                    }
                  >
                    {item.pinned ? "Unpin" : "Pin to Home"}
                  </button>
                  <button
                    className="k-btn k-btn--quiet"
                    aria-label={`Edit ${item.title}`}
                    onClick={() => edit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="k-btn k-btn--quiet"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => {
                      save({
                        ...data,
                        bookmarks: data.bookmarks.filter(
                          (b) => b.id !== item.id,
                        ),
                      });
                      if (editing?.id === item.id) {
                        setAdding(false);
                        setEditing(null);
                      }
                      setMessage(`Removed ${item.title}.`);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="lib-caption">
            Bookmarks open in a new tab and are saved in this browser only.
            Websites need an internet connection.
          </p>
        </>
      )}
    </section>
  );
}

export function BrowserSettings({ store }: { store: BrowserStore }) {
  const [url, setUrl] = useState(store.data.launchUrl);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const launchUrl = url.trim() ? browserUrl(url) : "";
      store.save({ ...store.data, launchUrl });
      setUrl(launchUrl);
      setError("");
      setMessage(launchUrl ? "Launch page saved." : "Launch page cleared.");
    } catch (cause) {
      setError((cause as Error).message);
      setMessage("");
    }
  }
  return (
    <section
      className="browser-panel browser-settings"
      aria-labelledby="browser-settings-title"
    >
      <span className="eyebrow">BROWSER LAUNCHER</span>
      <h2 id="browser-settings-title">Your starting page</h2>
      <p className="browser-help">
        Open this page from Library. It opens in a new tab only when you choose
        it.
      </p>
      <form className="lib-form" onSubmit={submit}>
        <label className="k-label">
          Default launch URL
          <input
            className="k-field"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setMessage("");
            }}
            placeholder="https://example.com"
            maxLength={2048}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <div className="lib-actions">
          <button className="k-btn k-btn--primary" type="submit">
            Save launch URL
          </button>
          <button
            className="k-btn k-btn--quiet"
            type="button"
            onClick={() => {
              store.save({ ...store.data, launchUrl: "" });
              setUrl("");
              setError("");
              setMessage("Launch page cleared.");
            }}
          >
            Clear launch URL
          </button>
        </div>
        {error && (
          <p role="alert" className="browser-warning">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="browser-help">
            {message}
          </p>
        )}
      </form>
      {store.warning && (
        <p role="alert" className="browser-warning">
          {store.warning}
        </p>
      )}
      <p className="browser-help">
        Bookmarks and the launch URL stay in this browser’s storage. They do not
        sync between the demo, local app, or other devices. Clearing site data
        removes them.
      </p>
    </section>
  );
}
