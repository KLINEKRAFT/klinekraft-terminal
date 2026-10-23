import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Battery,
  Compass,
  Cpu,
  Folder,
  Gamepad2,
  Library,
  Maximize2,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Radio,
  Settings2,
  Terminal,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { ToolsLauncher } from "./components/ToolsLauncher";
import { AwayPanel } from "./components/AwayPanel";
import { OutsideWeather } from "./components/OutsideWeather";
import { GamesPanel } from "./components/GamesPanel";
import { FilesPanel, WikiPanel } from "./components/LocalContent";
import { HomeTools, useQuickNote, greeting } from "./components/HomeTools";
import { useBrowserPreferences } from "./bookmarks";
import { BrowserLibrary, BrowserSettings } from "./components/BrowserLibrary";
import { KlinekraftBrandLockup, installBrandIcon } from "./components/Brand";
import {
  resolveCommand,
  sections,
  type Reading,
  type Section,
} from "./preview";

import { useTelemetry, amount, percent, networkSummary } from "./telemetry";
import {
  TelemetrySettings,
  SystemPanel,
  NetworkPanel,
} from "./components/TelemetryPanels";

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
    body: "Preview coordinates are a development fixture; live mode reports GPS unavailable. No USB receiver, gpsd connection or map region is installed.",
    items: [
      "Planned: fix quality, satellites and reported accuracy",
      "Local MapLibre maps with bundled styles and tiles",
      "Waypoints, track recording and GPX export",
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
  percent: number | null;
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
        role={percent === null ? undefined : "meter"}
        aria-label={label}
        aria-valuenow={percent ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${percent ?? 0}%` }} />
      </div>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}
function Home({
  reading,
  now,
  navigate,
  detail,
  browser,
  note,
}: {
  browser: ReturnType<typeof useBrowserPreferences>;
  note: ReturnType<typeof useQuickNote>;
  reading: Reading;
  detail: string;
  now: Date;
  navigate: (s: Section) => void;
}) {
  return (
    <>
      <section className="overview" aria-label="System overview">
        <div className="clock-panel">
          <span className="eyebrow">LOCAL TIME</span>
          <time className="time" dateTime={now.toISOString()}>
            {now
              .toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
              .replace(/\s*[AP]M$/, "")}
            <span>{now.getHours() < 12 ? "AM" : "PM"}</span>
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
            <span className="dot" /> {reading.system.toUpperCase()}{" "}
            <span> / {reading.source === "host" ? "HOST" : "PREVIEW"}</span>
          </div>
        </div>
        <div className="metrics">
          <Metric
            label="CPU LOAD"
            value={amount(reading.cpu, 0)}
            unit="%"
            percent={reading.cpu}
            detail={`${reading.cpuCores ?? "—"} cores · ${detail.toLowerCase()}`}
          />
          <Metric
            label="MEMORY"
            value={amount(reading.memoryUsed)}
            unit="GB"
            percent={percent(reading.memoryUsed, reading.memoryTotal)}
            detail={`of ${amount(reading.memoryTotal)} GB · ${detail.toLowerCase()}`}
          />
          <Metric
            label="STORAGE"
            value={amount(reading.storageUsed)}
            unit="GB"
            percent={percent(reading.storageUsed, reading.storageTotal)}
            detail={`of ${amount(reading.storageTotal)} GB · ${detail.toLowerCase()}`}
          />
        </div>
      </section>
      <div className="home-ambient">
        <OutsideWeather />
        <div className="home-actions">
          <ToolsLauncher />
          <AwayPanel />
        </div>
      </div>
      <section className="connections" aria-label="Device readings">
        <div>
          <Cpu size={17} />
          <span>
            <small>CPU TEMPERATURE</small>
            <strong>
              {reading.temperature === null
                ? "Unavailable"
                : `${amount((reading.temperature * 9) / 5 + 32)}°F`}{" "}
              <em>
                {reading.temperature === null ? "No sensor reading" : detail}
              </em>
            </strong>
          </span>
        </div>
        <div>
          <Battery size={19} />
          <span>
            <small>BATTERY · X1202</small>
            <strong>
              {reading.batteryPercent == null
                ? "Unavailable"
                : `${reading.batteryPercent.toFixed(0)}%`}
              <em>
                {reading.batteryVoltage == null
                  ? (reading.batteryStatus ?? "Not configured")
                  : `${reading.batteryVoltage.toFixed(2)} V · estimated · ${detail.toLowerCase()}`}
              </em>
            </strong>
          </span>
        </div>
        <div>
          <Wifi size={17} />
          <span>
            <small>NETWORK</small>
            <strong>
              {networkSummary(reading)}{" "}
              <em>
                {reading.interfaces === null ? "No interface data" : detail}
              </em>
            </strong>
          </span>
        </div>
        <div>
          <Radio size={17} />
          <span>
            <small>GPS POSITION</small>
            <strong>
              {reading.source === "simulated" ? "41.8781° N" : "Unavailable"}{" "}
              <em>
                {reading.source === "simulated"
                  ? "Simulated"
                  : "Not configured"}
              </em>
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
      <HomeTools
        browser={browser}
        note={note}
        openLibrary={() => navigate("Library")}
      />
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
function savedFlag(key: string, fallback = false) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}
export default function App() {
  const [collapsed, setCollapsed] = useState(() =>
    savedFlag("klinekraft.sidebarCollapsed"),
  );
  const [dark, setDark] = useState(() =>
    savedFlag(
      "klinekraft.darkMode",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    ),
  );
  const [appearanceWarning, setAppearanceWarning] = useState("");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("klinekraft.sidebarCollapsed", String(collapsed));
      localStorage.setItem("klinekraft.darkMode", String(dark));
      setAppearanceWarning("");
    } catch {
      setAppearanceWarning(
        "Appearance changes apply now but cannot be saved in this browser.",
      );
    }
  }, [collapsed, dark]);
  const browser = useBrowserPreferences();
  const note = useQuickNote();
  const [greetingChoice] = useState(() => Math.floor(Math.random() * 4));
  const [section, setSection] = useState<Section>("Home");
  const [now, setNow] = useState(new Date());
  const [paused, setPaused] = useState(false);
  const telemetry = useTelemetry(paused, now.getTime());
  const { reading, mode, setMode, label, detail } = telemetry;
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
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" inert={exitHelp}>
        <KlinekraftBrandLockup />
        <div className="sidebar-heading">
          <div className="sidebar-caption">PORTABLE COMPUTING / 01</div>
          <button
            className="sidebar-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="main-navigation"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={14} strokeWidth={1.5} />
            ) : (
              <ChevronLeft size={14} strokeWidth={1.5} />
            )}
          </button>
        </div>
        <nav id="main-navigation" aria-label="Main navigation">
          {sections.map((item, index) => {
            const Icon = icons[item];
            return (
              <button
                key={item}
                aria-label={collapsed ? item : undefined}
                title={collapsed ? item : undefined}
                aria-current={section === item ? "page" : undefined}
                onClick={() => navigate(item)}
              >
                <span className="nav-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon size={16} strokeWidth={1.6} />
                <span className="nav-label">{item}</span>
                {section === item && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <span className="dot" />{" "}
            {mode === "preview" ? "PREVIEW MODE" : "HOST TELEMETRY"}
          </div>
          <span>Local workspace · v0.2.0</span>
          <button
            aria-label="Return to desktop"
            title="Return to desktop"
            onClick={() => setExitHelp(true)}
          >
            <ArrowDownLeft size={16} />{" "}
            <span className="nav-label">Return to desktop</span>
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
            <h1>
              {section === "Home"
                ? greeting(now.getHours(), greetingChoice)
                : section}
            </h1>
            {section !== "Home" && <p>{descriptions[section]}</p>}
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Dark mode"
              aria-pressed={dark}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="preview-badge">
              <span /> {label}
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
          {appearanceWarning && (
            <p role="status" className="browser-warning">
              {appearanceWarning}
            </p>
          )}
          {section === "Home" ? (
            <Home
              reading={reading}
              now={now}
              navigate={navigate}
              detail={detail}
              browser={browser}
              note={note}
            />
          ) : section === "Games" ? (
            <GamesPanel />
          ) : section === "Library" ? (
            <>
              <WikiPanel />
              <BrowserLibrary
                store={browser}
                openSettings={() => navigate("Settings")}
              />
            </>
          ) : section === "Settings" ? (
            <>
              <section className="settings-panel" aria-label="Appearance">
                <h2>Appearance</h2>
                <label className="setting-row">
                  Dark mode
                  <input
                    type="checkbox"
                    checked={dark}
                    onChange={(e) => setDark(e.target.checked)}
                  />
                </label>
                <label className="setting-row">
                  Collapse sidebar
                  <input
                    type="checkbox"
                    checked={collapsed}
                    onChange={(e) => setCollapsed(e.target.checked)}
                  />
                </label>
              </section>
              <BrowserSettings store={browser} />
              <TelemetrySettings
                storageWarning={telemetry.storageWarning}
                mode={mode}
                setMode={setMode}
                paused={paused}
                setPaused={setPaused}
                label={label}
              />
            </>
          ) : section === "Files" ? (
            <FilesPanel />
          ) : section === "System" ? (
            <SystemPanel reading={reading} label={label} />
          ) : section === "Network" ? (
            <NetworkPanel reading={reading} label={label} />
          ) : (
            <Feature section={section} />
          )}
        </div>
        <footer className="command-area">
          {feedback && (
            <div
              className="command-feedback"
              role="status"
              aria-label="Command result"
            >
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
