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
type Readiness = { checkedAt: string; library: { documents: number; searchable: number; historical: number }; checks: {name:string; state:string; checkedAt:string|null; detail:string}[] };

export function EmergencyDashboard({ navigate, onAsk }: { navigate: (section: Section) => void; onAsk: (file: File) => void }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("power outage");
  useEffect(() => {
    const request = new AbortController();
    localJSON('/api/emergency/status', { signal: request.signal }).then(setReadiness).catch(e => {
      if (!request.signal.aborted) setError(e.message);
    });
    return () => request.abort();
  }, []);
  return <section className="emergency-dashboard" aria-label="Emergency dashboard">
    <div className="emergency-readiness">
      {readiness ? readiness.checks.map(check => <div key={check.name} className="readiness-card" data-state={check.state}>
        <span>{check.name}</span><strong>{check.state}</strong>
        <small>{check.checkedAt ? `Test / save: ${new Date(check.checkedAt).toLocaleString('en-US', {month:'short', day:'numeric',hour:'numeric',minute:'2-digit'})}` : 'No verification recorded'}</small>
        <p>{check.detail}</p>
      </div>) : <p>Checking local readiness…</p>}
    </div>
    {error && <p role="alert">Readiness check: {error}</p>}
    <p className="browser-help">Open saved guidance directly. AI is optional. Ready reflects the recorded test, not a guarantee. This page does not receive live emergency alerts.</p>
    <div className="emergency-topics">{topics.map(([label, query]) => <button key={query} aria-pressed={topic === query} onClick={() => setTopic(query)}>{label}</button>)}</div>
    <div className="emergency-actions">
      <button onClick={() => navigate('GPS / Maps')}>Maps & saved places</button>
      <button onClick={() => navigate('Notes')}>Contacts & planning notes</button>
      <button onClick={() => navigate('System')}>Battery & system</button>
      <button onClick={() => navigate('AI assistant')}>Ask Shackleton</button>
      <button onClick={() => navigate('Network')}>Connections</button>
    </div>
    {topic === "HISTORICAL" && <p className="browser-help">Cold War documents are historical records, not current emergency guidance. Shackleton searches them when you explicitly ask about history, vintage guides, or their year.</p>}
    <ResearchLibrary key={topic} initialQuery={topic} onAsk={onAsk} />
  </section>;
}
