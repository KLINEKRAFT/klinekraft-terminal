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
export type CommandResult = { section?: Section; message: string };
// Every section is reachable by its own name; aliases cover common words.
const commandAliases: Record<string, Section> = {
  shackleton: "AI assistant",
  ai: "AI assistant",
  ask: "AI assistant",
  chat: "AI assistant",
  arcade: "Games",
  play: "Games",
  maps: "GPS / Maps",
  map: "GPS / Maps",
  gps: "GPS / Maps",
  "gps status": "GPS / Maps",
  weather: "Field Briefing",
  radar: "Field Briefing",
  feeds: "Field Briefing",
  briefing: "Field Briefing",
  note: "Notes",
  draw: "Paint",
  events: "Calendar",
  calc: "Calculator",
  status: "System",
  "system status": "System",
  processes: "System",
  wifi: "Network",
  hotspot: "Network",
  wiki: "Library",
  wikipedia: "Library",
  bookmarks: "Library",
  browser: "Library",
  documents: "Library",
  sos: "Emergency",
  "first aid": "Emergency",
};
const commandRoutes: Record<string, Section> = {
  ...Object.fromEntries(sections.map((s) => [s.toLowerCase(), s])),
  ...commandAliases,
};
export const commandHelp =
  "Try: home, shackleton, maps, weather, library, notes, paint, games, calendar, calc, files, network, system, settings, emergency. This is not a shell.";
export function resolveCommand(value: string): CommandResult {
  const command = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (Object.hasOwn(commandRoutes, command))
    return {
      section: commandRoutes[command],
      message: `Opened ${sectionLabel(commandRoutes[command])}.`,
    };
  if (command.startsWith("play "))
    return {
      section: "Games",
      message:
        "Choose a game in the library and press Play. Typed commands never launch an emulator.",
    };
  if (command.startsWith("wiki "))
    return {
      section: "Library",
      message:
        "Open the Wikipedia reader in Library to search your installed archives.",
    };
  if (command.startsWith("ask "))
    return {
      section: "AI assistant",
      message: "Opened Shackleton. Type your question there.",
    };
  return { message: `Unknown command. ${commandHelp}` };
}
