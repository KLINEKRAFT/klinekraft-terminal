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
];
type Readiness = { library: { documents: number; searchable: number }; maps: boolean; localAI: boolean; model: string };

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
      <div><strong>{readiness ? readiness.library.documents : "—"}</strong><span>Stored references</span></div>
      <div><strong>{readiness ? readiness.library.searchable : "—"}</strong><span>Searchable references</span></div>
      <div><strong>{readiness ? (readiness.maps ? "Ready" : "Not installed") : "Checking"}</strong><span>Offline maps</span></div>
      <div><strong>{readiness ? (readiness.localAI ? "Ready" : "Unavailable") : "Checking"}</strong><span>Offline Shackleton</span></div>
    </div>
    {error && <p role="alert">Readiness check: {error}</p>}
    <p className="browser-help">Open saved guidance directly. AI is optional. This page does not receive live emergency alerts.</p>
    <div className="emergency-topics">{topics.map(([label, query]) => <button key={query} aria-pressed={topic === query} onClick={() => setTopic(query)}>{label}</button>)}</div>
    <div className="emergency-actions">
      <button onClick={() => navigate('GPS / Maps')}>Maps & saved places</button>
      <button onClick={() => navigate('Notes')}>Contacts & planning notes</button>
      <button onClick={() => navigate('System')}>Battery & system</button>
      <button onClick={() => navigate('AI assistant')}>Ask Shackleton</button>
      <button onClick={() => navigate('Network')}>Connections</button>
    </div>
    <ResearchLibrary key={topic} initialQuery={topic} onAsk={onAsk} />
  </section>;
}
