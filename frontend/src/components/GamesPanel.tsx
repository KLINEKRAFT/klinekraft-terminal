import { useEffect, useState } from "react";
import { Play, Star } from "lucide-react";
import { isHostedDemo } from "../runtime";

type Game = { id: string; title: string; system: string };
type Catalog = {
  games: Game[];
  systems: Record<string, string | null>;
  running: string | null;
  lastExitCode: number | null;
};
const names: Record<string, string> = {
  nes: "NES",
  snes: "Super Nintendo",
  megadrive: "Genesis / Mega Drive",
};
const headers = { "X-Klinekraft-Client": "local-ui" };
export function GamesPanel() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [system, setSystem] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [revision, setRevision] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("klinekraft.games.favorites.v1") || "[]",
      );
      return Array.isArray(value)
        ? value
            .filter((id) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id))
            .slice(0, 5000)
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (isHostedDemo) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/games", {
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(
            "The game library is unavailable. Check the local Pi service.",
          );
        const catalog = await response.json();
        if (!Array.isArray(catalog.games) || !catalog.systems)
          throw new Error("Update the Pi service to connect Games.");
        if (!controller.signal.aborted) {
          setData(catalog);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setData(null);
          setError((error as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) retry = setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [revision]);
  function favorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(
        "klinekraft.games.favorites.v1",
        JSON.stringify(next),
      );
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Favorites apply now but cannot be saved in this browser.",
      );
    }
  }
  async function play(game: Game) {
    setLaunching(true);
    setMessage("");
    try {
      const response = await fetch("/api/games/launch", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "The game could not be started.",
        );
      setMessage(
        `${game.title} opened on the Pi. Quit RetroArch to return here.`,
      );
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLaunching(false);
    }
  }
  const filtered = (data?.games || []).filter(
    (game) =>
      (system === "all" || game.system === system) &&
      (!onlyFavorites || favorites.includes(game.id)) &&
      game.title.toLowerCase().includes(search.toLowerCase()),
  );
  const [limit, setLimit] = useState(60);
  return (
    <section className="browser-panel" aria-labelledby="games-title">
      <span className="eyebrow">YOUR COLLECTION</span>
      <h2 id="games-title">Your library</h2>
      <p className="browser-help">Pick a game. Settle in.</p>
      {isHostedDemo ? (
        <p className="browser-help">
          Your games and emulator run in the local Pi app. The web demo cannot
          launch them.
        </p>
      ) : (
        <>
          <div className="game-toolbar">
            <label className="sr-only" htmlFor="game-search">
              Search games
            </label>
            <input
              id="game-search"
              type="search"
              placeholder="Search your games"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(60);
              }}
            />
            <select
              aria-label="Game system"
              value={system}
              onChange={(e) => {
                setSystem(e.target.value);
                setLimit(60);
              }}
            >
              <option value="all">All systems</option>
              {Object.entries(names).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="browser-button"
              aria-pressed={onlyFavorites}
              onClick={() => {
                setOnlyFavorites(!onlyFavorites);
                setLimit(60);
              }}
            >
              Favorites
            </button>
            <button
              className="browser-button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh games
            </button>
          </div>
          {error && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="browser-help">
              {message}
            </p>
          )}
          {storageWarning && (
            <p role="status" className="browser-warning">
              {storageWarning}
            </p>
          )}
          {!data && !error && (
            <p role="status" className="browser-help">
              Loading your library…
            </p>
          )}
          {data && (
            <>
              {data.running && (
                <p role="status" className="browser-help">
                  A game is running on the Pi. Quit it in RetroArch before
                  opening another.
                </p>
              )}
              {!data.running &&
                data.lastExitCode != null &&
                data.lastExitCode !== 0 && (
                  <p role="status" className="browser-warning">
                    RetroArch exited with code {data.lastExitCode}. Check the
                    last-game.log file in Games / Klinekraft.
                  </p>
                )}
              {!data.games.length ? (
                <p className="browser-help">
                  Your library is ready for its first games. Import your USB
                  collection using the setup instructions below.
                </p>
              ) : (
                <>
                  <p className="browser-help">
                    {filtered.length} {filtered.length === 1 ? "game" : "games"}
                    {onlyFavorites ? " in favorites" : ""}
                  </p>
                  {!filtered.length && (
                    <p className="browser-help">
                      No games match. Try another title or system.
                    </p>
                  )}
                  <ul className="game-list">
                    {filtered.slice(0, limit).map((game) => (
                      <li key={game.id}>
                        <button
                          className="game-favorite"
                          aria-label={`${favorites.includes(game.id) ? "Unfavorite" : "Favorite"} ${game.title}`}
                          aria-pressed={favorites.includes(game.id)}
                          onClick={() => favorite(game.id)}
                        >
                          <Star
                            size={16}
                            fill={
                              favorites.includes(game.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                        <div className="game-title">
                          <strong>{game.title}</strong>
                          <span>
                            {names[game.system]}
                            {data.systems[game.system]
                              ? ` · ${data.systems[game.system]}`
                              : ""}
                          </span>
                        </div>
                        <button
                          className="browser-button"
                          disabled={
                            launching ||
                            !!data.running ||
                            !!data.systems[game.system]
                          }
                          aria-label={`Play ${game.title}`}
                          onClick={() => void play(game)}
                        >
                          <Play size={14} /> Play
                        </button>
                      </li>
                    ))}
                  </ul>
                  {filtered.length > limit && (
                    <button
                      className="browser-button"
                      onClick={() => setLimit((value) => value + 60)}
                    >
                      Show more games
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <details className="content-details">
            <summary>Set up games on the Pi</summary>
            <p>
              Connect the USB drive and run the Games installer from your Pi’s
              desktop Terminal. Use your drive’s roms folder as the source.
              Originals and save backups are preserved.
            </p>
            <pre>
              cd ~/klinekraft-terminal{"\n"}bash scripts/setup-games.sh
              "/path/to/retropie/roms"
            </pre>
            <p>
              NES, SNES and Genesis / Mega Drive are supported. The importer
              reads ROM types inside ZIPs, so misplaced Genesis files are routed
              correctly. Actual 32X ROMs are left on the source for a future
              core.
            </p>
            <p>
              Plug in the SAFFUN receiver and turn on the controller. If buttons
              are not mapped, use RetroArch Settings → Input → RetroPad Binds →
              Port 1 Controls. Keep a keyboard handy for the first test; F1
              opens the RetroArch menu. Choose Quit RetroArch to return to the
              dashboard.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
