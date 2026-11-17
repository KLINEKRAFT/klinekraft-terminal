import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
export function safeLink(value?: string) {
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}
export function SourceLink({
  url,
  children,
}: {
  url?: string;
  children: React.ReactNode;
}) {
  const href = safeLink(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
type Event = {
  id: string;
  title: string;
  kind: string;
  severity: string;
  text: string;
  issued: number;
  stale: boolean;
  url: string;
  source: string;
};
type Settings = {
  enabled: boolean;
  ticker: boolean;
  location: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  magnitude: number;
  globalMagnitude: number;
};
type Snapshot = {
  settings: Settings;
  events: Event[];
  acknowledged: string[];
  feeds: Record<
    string,
    { stale: boolean; updated?: number; error?: string; data?: any }
  >;
};
function FeedAge({ feed }: { feed?: { stale: boolean; updated?: number } }) {
  return (
    <p className="briefing-caption">
      {feed?.stale ? "LAST KNOWN / UNAVAILABLE" : "Saved snapshot"} ·{" "}
      {feed?.updated
        ? new Date(feed.updated * 1000).toLocaleString()
        : "No data saved"}
    </p>
  );
}
export function Briefing() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [draft, setDraft] = useState<Settings | null>(null),
    [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isHostedDemo) return;
    let active = true;
    const request = new AbortController();
    async function load() {
      try {
        const value = await localJSON("/api/briefing", {
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
        });
        if (active) {
          setData(value);
          setError("");
        }
      } catch {
        if (active) setError("Live feeds unavailable");
      }
    }
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      request.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((v) => v + 1), 10000);
    return () => clearInterval(timer);
  }, [paused]);
  const active =
    !error && data?.settings.enabled
      ? data.events.filter(
          (e) => !e.stale && !data.acknowledged?.includes(e.id),
        )
      : [];
  const urgent = active.filter(
    (e) => e.severity === "Extreme" || e.severity === "Severe",
  );
  const rotation = urgent.length ? urgent : active;
  const item = rotation[index % Math.max(rotation.length, 1)];
  async function acknowledge(id: string) {
    try {
      await localJSON("/api/briefing/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setData((v) =>
        v ? { ...v, acknowledged: [...(v.acknowledged || []), id] } : v,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await localJSON("/api/briefing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setData(await localJSON("/api/briefing"));
      setDraft(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        className="icon-button alert-bell"
        aria-label={`Events and science${active.length ? `: ${active.length} unread` : ""}`}
        title={error || "Events & science"}
        onClick={() => setOpen(true)}
      >
        <Bell size={17} />
        {active.length > 0 && <small>{active.length}</small>}
        {error && <small>!</small>}
      </button>
      {item && data?.settings.ticker && (
        <div className="event-ticker" data-severity={item.severity}>
          <button onClick={() => setOpen(true)}>
            <span>{item.kind}</span> {item.title}
          </button>
          <button
            aria-label={paused ? "Resume event ticker" : "Pause event ticker"}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
          <button
            aria-label="Acknowledge ticker event"
            onClick={() => void acknowledge(item.id)}
          >
            ×
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="briefing-dialog"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2>Events & science</h2>
          <button aria-label="Close events" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </header>
        <p className="briefing-caption">
          {data?.settings.location} · Last saved readings remain available
          offline. Internet is required for new alerts; this is not an emergency
          notification service.
        </p>
        {error && <p role="status">{error}</p>}
        {data && (
          <>
            <details>
              <summary onClick={() => setDraft((v) => v || data.settings)}>
                Alert settings
              </summary>
              {draft && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                  className="briefing-settings"
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) =>
                        setDraft({ ...draft, enabled: e.target.checked })
                      }
                    />
                    Fetch live feeds
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.ticker}
                      onChange={(e) =>
                        setDraft({ ...draft, ticker: e.target.checked })
                      }
                    />
                    Event ticker
                  </label>
                  <label>
                    Location name
                    <input
                      value={draft.location}
                      onChange={(e) =>
                        setDraft({ ...draft, location: e.target.value })
                      }
                    />
                  </label>
                  {(
                    [
                      "latitude",
                      "longitude",
                      "radiusMiles",
                      "magnitude",
                      "globalMagnitude",
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      {
                        {
                          latitude: "Latitude",
                          longitude: "Longitude",
                          radiusMiles: "Nearby radius (miles)",
                          magnitude: "Nearby minimum magnitude",
                          globalMagnitude: "Worldwide minimum magnitude",
                        }[key]
                      }
                      <input
                        type="number"
                        step={key === "radiusMiles" ? "1" : "any"}
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <button disabled={saving}>Save settings</button>
                </form>
              )}
            </details>
            <details>
              <summary>Source status</summary>
              {Object.entries(data.feeds).map(([name, f]) => (
                <p key={name}>
                  {name}: {f.stale ? "Unavailable / last known" : "Updated"} ·{" "}
                  {f.updated
                    ? new Date(f.updated * 1000).toLocaleString()
                    : "No saved data"}
                  {f.error ? " · connection failed" : ""}
                </p>
              ))}
            </details>
            <section aria-label="Event reports">
              {!data.events.length && (
                <p>
                  {Object.values(data.feeds)
                    .slice(0, 3)
                    .some((f) => f.stale)
                    ? "Event coverage incomplete. Check source status."
                    : "No matching events in the latest feeds."}
                </p>
              )}
              {data.events.map((e) => (
                <article className="event-report" key={e.id}>
                  <div>
                    <small>
                      {e.kind} · {e.stale ? "LAST KNOWN · " : ""}
                      {new Date(e.issued * 1000).toLocaleString()}
                    </small>
                    <h3>{e.title}</h3>
                  </div>
                  <details>
                    <summary>Details</summary>
                    <p className="event-text">{e.text}</p>
                    <SourceLink url={e.url}>{e.source}</SourceLink>
                  </details>
                  <button
                    disabled={data.acknowledged?.includes(e.id)}
                    onClick={() => void acknowledge(e.id)}
                  >
                    {data.acknowledged?.includes(e.id)
                      ? "Acknowledged"
                      : "Acknowledge"}
                  </button>
                </article>
              ))}
            </section>
            <details>
              <summary>7-day weather · Open-Meteo</summary>
              <FeedAge feed={data.feeds.forecast} />
              {data.feeds.forecast?.data?.daily?.time?.map(
                (day: string, i: number) => (
                  <p key={day}>
                    {day} ·{" "}
                    {data.feeds.forecast.data.daily.temperature_2m_min[i]}–
                    {data.feeds.forecast.data.daily.temperature_2m_max[i]}°F ·
                    Rain{" "}
                    {
                      data.feeds.forecast.data.daily
                        .precipitation_probability_max[i]
                    }
                    %
                  </p>
                ),
              )}
              <SourceLink url="https://open-meteo.com/">
                Open-Meteo · CC BY 4.0
              </SourceLink>
            </details>
            <details>
              <summary>NASA · Earth events</summary>
              <FeedAge feed={data.feeds.earthEvents} />
              {data.feeds.earthEvents?.data?.map((v: any) => (
                <p key={v.id}>
                  <SourceLink url={v.sources?.[0]?.url}>{v.title}</SourceLink>
                </p>
              ))}
            </details>
            <details>
              <summary>NASA · Asteroid approaches</summary>
              <FeedAge feed={data.feeds.asteroids} />
              {Object.values(data.feeds.asteroids?.data || {})
                .flat()
                .map((v: any) => (
                  <p key={v.id}>
                    <SourceLink url={v.nasa_jpl_url}>{v.name}</SourceLink> ·{" "}
                    {v.close_approach_data?.[0]?.close_approach_date} ·{" "}
                    {Math.round(
                      Number(v.close_approach_data?.[0]?.miss_distance?.miles),
                    ).toLocaleString()}{" "}
                    miles away
                  </p>
                ))}
              <p className="briefing-caption">
                Astronomy information, not impact warnings.
              </p>
            </details>
            <details>
              <summary>NASA · Astronomy</summary>
              <FeedAge feed={data.feeds.astronomy} />
              {data.feeds.astronomy?.data ? (
                <>
                  <h3>{data.feeds.astronomy.data.title}</h3>
                  <p>{data.feeds.astronomy.data.explanation}</p>
                  <SourceLink url={data.feeds.astronomy.data.url}>
                    Open astronomy image / video
                  </SourceLink>
                </>
              ) : (
                <p>
                  Not available yet. NASA's shared demo allowance may be
                  exhausted; an optional free NASA_API_KEY raises the allowance.
                </p>
              )}
            </details>
          </>
        )}
      </dialog>
    </>
  );
}
