import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Battery,
  Check,
  Compass,
  Cpu,
  Folder,
  Gamepad2,
  Library,
  Maximize2,
  MessageSquare,
  Radio,
  Settings2,
  Terminal,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { KlinekraftBrandLockup, installBrandIcon } from "./components/Brand";
import {
  initialReading,
  previewReading,
  resolveCommand,
  sections,
  type Reading,
  type Section,
} from "./preview";

const icons: Record<Section, LucideIcon> = {
  Home: Cpu,
  Games: Gamepad2,
  "AI assistant": MessageSquare,
  "GPS / Maps": Compass,
  Library,
  Files: Folder,
  Network: Wifi,
  System: Terminal,
  Settings: Settings2,
};
const descriptions: Record<Section, string> = {
  Home: "Your portable workspace, at a glance.",
  Games: "A place for the classics.",
  "AI assistant": "A second perspective, when you need it.",
  "GPS / Maps": "Find your bearings.",
  Library: "Knowledge, within reach.",
  Files: "Everything in its place.",
  Network: "Understand your connection.",
  System: "A closer look at your machine.",
  Settings: "Make yourself at home.",
};
const integrations: Record<
  string,
  { title: string; body: string; items: string[] }
> = {
  Games: {
    title: "Your next session starts here.",
    body: "RetroArch and a local SQLite game catalog will power this library. No games have been imported.",
    items: [
      "NES · SNES · Genesis · Game Boy",
      "Game Boy Advance · Arcade · PlayStation · N64",
      "Planned: search, favorites, artwork and recent games",
    ],
  },
  "AI assistant": {
    title: "Ready for a conversation. Once connected.",
    body: "OpenAI and Anthropic integration is planned. API keys stay on the backend; this preview sends no AI requests.",
    items: [
      "Planned: streamed responses and conversation history",
      "Approved local tools through a shared service layer",
      "Provider API billing is separate from chat subscriptions",
    ],
  },
  "GPS / Maps": {
    title: "A position, without a receiver.",
    body: "The home screen coordinates are a development fixture. No USB receiver, gpsd connection or map region is installed.",
    items: [
      "Planned: fix quality, satellites and reported accuracy",
      "Local MapLibre maps with bundled styles and tiles",
      "Waypoints, track recording and GPX export",
    ],
  },
  Library: {
    title: "A library that travels with you.",
    body: "Kiwix will serve locally installed ZIM archives. No Wikipedia archive is included in this foundation.",
    items: [
      "Planned: browse and search installed archives",
      "Archive size and free-space checks before import",
      "Offline articles served by kiwix-serve",
    ],
  },
  Files: {
    title: "Local files, thoughtfully organized.",
    body: "Filesystem access is not connected. This preview does not read or change files on your computer.",
    items: [
      "Planned: approved folders and project shortcuts",
      "Path validation and explicit approval for changes",
      "No unrestricted filesystem tools for AI",
    ],
  },
  Network: {
    title: "Connection details, made clear.",
    body: "The home screen network connection is simulated. No diagnostic commands have been run.",
    items: [
      "Planned: interface and connection status",
      "Explicit offline and disconnected states",
      "Approved diagnostics with bounded timeouts",
    ],
  },
};
function Metric({
  label,
  value,
  unit,
  detail,
  percent,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  percent: number;
}) {
  return (
    <article className="metric">
      <span className="eyebrow">{label}</span>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div
        className="meter"
        role="meter"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}
function Home({
  reading,
  now,
  navigate,
}: {
  reading: Reading;
  now: Date;
  navigate: (s: Section) => void;
}) {
  return (
    <>
      <section className="overview" aria-label="System overview">
        <div className="clock-panel">
          <span className="eyebrow">LOCAL TIME</span>
          <time className="time" dateTime={now.toISOString()}>
            {now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
            <span>{now.toLocaleTimeString([], { second: "2-digit" })}</span>
          </time>
          <span className="date">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <div className="device-label">
            <span className="dot" /> RASPBERRY PI 5 <span> / PREVIEW</span>
          </div>
        </div>
        <div className="metrics">
          <Metric
            label="CPU LOAD"
            value={String(reading.cpu)}
            unit="%"
            percent={reading.cpu}
            detail="4 cores · simulated"
          />
          <Metric
            label="MEMORY"
            value={reading.memoryUsed.toFixed(1)}
            unit="GB"
            percent={20}
            detail="of 8.0 GB · simulated"
          />
          <Metric
            label="STORAGE"
            value={reading.storageUsed.toFixed(1)}
            unit="GB"
            percent={32}
            detail="of 119.2 GB · simulated"
          />
        </div>
      </section>
      <section className="connections" aria-label="Preview device readings">
        <div>
          <Cpu size={17} />
          <span>
            <small>CPU TEMPERATURE</small>
            <strong>
              {reading.temperature.toFixed(1)}°C <em>Simulated</em>
            </strong>
          </span>
        </div>
        <div>
          <Battery size={19} />
          <span>
            <small>BATTERY · X1202</small>
            <strong>
              Unavailable <em>No hardware</em>
            </strong>
          </span>
        </div>
        <div>
          <Wifi size={17} />
          <span>
            <small>NETWORK</small>
            <strong>
              Wi-Fi <em>Simulated</em>
            </strong>
          </span>
        </div>
        <div>
          <Radio size={17} />
          <span>
            <small>GPS POSITION</small>
            <strong>
              41.8781° N <em>Simulated</em>
            </strong>
          </span>
        </div>
      </section>
      <section className="quick-section">
        <div className="section-heading">
          <h2>Pick up where you left off</h2>
          <span>QUICK ACCESS</span>
        </div>
        <div className="quick-grid">
          {(
            [
              {
                section: "Games",
                label: "Play something",
                detail: "Open game library",
                Icon: Gamepad2,
              },
              {
                section: "AI assistant",
                label: "Think it through",
                detail: "Explore the assistant",
                Icon: MessageSquare,
              },
              {
                section: "GPS / Maps",
                label: "Find your way",
                detail: "GPS & offline maps",
                Icon: Compass,
              },
              {
                section: "Library",
                label: "Look it up",
                detail: "Your offline references",
                Icon: Library,
              },
            ] as const
          ).map(({ section, label, detail, Icon }) => (
            <button
              className="quick-card"
              key={section}
              onClick={() => navigate(section)}
            >
              <div>
                <Icon size={22} strokeWidth={1.4} />
                <ArrowUpRight size={15} />
              </div>
              <strong>{label}</strong>
              <span>{detail}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="activity">
        <div className="section-heading">
          <h2>Session activity</h2>
          <span>THIS PREVIEW</span>
        </div>
        <div className="activity-row">
          <span className="activity-icon">
            <Check size={14} />
          </span>
          <span>
            Workspace opened{" "}
            <small>Development preview · hardware simulated</small>
          </span>
          <span className="mono">THIS SESSION</span>
        </div>
      </section>
    </>
  );
}
function Feature({ section }: { section: Section }) {
  const data = integrations[section];
  const Icon = icons[section];
  return (
    <section className="feature">
      <div className="feature-symbol">
        <Icon size={36} strokeWidth={1.2} />
      </div>
      <span className="eyebrow">PLANNED INTEGRATION</span>
      <h2>{data.title}</h2>
      <p>{data.body}</p>
      <ul>
        {data.items.map((item) => (
          <li key={item}>
            <ArrowRight size={14} />
            {item}
          </li>
        ))}
      </ul>
      <div className="feature-note">
        This section is a foundation screen. Integration is not implemented.
      </div>
    </section>
  );
}
export default function App() {
  const [section, setSection] = useState<Section>("Home");
  const [now, setNow] = useState(new Date());
  const [reading, setReading] = useState(initialReading);
  const [paused, setPaused] = useState(false);
  const [command, setCommand] = useState("");
  const [feedback, setFeedback] = useState("");
  const [exitHelp, setExitHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    installBrandIcon();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (paused) return;
    let tick = 0;
    const timer = setInterval(() => setReading(previewReading(++tick)), 3000);
    return () => clearInterval(timer);
  }, [paused]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setExitHelp(false);
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const navigate = (next: Section) => {
    setSection(next);
    setFeedback("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;
    const result = resolveCommand(command);
    if (result.section) setSection(result.section);
    setFeedback(result.message);
    setCommand("");
  };
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFeedback(
        "Fullscreen is unavailable in this browser. Use the browser’s fullscreen control.",
      );
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={exitHelp}>
        <KlinekraftBrandLockup />
        <div className="sidebar-caption">PORTABLE COMPUTING / 01</div>
        <nav aria-label="Main navigation">
          {sections.map((item, index) => {
            const Icon = icons[item];
            return (
              <button
                key={item}
                aria-current={section === item ? "page" : undefined}
                onClick={() => navigate(item)}
              >
                <span className="nav-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon size={16} strokeWidth={1.6} />
                <span>{item}</span>
                {section === item && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <span className="dot" /> DEVELOPMENT MODE
          </div>
          <span>Local workspace · v0.1.0</span>
          <button onClick={() => setExitHelp(true)}>
            <ArrowDownLeft size={16} /> Return to desktop
          </button>
        </div>
      </aside>
      <main inert={exitHelp}>
        <header className="page-header">
          <div>
            <div className="eyebrow">
              KLINEKRAFT TERMINAL{" "}
              <span>
                / {String(sections.indexOf(section) + 1).padStart(2, "0")}
              </span>
            </div>
            <h1>{section === "Home" ? "At your service." : section}</h1>
            <p>{descriptions[section]}</p>
          </div>
          <div className="header-actions">
            <span className="preview-badge">
              <span /> SIMULATED DATA
            </span>
            <button
              className="icon-button"
              aria-label="Toggle fullscreen"
              onClick={fullscreen}
            >
              <Maximize2 size={17} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {section === "Home" ? (
            <Home reading={reading} now={now} navigate={navigate} />
          ) : section === "Settings" ? (
            <section className="settings-panel">
              <h2>Preview preferences</h2>
              <p>
                All hardware values are simulated. The clock uses your
                computer’s local time.
              </p>
              <label className="setting-row">
                <span>
                  <strong>Automatic preview updates</strong>
                  <small>
                    Refresh simulated CPU and temperature every 3 seconds.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={!paused}
                  onChange={(e) => setPaused(!e.target.checked)}
                />
              </label>
              <div className="setting-row">
                <span>
                  <strong>Official brand asset</strong>
                  <small>
                    Import the original PNG with the documented brand command.
                  </small>
                </span>
              </div>
              <div className="feature-note">
                Hardware setup, credentials and persistent preferences are
                planned.
              </div>
            </section>
          ) : section === "System" ? (
            <section className="settings-panel">
              <h2>
                System overview <span className="inline-badge">SIMULATED</span>
              </h2>
              <dl className="system-list">
                {[
                  ["Target device", "Raspberry Pi 5 · ARM64"],
                  ["Target operating system", "Raspberry Pi OS 64-bit Desktop"],
                  ["CPU load", `${reading.cpu}%`],
                  [
                    "Memory",
                    `${reading.memoryUsed} / ${reading.memoryTotal} GB`,
                  ],
                  [
                    "Storage",
                    `${reading.storageUsed} / ${reading.storageTotal} GB`,
                  ],
                  ["CPU temperature", `${reading.temperature}°C`],
                  ["X1202 battery", "Unavailable · hardware not connected"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="feature-note">
                <Terminal size={16} /> A genuine Linux terminal is planned. The
                command bar only navigates approved screens.
              </div>
            </section>
          ) : (
            <Feature section={section} />
          )}
        </div>
        <footer className="command-area">
          {feedback && (
            <div className="command-feedback" role="status">
              <span>{feedback}</span>
              <button
                aria-label="Dismiss command result"
                onClick={() => setFeedback("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <Terminal size={18} />
            <label className="sr-only" htmlFor="command">
              Workspace command
            </label>
            <input
              ref={input}
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Where would you like to go? Try ‘games’ or ‘system status’"
              autoComplete="off"
              maxLength={240}
            />
            <kbd>⌘ / Ctrl K</kbd>
            <button aria-label="Run workspace command" type="submit">
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="footer-caption">
            <span>DESIGNED TO GO WITH YOU.</span>
            <span>
              LOCAL-FIRST <span className="tiny-divider">/</span> FOUNDATION
              PREVIEW
            </span>
          </div>
        </footer>
      </main>
      {exitHelp && (
        <div className="modal-backdrop" onClick={() => setExitHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            className="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">YOUR DESKTOP IS ALWAYS THERE</span>
            <h2 id="exit-title">Return to your desktop</h2>
            <p>
              Press Esc to leave browser fullscreen, then close this tab or
              window. On Raspberry Pi, Alt + F4 closes Chromium and returns to
              the desktop.
            </p>
            <p>This preview cannot close a browser window it did not open.</p>
            <button
              autoFocus
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                setExitHelp(false);
              }}
            >
              Understood <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
