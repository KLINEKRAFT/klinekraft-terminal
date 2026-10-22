import { useState, type FormEvent } from "react";
import { ArrowUpRight, Bookmark as BookmarkIcon, Plus } from "lucide-react";
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
  return (
    <section className="browser-panel" aria-labelledby="bookmarks-title">
      <div className="browser-heading">
        <div>
          <span className="eyebrow">YOUR WEB SHORTCUTS</span>
          <h2 id="bookmarks-title">Browser bookmarks</h2>
        </div>
        <button
          className="browser-button"
          onClick={() => edit()}
          disabled={adding || data.bookmarks.length >= 100}
        >
          <Plus size={15} /> Add bookmark
        </button>
      </div>
      <div className="browser-launch">
        <div>
          <strong>Default launch page</strong>
          <span>{data.launchUrl || "Choose a starting page in Settings."}</span>
        </div>
        {data.launchUrl ? (
          <a
            className="browser-button"
            href={data.launchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open launch page <ArrowUpRight size={15} />
          </a>
        ) : (
          <button className="browser-button" onClick={openSettings}>
            Set launch URL
          </button>
        )}
      </div>
      <p className="browser-help">
        Opens in a new browser tab. Saved on this browser only; websites may
        need internet access.
      </p>
      {warning && (
        <p role="alert" className="browser-warning">
          {warning}
        </p>
      )}
      {adding && (
        <form className="bookmark-form" onSubmit={submit}>
          <h3>{editing ? "Edit bookmark" : "New bookmark"}</h3>
          <label>
            Name
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
            />
          </label>
          <label>
            Web address
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              maxLength={2048}
              required
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          {error && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          <div className="browser-actions">
            <button className="browser-button primary" type="submit">
              Save bookmark
            </button>
            <button
              className="browser-button"
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
        <p role="status" className="browser-help">
          {message}
        </p>
      )}
      {data.bookmarks.length ? (
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
              <div className="browser-actions">
                <button
                  className="browser-button"
                  aria-label={`Edit ${item.title}`}
                  onClick={() => edit(item)}
                >
                  Edit
                </button>
                <button
                  className="browser-button"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => {
                    save({
                      ...data,
                      bookmarks: data.bookmarks.filter((b) => b.id !== item.id),
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
      ) : (
        !adding && (
          <div className="bookmark-empty">
            <BookmarkIcon size={26} />
            <h3>A place for your regular stops.</h3>
            <p>Add your first bookmark to keep a useful website close by.</p>
          </div>
        )
      )}
      <details className="archive-plan">
        <summary>Offline archives · planned</summary>
        <p>
          Kiwix will serve locally installed ZIM archives. No archive is
          installed, and offline article search is not connected.
        </p>
      </details>
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
      <form className="bookmark-form" onSubmit={submit}>
        <label>
          Default launch URL
          <input
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
        <div className="browser-actions">
          <button className="browser-button primary" type="submit">
            Save launch URL
          </button>
          <button
            className="browser-button"
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
