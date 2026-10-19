export type Reading = {
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  storageUsed: number;
  storageTotal: number;
  temperature: number;
};
export const initialReading: Reading = {
  cpu: 12,
  memoryUsed: 1.6,
  memoryTotal: 8,
  storageUsed: 38.4,
  storageTotal: 119.2,
  temperature: 43.2,
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
  };
  if (Object.hasOwn(routes, command))
    return {
      section: routes[command],
      message: `Opened ${routes[command]}. Preview data only.`,
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
      message: "Kiwix is not connected. No article search was performed.",
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
