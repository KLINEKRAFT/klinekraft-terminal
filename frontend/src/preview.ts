export type Reading = {
  networkDownload?: number | null;
  networkUpload?: number | null;
  source: "simulated" | "host";
  batteryPercent?: number | null;
  batteryVoltage?: number | null;
  batteryStatus?: string;
  sampledAt: string | null;
  stale: boolean;
  system: string;
  architecture: string;
  cpu: number | null;
  cpuCores: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  storageUsed: number | null;
  storageTotal: number | null;
  temperature: number | null;
  interfaces: { name: string; isUp: boolean }[] | null;
};
export const initialReading: Reading = {
  source: "simulated",
  sampledAt: null,
  stale: false,
  system: "Raspberry Pi 5",
  architecture: "ARM64",
  cpuCores: 4,
  cpu: 12,
  memoryUsed: 1.6,
  memoryTotal: 8,
  storageUsed: 38.4,
  storageTotal: 119.2,
  temperature: 43.2,
  interfaces: [{ name: "wlan0 (simulated)", isUp: true }],
};
export function previewReading(tick: number): Reading {
  return {
    ...initialReading,
    cpu: Math.round(12 + Math.sin(tick * 0.7) * 4),
    temperature: Math.round((43.2 + Math.sin(tick * 0.3) * 0.6) * 10) / 10,
  };
}
export const sections = [
  "Home",
  "AI assistant",
  "GPS / Maps",
  "Field Briefing",
  "Library",
  "Notes",
  "Paint",
  "Games",
  "Calendar",
  "Calculator",
  "Files",
  "Network",
  "System",
  "Settings",
  "Emergency",
] as const;
export type Section = (typeof sections)[number];
export const homeSections: readonly Section[] = ["Files", "Network", "System"];
export const navigationSections = sections.filter(
  (section) => !homeSections.includes(section),
);
export const sectionLabel = (section: Section) =>
  section === "AI assistant" ? "Shackleton" : section;
// Everyday words people type for an app. Universal Search matches these as
// well as each app's own name, so "calc", "radar" or "sos" finds the app.
export const sectionAliases: Readonly<Record<string, Section>> = {
  shackleton: "AI assistant",
  ai: "AI assistant",
  ask: "AI assistant",
  chat: "AI assistant",
  arcade: "Games",
  play: "Games",
  maps: "GPS / Maps",
  map: "GPS / Maps",
  gps: "GPS / Maps",
  navigation: "GPS / Maps",
  weather: "Field Briefing",
  radar: "Field Briefing",
  feeds: "Field Briefing",
  briefing: "Field Briefing",
  note: "Notes",
  draw: "Paint",
  events: "Calendar",
  schedule: "Calendar",
  calc: "Calculator",
  math: "Calculator",
  status: "System",
  "system status": "System",
  processes: "System",
  wifi: "Network",
  hotspot: "Network",
  airplay: "Network",
  wiki: "Library",
  wikipedia: "Library",
  bookmarks: "Library",
  browser: "Library",
  documents: "Library",
  sos: "Emergency",
  "first aid": "Emergency",
  preferences: "Settings",
};
/** Apps whose name or alias matches a query, best match first. */
export function matchSections(query: string): Section[] {
  const q = query.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const scores = new Map<Section, number>();
  const offer = (section: Section, score: number) =>
    scores.set(section, Math.min(scores.get(section) ?? 9, score));
  for (const section of sections) {
    const name = sectionLabel(section).toLocaleLowerCase();
    if (!q || name.includes(q))
      offer(section, name === q ? 0 : name.startsWith(q) ? 1 : 3);
  }
  if (q.length >= 2)
    for (const [alias, section] of Object.entries(sectionAliases))
      if (alias.startsWith(q)) offer(section, alias === q ? 0 : 2);
  return [...scores.entries()]
    .sort(
      (a, b) => a[1] - b[1] || sections.indexOf(a[0]) - sections.indexOf(b[0]),
    )
    .map(([section]) => section);
}
