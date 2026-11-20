import { DetailsPanel } from "./DetailsPanel";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Bell, X, Settings2 } from "lucide-react";
import { localJSON } from "./WikiReader";
import { isHostedDemo } from "../runtime";
import { WeatherOverview } from "./WeatherOverview";
const WeatherRadar = lazy(() => import("./WeatherRadar"));

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
export function Briefing({ page = false }: { page?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [draft, setDraft] = useState<Settings | null>(null),
    [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(page ? "Weather" : "Events");
  const [filter, setFilter] = useState("All"),
    [unreadOnly, setUnreadOnly] = useState(false);
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
    window.addEventListener("briefing-updated", load);
    return () => {
      active = false;
      request.abort();
      clearInterval(timer);
      window.removeEventListener("briefing-updated", load);
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
      window.dispatchEvent(new window.Event("briefing-updated"));
      setData((v) =>
        v ? { ...v, acknowledged: [...(v.acknowledged || []), id] } : v,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    if (!draft) return;
    if (
      (
        [
          "latitude",
          "longitude",
          "radiusMiles",
          "magnitude",
          "globalMagnitude",
        ] as const
      ).some((key) => !Number.isFinite(draft[key]))
    ) {
      setError("Enter a number in every location and magnitude field.");
      return;
    }
    setSaving(true);
    try {
      await localJSON("/api/briefing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setData(await localJSON("/api/briefing"));
      setDraft(null);
      window.dispatchEvent(new window.Event("briefing-updated"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const Container = page ? "section" : "dialog";
  return (
    <>
      {!page && (
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
      )}
      {!page && item && data?.settings.ticker && (
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
      <Container
        ref={page ? undefined : dialog}
        className={page ? "briefing-dialog briefing-page" : "briefing-dialog"}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        {!page && (
          <header>
            <h2>Events & science</h2>
            {!page && (
              <button aria-label="Close events" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            )}
          </header>
        )}
        <nav className="briefing-tabs" aria-label="Field Briefing views">
          {["Weather", "Radar", "Events", "Science"].map((name) => (
            <button
              key={name}
              aria-pressed={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
              {name === "Events" && active.length > 0 && (
                <small>{active.length}</small>
              )}
            </button>
          ))}
          <button
            className="briefing-settings-button"
            aria-label="Briefing settings"
            aria-pressed={tab === "Settings"}
            onClick={() => {
              setTab("Settings");
              if (data) setDraft(data.settings);
            }}
          >
            <Settings2 size={17} />
          </button>
        </nav>
        <div
          className={
            tab === "Radar" ? "briefing-body radar-body" : "briefing-body"
          }
        >
          {error && (
            <p className="briefing-warning" role="status">
              {error}. Showing saved readings.
            </p>
          )}
          {!data && (
            <p role="status">
              {isHostedDemo
                ? "Live weather and local feeds are available on the installed deck."
                : "Loading saved readings…"}
            </p>
          )}
          {data && (
            <>
              {!data.settings.enabled && (
                <p className="briefing-warning">
                  Feed updates paused in settings. These are saved readings.
                </p>
              )}
              {tab === "Weather" && (
                <>
                  {data.events
                    .filter(
                      (e) =>
                        !e.stale &&
                        e.kind === "Weather" &&
                        (e.severity === "Severe" || e.severity === "Extreme"),
                    )
                    .slice(0, 1)
                    .map((e) => (
                      <button
                        className="weather-alert"
                        key={e.id}
                        onClick={() => {
                          setTab("Events");
                          setFilter("Weather");
                        }}
                      >
                        <span>{e.severity} weather</span>
                        {e.title} ↗
                      </button>
                    ))}
                  <WeatherOverview
                    feed={{
                      ...data.feeds.forecast,
                      stale: !!error || data.feeds.forecast?.stale,
                    }}
                    location={data.settings.location}
                    onRadar={() => setTab("Radar")}
                  />
                </>
              )}
              {tab === "Radar" && (page || open) && (
                <Suspense fallback={<p>Loading radar map…</p>}>
                  <WeatherRadar
                    latitude={data.settings.latitude}
                    longitude={data.settings.longitude}
                    location={data.settings.location}
                    zone={data.feeds.forecast?.data?.timezone}
                  />
                </Suspense>
              )}
              {tab === "Events" && (
                <section className="briefing-events" aria-label="Event reports">
                  <div className="event-filters">
                    {["All", "Weather", "Earthquake", "Space weather"].map(
                      (kind) => (
                        <button
                          key={kind}
                          aria-pressed={filter === kind}
                          onClick={() => setFilter(kind)}
                        >
                          {kind === "Earthquake" ? "Quakes" : kind}
                        </button>
                      ),
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={(e) => setUnreadOnly(e.target.checked)}
                      />
                      Unread only
                    </label>
                  </div>
                  <p className="briefing-caption">
                    {data.settings.location} · nearby quakes within{" "}
                    {data.settings.radiusMiles} mi, M{data.settings.magnitude}+
                    · worldwide M{data.settings.globalMagnitude}+
                  </p>
                  {["weather", "earthquakes", "space"].some(
                    (name) => !data.feeds[name] || data.feeds[name].stale,
                  ) && (
                    <p className="briefing-warning">
                      Some sources are unavailable or out of date. Coverage is
                      incomplete.
                    </p>
                  )}
                  {!data.events.filter(
                    (e) =>
                      (filter === "All" || e.kind === filter) &&
                      (!unreadOnly || !data.acknowledged?.includes(e.id)),
                  ).length && (
                    <p className="event-empty">No reports match this view.</p>
                  )}
                  {data.events
                    .filter(
                      (e) =>
                        (filter === "All" || e.kind === filter) &&
                        (!unreadOnly || !data.acknowledged?.includes(e.id)),
                    )
                    .map((e) => (
                      <article
                        className="event-report"
                        data-severity={e.severity}
                        data-read={data.acknowledged?.includes(e.id)}
                        key={e.id}
                      >
                        <div className="event-meta">
                          <span>{e.kind}</span>
                          <span>
                            {e.stale ? "LAST KNOWN" : e.severity} ·{" "}
                            {new Date(e.issued * 1000).toLocaleString()}
                          </span>
                        </div>
                        <h3>{e.title}</h3>
                        <div className="event-actions">
                          <DetailsPanel title="Read report">
                            <p className="event-text">{e.text}</p>
                            <SourceLink url={e.url}>{e.source} ↗</SourceLink>
                          </DetailsPanel>
                          <button
                            disabled={data.acknowledged?.includes(e.id)}
                            onClick={() => void acknowledge(e.id)}
                          >
                            {data.acknowledged?.includes(e.id)
                              ? "Acknowledged"
                              : "Acknowledge"}
                          </button>
                        </div>
                      </article>
                    ))}
                </section>
              )}
              {tab === "Science" && (
                <div className="briefing-science">
                  {" "}
                  <DetailsPanel title="NASA · Earth events">
                    <FeedAge feed={data.feeds.earthEvents} />
                    {data.feeds.earthEvents?.data?.map((v: any) => (
                      <p key={v.id}>
                        <SourceLink url={v.sources?.[0]?.url}>
                          {v.title}
                        </SourceLink>
                      </p>
                    ))}
                  </DetailsPanel>
                  <DetailsPanel title="NASA · Asteroid approaches">
                    <FeedAge feed={data.feeds.asteroids} />
                    {Object.values(data.feeds.asteroids?.data || {})
                      .flat()
                      .map((v: any) => (
                        <p key={v.id}>
                          <SourceLink url={v.nasa_jpl_url}>{v.name}</SourceLink>{" "}
                          · {v.close_approach_data?.[0]?.close_approach_date} ·{" "}
                          {Math.round(
                            Number(
                              v.close_approach_data?.[0]?.miss_distance?.miles,
                            ),
                          ).toLocaleString()}{" "}
                          miles away
                        </p>
                      ))}
                    <p className="briefing-caption">
                      Astronomy information, not impact warnings.
                    </p>
                  </DetailsPanel>
                  <DetailsPanel title="NASA · Astronomy">
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
                        exhausted; an optional free NASA_API_KEY raises the
                        allowance.
                      </p>
                    )}
                  </DetailsPanel>
                </div>
              )}
              {tab === "Settings" && (
                <div className="briefing-preferences">
                  <h2>Location & alerts</h2>
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
                            required
                            value={
                              Number.isFinite(draft[key]) ? draft[key] : ""
                            }
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                // An emptied field must not silently become 0
                                // (latitude 0, longitude 0 is the Atlantic).
                                [key]:
                                  e.target.value.trim() === ""
                                    ? Number.NaN
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            location: "Tulsa, Oklahoma",
                            latitude: 36.154,
                            longitude: -95.993,
                          })
                        }
                      >
                        Use Tulsa
                      </button>
                      <button disabled={saving}>Save settings</button>
                    </form>
                  )}
                  <DetailsPanel title="Source status">
                    {Object.entries(data.feeds).map(([name, f]) => (
                      <p key={name}>
                        {name}:{" "}
                        {f.stale ? "Unavailable / last known" : "Updated"} ·{" "}
                        {f.updated
                          ? new Date(f.updated * 1000).toLocaleString()
                          : "No saved data"}
                      </p>
                    ))}
                  </DetailsPanel>
                  <DetailsPanel title="About these feeds">
                    <p>
                      Saved readings remain available offline. Internet is
                      needed for new forecasts, alerts and radar. This is not a
                      guaranteed emergency notification service. GPS does not
                      change your weather location automatically.
                    </p>
                  </DetailsPanel>
                </div>
              )}
            </>
          )}
        </div>
      </Container>
    </>
  );
}
