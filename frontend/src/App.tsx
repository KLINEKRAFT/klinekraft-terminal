import { SpeechSettings } from "./components/SpeechControls";
import { useCardDismissal } from "./hooks/useCardDismissal";
import { BriefMe } from "./components/BriefMe";
import { RadioPlayer } from "./components/RadioPlayer";
import { VolumeControl } from "./components/VolumeControl";
import { GpsStatus } from "./components/GpsStatus";
import { DetailsPanel } from "./components/DetailsPanel";
import {
  UniversalSearch,
  type SearchResult,
} from "./components/UniversalSearch";
import {
  DocumentReader,
  type DocumentSource,
} from "./components/DocumentReader";
import type { MapLocation } from "./components/MapCollections";
import { Briefing } from "./components/Briefing";
import { ScienceSearch } from "./components/ScienceSearch";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import {
  Search,
  Paintbrush,
  Shield,
  StickyNote,
  CalendarDays,
  Calculator as CalculatorIcon,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Compass,
  Cpu,
  Folder,
  Gamepad2,
  House,
  Library,
  Maximize2,
  Menu,
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
import {
  Sparkline,
  ResourceGraphs,
  ProcessList,
  rate,
} from "./components/ResourceGraphs";
import type { HistoryPoint } from "./telemetry";
import { ToolsLauncher } from "./components/ToolsLauncher";
import { AwayPanel, AwayLaunch } from "./components/AwayPanel";
import { OutsideWeather } from "./components/OutsideWeather";
import { GamesPanel } from "./components/GamesPanel";
import { ResearchLibrary } from "./components/ResearchLibrary";
import { PowerControls } from "./components/PowerControls";
import { ScreenCast } from "./components/ScreenCast";
import { FieldConnections } from "./components/FieldConnections";
import { EmergencyDashboard } from "./components/EmergencyDashboard";
import { Paint } from "./components/Paint";
import { Organizer } from "./components/Organizer";
import { Calculator } from "./components/Calculator";
import { Notebook } from "./components/Notebook";
import { AssistantPanel } from "./components/AssistantPanel";
import {
  WikiBrowser,
  ArticleDialog,
  type WikiReference,
} from "./components/WikiReader";
import { FilesPanel } from "./components/LocalContent";
import { HomeTools, useQuickNote } from "./components/HomeTools";
import { useBrowserPreferences } from "./bookmarks";
import { BrowserLibrary, BrowserSettings } from "./components/BrowserLibrary";
import { KlinekraftBrandLockup, installBrandIcon } from "./components/Brand";
import {
  sectionLabel,
  navigationSections,
  homeSections,
  type Reading,
  type Section,
} from "./preview";

import { useTelemetry, amount, percent, networkSummary } from "./telemetry";
import {
  TelemetrySettings,
  SystemPanel,
  NetworkPanel,
} from "./components/TelemetryPanels";

const OfflineMaps = lazy(() => import("./components/OfflineMaps"));
const icons: Record<Section, LucideIcon> = {
  Home: Cpu,
  Emergency: Shield,
  Paint: Paintbrush,
  Notes: StickyNote,
  Calendar: CalendarDays,
  Calculator: CalculatorIcon,
  Games: Gamepad2,
  "AI assistant": MessageSquare,
  "GPS / Maps": Compass,
  "Field Briefing": Radio,
  Library,
  Files: Folder,
  Network: Wifi,
  System: Terminal,
  Settings: Settings2,
};
const libraryViews = [
  "Documents",
  "Research",
  "Wikipedia",
  "Notebook",
  "Bookmarks",
] as const;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const searchShortcut = isMac ? "⌘K" : "Ctrl K";

// The only component that ticks every second. Keeping the clock local stops
// the whole application from re-rendering once a second on the Pi.
function LocalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <time className="deck-value deck-value--hero" dateTime={now.toISOString()}>
        {now
          .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .replace(/\s*[AP]M$/, "")}
        <span>{now.getHours() < 12 ? "AM" : "PM"}</span>
      </time>
      <span className="deck-detail">
        {now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </span>
    </>
  );
}
/** A large at-a-glance figure: label, value, and one line of context. */
function Readout({
  label,
  value,
  detail,
  missing = false,
}: {
  label: string;
  value: string;
  detail: string;
  missing?: boolean;
}) {
  return (
    <article className="deck-readout">
      <span className="k-eyebrow">{label}</span>
      <strong className="deck-value" data-missing={missing || undefined}>
        {value}
      </strong>
      <span className="deck-detail">{detail}</span>
    </article>
  );
}
/** One resource, shown once: a number plus a meter. */
function Gauge({
  label,
  used,
  total,
}: {
  label: string;
  used: number | null;
  total: number | null;
}) {
  const share = percent(used, total);
  return (
    <div className="deck-resource">
      <span className="k-eyebrow">{label}</span>
      <strong>
        {amount(used)}
        <small> / {amount(total)} GB</small>
      </strong>
      <div
        className="deck-meter"
        role={share === null ? undefined : "meter"}
        aria-label={label}
        aria-valuenow={share ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${share ?? 0}%` }} />
      </div>
    </div>
  );
}
function Home({
  history,
  reading,
  navigate,
  detail,
  browser,
  note,
  openBookmarks,
  openGps,
}: {
  openGps: (latitude: number, longitude: number) => void;
  openBookmarks: () => void;
  history: HistoryPoint[];
  browser: ReturnType<typeof useBrowserPreferences>;
  note: ReturnType<typeof useQuickNote>;
  reading: Reading;
  detail: string;
  navigate: (s: Section) => void;
}) {
  const measured = detail.toLowerCase();
  const rates =
    reading.networkDownload == null && reading.networkUpload == null
      ? null
      : `↓ ${rate(reading.networkDownload)} · ↑ ${rate(reading.networkUpload)}`;
  return (
    <div className="deck-home">
      <section className="deck-readouts" aria-label="Device status">
        <article className="deck-readout deck-readout--time">
          <span className="k-eyebrow">Local time</span>
          <LocalClock />
        </article>
        <Readout
          label="Battery"
          missing={reading.batteryPercent == null}
          value={
            reading.batteryPercent == null
              ? "Not configured"
              : `${reading.batteryPercent.toFixed(0)}%`
          }
          detail={
            reading.batteryVoltage == null
              ? reading.batteryPercent == null
                ? "No battery monitor reading"
                : (reading.batteryStatus ?? measured)
              : `${reading.batteryVoltage.toFixed(2)} V · estimated · ${measured}`
          }
        />
        <Readout
          label="CPU temperature"
          missing={reading.temperature === null}
          value={
            reading.temperature === null
              ? "Unavailable"
              : `${amount((reading.temperature * 9) / 5 + 32, 0)}°F`
          }
          detail={reading.temperature === null ? "No sensor reading" : detail}
        />
        <Readout
          label="Connectivity"
          missing={reading.interfaces === null}
          value={networkSummary(reading)}
          detail={
            rates ?? (reading.interfaces === null ? "No interface data" : detail)
          }
        />
      </section>
      <section className="deck-resources" aria-label="Resources">
        <span className="device-label">
          {reading.system}
          <small>{detail}</small>
        </span>
        <div className="deck-resource">
          <span className="k-eyebrow">CPU</span>
          <strong>
            {reading.cpu === null ? "—" : `${amount(reading.cpu, 0)}%`}
            {reading.cpuCores != null && (
              <small> · {reading.cpuCores} cores</small>
            )}
          </strong>
          <Sparkline history={history} field="cpu" label="CPU load" />
        </div>
        <Gauge
          label="Memory"
          used={reading.memoryUsed}
          total={reading.memoryTotal}
        />
        <Gauge
          label="Storage"
          used={reading.storageUsed}
          total={reading.storageTotal}
        />
      </section>
      <div className="deck-row">
        <OutsideWeather />
        <div className="home-actions">
          <BriefMe />
          <ToolsLauncher />
          <AwayLaunch />
        </div>
      </div>
      <nav className="deck-row deck-links" aria-label="Device tools">
        <GpsStatus openMap={openGps} />
        {homeSections.map((item) => {
          const Icon = icons[item];
          return (
            <button key={item} onClick={() => navigate(item)}>
              <Icon size={16} aria-hidden="true" />
              <span>{item}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
      <HomeTools browser={browser} note={note} openLibrary={openBookmarks} />
    </div>
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
/**
 * Sentence-case name, dot colour and a short visible word for the telemetry
 * source. Live data is just a green dot; every other state also says what it
 * is, because a touchscreen cannot show a hover tooltip.
 */
const dataStates: Record<string, { state: string; short: string }> = {
  "LIVE COMPUTER": { state: "ok", short: "" },
  "STALE READINGS": { state: "warn", short: "Stale" },
  "SERVICE OFFLINE": { state: "off", short: "Offline" },
  CONNECTING: { state: "idle", short: "Connecting" },
  "UPDATES PAUSED": { state: "idle", short: "Paused" },
  "SIMULATED DATA": { state: "sim", short: "Simulated" },
  "PREVIEW PAUSED": { state: "sim", short: "Simulated · paused" },
};
function dataStatus(label: string) {
  const name = label.charAt(0) + label.slice(1).toLowerCase();
  return { name, ...(dataStates[label] ?? { state: "idle", short: name }) };
}
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest("input, textarea, select, [contenteditable]"))
  );
}
export default function App() {
  useCardDismissal();
  const [collapsed, setCollapsed] = useState(() =>
    savedFlag("klinekraft.navigation.drawer.v2", true),
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
      localStorage.setItem(
        "klinekraft.navigation.drawer.v2",
        String(collapsed),
      );
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
  const [researchAttachment, setResearchAttachment] = useState<File | null>(
    null,
  );
  function askAboutFile(file: File) {
    setResearchAttachment(file);
    navigate("AI assistant");
  }
  const [wikiContext, setWikiContext] = useState<WikiReference | null>(null);
  const [libraryView, setLibraryView] = useState("Documents");
  const [section, setSection] = useState<Section>("Home");
  const [paused, setPaused] = useState(false);
  const telemetry = useTelemetry(paused);
  const { reading, mode, setMode, label, detail } = telemetry;
  const status = dataStatus(label);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDocument, setSearchDocument] = useState<DocumentSource | null>(
    null,
  );
  const [searchWiki, setSearchWiki] = useState<WikiReference | null>(null);
  const [searchNote, setSearchNote] = useState<string | undefined>();
  const [searchPlace, setSearchPlace] = useState<MapLocation | undefined>();
  const [emergencyTopic, setEmergencyTopic] = useState<string | undefined>();
  function selectSearch(result: SearchResult) {
    setSearchOpen(false);
    if (result.wiki) setSearchWiki(result.wiki);
    else if (result.document) setSearchDocument(result.document);
    else if (result.noteId) {
      setSearchNote(result.noteId);
      navigate("Notes");
    } else if (result.place) {
      setSearchPlace(result.place);
      navigate("GPS / Maps");
    } else if (result.emergencyTopic) {
      setEmergencyTopic(result.emergencyTopic);
      navigate("Emergency");
    } else if (result.section) navigate(result.section);
  }
  const [notice, setNotice] = useState("");
  const [exitHelp, setExitHelp] = useState(false);
  useEffect(() => {
    installBrandIcon();
  }, []);
  // Layout effect: the shortcuts work from the first frame, not after the
  // first idle callback, so an early Ctrl+K or "/" is never lost.
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTyping(e.target) &&
        !document.querySelector(
          "dialog[open], [aria-modal='true'], [role='dialog']",
        )
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setExitHelp(false);
        setCollapsed(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const navigate = (next: Section) => {
    setCollapsed(true);
    setSection(next);
    setNotice("");
  };
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Fullscreen is unavailable in this browser. Use the browser’s fullscreen control.",
      );
    }
  }
  return (
    <div
      className={`app-shell minimal-shell${collapsed ? " sidebar-collapsed" : ""}`}
    >
      {searchOpen && (
        <UniversalSearch
          onClose={() => setSearchOpen(false)}
          onSelect={selectSearch}
        />
      )}
      {searchWiki && (
        <ArticleDialog
          reference={searchWiki}
          onClose={() => setSearchWiki(null)}
          onAsk={(article) => {
            setSearchWiki(null);
            setWikiContext(article);
            navigate("AI assistant");
          }}
        />
      )}
      {searchDocument && (
        <DocumentReader
          source={searchDocument}
          onClose={() => setSearchDocument(null)}
          onAsk={(file) => {
            setSearchDocument(null);
            askAboutFile(file);
          }}
        />
      )}
      <aside className="sidebar" inert={exitHelp}>
        <KlinekraftBrandLockup />
        <div className="sidebar-heading">
          <div className="sidebar-caption">PORTABLE COMPUTING</div>
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
          {navigationSections.map((item, index) => {
            const Icon = icons[item];
            return (
              <button
                key={item}
                aria-label={
                  collapsed
                    ? sectionLabel(item)
                    : `${String(index + 1).padStart(2, "0")} ${sectionLabel(item)}`
                }
                title={sectionLabel(item)}
                aria-current={section === item ? "page" : undefined}
                onClick={() => navigate(item)}
              >
                <span className="nav-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon size={16} strokeWidth={1.6} />
                <span className="nav-label">{sectionLabel(item)}</span>
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
      <main inert={exitHelp} data-page={section}>
        <header className="page-header shell-header">
          <div className="navigation-controls">
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label="Open navigation"
              title="Apps"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            {section !== "Home" && (
              <button
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Go Home"
                title="Home"
                onClick={() => navigate("Home")}
              >
                <House size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="shell-title">
            {section === "Home" && (
              <div className="header-brand">
                <KlinekraftBrandLockup />
              </div>
            )}
            <h1 className={section === "Home" ? "sr-only" : undefined}>
              {sectionLabel(section)}
            </h1>
          </div>
          <div className="header-actions">
            <span
              className="shell-status"
              role="img"
              aria-label={status.name}
              title={status.name}
              data-state={status.state}
            >
              <span className="k-status-dot" data-state={status.state} />
              {status.short && <span aria-hidden="true">{status.short}</span>}
            </span>
            <button
              className="k-btn k-btn--quiet shell-search"
              aria-label="Search Terminal"
              title={`Search Terminal (${searchShortcut} or /)`}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} aria-hidden="true" />
              <span>Search</span>
              <kbd>{searchShortcut}</kbd>
            </button>
            <Briefing />
            <PowerControls />
            <RadioPlayer />
            <VolumeControl />
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label="Dark mode"
              aria-pressed={dark}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="k-btn k-btn--quiet k-btn--icon"
              aria-label="Toggle fullscreen"
              title="Fullscreen"
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
          {notice && (
            <p role="status" className="browser-warning shell-notice">
              {notice}
              <button
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Dismiss"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </p>
          )}
          {section === "Home" ? (
            <Home
              history={telemetry.history}
              reading={reading}
              navigate={navigate}
              detail={detail}
              browser={browser}
              note={note}
              openGps={(latitude, longitude) => {
                setSearchPlace({ name: "GPS position", latitude, longitude });
                navigate("GPS / Maps");
              }}
              openBookmarks={() => {
                setLibraryView("Bookmarks");
                navigate("Library");
              }}
            />
          ) : section === "Emergency" ? (
            <EmergencyDashboard
              key={emergencyTopic ?? "default"}
              initialTopic={emergencyTopic}
              navigate={navigate}
              onAsk={askAboutFile}
            />
          ) : section === "AI assistant" ? (
            <AssistantPanel
              context={wikiContext}
              initialAttachment={researchAttachment}
              onConsumeAttachment={() => setResearchAttachment(null)}
              onClearContext={() => setWikiContext(null)}
            />
          ) : section === "Field Briefing" ? (
            <Briefing page />
          ) : section === "GPS / Maps" ? (
            <Suspense fallback={<p>Loading offline maps…</p>}>
              <OfflineMaps
                initialPlace={searchPlace}
                onConsumePlace={() => setSearchPlace(undefined)}
              />
            </Suspense>
          ) : section === "Paint" ? (
            <Paint />
          ) : section === "Notes" ? (
            <Organizer
              key="notes"
              kind="note"
              initialId={searchNote}
              onConsumeInitialId={() => setSearchNote(undefined)}
            />
          ) : section === "Calendar" ? (
            <Organizer key="calendar" kind="event" />
          ) : section === "Calculator" ? (
            <Calculator />
          ) : section === "Games" ? (
            <GamesPanel />
          ) : section === "Library" ? (
            <div className="library-workspace">
              <nav className="k-tabs" aria-label="Library sections">
                {libraryViews.map((view) => (
                  <button
                    key={view}
                    aria-pressed={libraryView === view}
                    onClick={() => setLibraryView(view)}
                  >
                    {view}
                  </button>
                ))}
              </nav>
              <div hidden={libraryView !== "Research"}>
                <ScienceSearch />
              </div>
              <div hidden={libraryView !== "Documents"}>
                <ResearchLibrary onAsk={askAboutFile} />
              </div>
              <div hidden={libraryView !== "Notebook"}>
                <Notebook
                  onAsk={askAboutFile}
                  onStart={() => navigate("AI assistant")}
                />
              </div>
              <div hidden={libraryView !== "Wikipedia"}>
                <WikiBrowser
                  onAsk={(article) => {
                    setWikiContext(article);
                    navigate("AI assistant");
                  }}
                />
              </div>
              <div hidden={libraryView !== "Bookmarks"}>
                <BrowserLibrary
                  store={browser}
                  openSettings={() => navigate("Settings")}
                />
              </div>
            </div>
          ) : section === "Settings" ? (
            <>
              <section className="settings-panel" aria-label="Appearance">
                <h2>Appearance</h2>
                <div className="setting-row">
                  <span>
                    <strong>Dark mode</strong>
                    <small>Also on the moon button in every header.</small>
                  </span>
                  <button
                    className="k-switch"
                    role="switch"
                    aria-label="Dark mode"
                    aria-checked={dark}
                    onClick={() => setDark(!dark)}
                  />
                </div>
                <div className="setting-row">
                  <span>
                    <strong>Collapse sidebar</strong>
                    <small>
                      Keep the app drawer closed until you open it with the
                      menu button.
                    </small>
                  </span>
                  <button
                    className="k-switch"
                    role="switch"
                    aria-label="Collapse sidebar"
                    aria-checked={collapsed}
                    onClick={() => setCollapsed(!collapsed)}
                  />
                </div>
              </section>
              <TelemetrySettings
                storageWarning={telemetry.storageWarning}
                mode={mode}
                setMode={setMode}
                paused={paused}
                setPaused={setPaused}
                label={label}
              />
              <SpeechSettings />
              <BrowserSettings store={browser} />
            </>
          ) : section === "Files" ? (
            <FilesPanel />
          ) : section === "System" ? (
            <>
              <ResourceGraphs
                history={telemetry.history}
                reading={reading}
                label={label}
              />
              <ProcessList live={mode === "host"} paused={paused} />
              <DetailsPanel
                className="resource-hardware"
                title="Hardware & sensors"
              >
                <SystemPanel reading={reading} label={label} />
              </DetailsPanel>
            </>
          ) : section === "Network" ? (
            <>
              <ScreenCast />
              <FieldConnections />
              <NetworkPanel reading={reading} label={label} />
            </>
          ) : null}
        </div>
      </main>
      <AwayPanel />
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
              In the installed Klinekraft app, press Alt + F4 or use the window
              close button to return to the desktop. If fullscreen is active,
              press F11 first to reveal the window controls.
            </p>
            <p>
              Your saved work stays on this Pi. The local service keeps running
              when you close the window.
            </p>
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
