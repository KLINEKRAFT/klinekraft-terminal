export type Reading = {
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
  "Games",
  "AI assistant",
  "GPS / Maps",
  "Library",
  "Files",
  "Network",
  "System",
  "Settings",
] as const;
export type Section = (typeof sections)[number];
export type CommandResult = { section?: Section; message: string };
export function resolveCommand(value: string): CommandResult {
  const command = value.trim().toLowerCase().replace(/\s+/g, " ");
  const routes: Record<string, Section> = {
    home: "Home",
    games: "Games",
    arcade: "Games",
    gps: "GPS / Maps",
    "gps status": "GPS / Maps",
    status: "System",
    "system status": "System",
    network: "Network",
    files: "Files",
    settings: "Settings",
    library: "Library",
    wiki: "Library",
    wikipedia: "Library",
    bookmarks: "Library",
    browser: "Library",
  };
  if (Object.hasOwn(routes, command))
    return {
      section: routes[command],
      message: `Opened ${routes[command]}.`,
    };
  if (command.startsWith("play "))
    return {
      section: "Games",
      message:
        "Game launching is not connected. No emulator or ROM was opened.",
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
      message: "AI providers are not configured. No request was sent.",
    };
  return {
    message:
      "Available: home, games, gps status, system status, network, files, library, settings. This is not a shell.",
  };
}
