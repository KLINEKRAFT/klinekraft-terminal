import { DetailsPanel } from "./DetailsPanel";
import { Info } from "./Info";
import { emergencyGuides } from "../emergencyGuides";
import { useEffect, useState } from "react";
import { localJSON } from "./WikiReader";
import { ResearchLibrary } from "./ResearchLibrary";
import type { Section } from "../preview";

const topics = [
  ["Water & sanitation", "water sanitation"],
  ["First aid", "first aid"],
  ["Power outage", "power outage"],
  ["Shelter & weather", "shelter weather"],
  ["Radiation emergency", "radiation fallout"],
  ["Food & preservation", "food preservation"],
  ["Cold War archive", "HISTORICAL"],
];
type Readiness = {
  checkedAt: string;
  library: { documents: number; searchable: number; historical: number };
  checks: {
    name: string;
    state: string;
    checkedAt: string | null;
    detail: string;
  }[];
};

export function EmergencyDashboard({
  navigate,
  onAsk,
  initialTopic,
}: {
  navigate: (section: Section) => void;
  onAsk: (file: File) => void;
  initialTopic?: string;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState(
    initialTopic && emergencyGuides[initialTopic] ? initialTopic : "power outage",
  );
  useEffect(() => {
    const request = new AbortController();
    localJSON("/api/emergency/status", { signal: request.signal })
      .then(setReadiness)
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      });
    return () => request.abort();
  }, []);
  const guide = emergencyGuides[topic];
  return (
    <section className="emergency-dashboard" aria-label="Emergency dashboard">
      <div className="emergency-heading">
        <h2>Field references</h2>
        <Info label="Emergency information">
          <p>
            Saved on this deck; no AI needed. Reviewed Nov 16, 2026. Follow
            local emergency instructions. Call 911 for immediate danger.
            Readiness reflects recorded checks, not live alerts.
          </p>
        </Info>
      </div>

      <div className="emergency-topics">
        {topics.map(([label, query]) => (
          <button
            key={query}
            aria-pressed={topic === query}
            onClick={() => setTopic(query)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="emergency-workbench">
        <aside className="emergency-reference">
          {guide && (
            <article className="emergency-quick" aria-label={guide.title}>
              <h3>{guide.title}</h3>
              <ol>
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <small>
                Source:{" "}
                <a href={guide.url} target="_blank" rel="noreferrer">
                  {guide.source}
                </a>{" "}
                · original website requires internet
              </small>
            </article>
          )}
          <DetailsPanel
            title="Deck readiness &amp; backup checks"
            className="emergency-checks"
          >
            <div className="emergency-readiness">
              {readiness ? (
                readiness.checks.map((check) => (
                  <div
                    key={check.name}
                    className="readiness-card"
                    data-state={check.state}
                  >
                    <span>{check.name}</span>
                    <strong>{check.state}</strong>
                    <small>
                      {check.checkedAt
                        ? `Test / save: ${new Date(check.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : "No verification recorded"}
                    </small>
                    <p>{check.detail}</p>
                  </div>
                ))
              ) : (
                <p>Checking local readiness…</p>
              )}
            </div>
          </DetailsPanel>
          {error && <p role="alert">Readiness check: {error}</p>}

          <div className="emergency-actions">
            <button onClick={() => navigate("GPS / Maps")}>
              Maps & saved places
            </button>
            <button onClick={() => navigate("Notes")}>
              Contacts & planning notes
            </button>
            <button onClick={() => navigate("System")}>Battery & system</button>
            <button onClick={() => navigate("AI assistant")}>
              Ask Shackleton
            </button>
            <button onClick={() => navigate("Network")}>Connections</button>
          </div>
          {topic === "HISTORICAL" && (
            <p className="browser-help">
              Cold War documents are historical records, not current emergency
              guidance. Shackleton searches them when you explicitly ask about
              history, vintage guides, or their year.
            </p>
          )}
        </aside>
        <div className="emergency-library">
          <ResearchLibrary key={topic} initialQuery={topic} onAsk={onAsk} />
        </div>
      </div>
    </section>
  );
}
