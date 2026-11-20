import { LocalImage } from "./LocalImage";
import { useEffect, useState } from "react";
import { Gamepad2, Play, RefreshCw, Star, Shuffle } from "lucide-react";
import { isHostedDemo } from "../runtime";

type Game = { id: string; title: string; system: string };
type Catalog = {
  games: Game[];
  systems: Record<string, string | null>;
  running: string | null;
  lastExitCode: number | null;
};
const names: Record<string, string> = {
  n64: "Nintendo 64",
  nes: "NES",
  snes: "Super Nintendo",
  megadrive: "Genesis / Mega Drive",
};
const headers = { "X-Klinekraft-Client": "local-ui" };
// The documented mount point of the deck's NO NAME USB drive
// (docs/GAMES_SETUP.md), so the command can be pasted as is.
const setupCommand =
  'cd ~/klinekraft-terminal\nbash scripts/setup-games.sh "/media/klinekraft/NO NAME/retropie/roms"';
export function GamesPanel() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  // True while the last library poll failed. The last good list stays on
  // screen; only launching is blocked until the service answers again.
  const [offline, setOffline] = useState(false);
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
          setOffline(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError((error as Error).message);
          setOffline(true);
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
  const [favoritesReady, setFavoritesReady] = useState(isHostedDemo);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  useEffect(() => {
    if (isHostedDemo) return;
    let active = true;
    async function restore() {
      const migrated = localStorage.getItem(
        "klinekraft.games.favorites.pi-migrated",
      );
      if (!migrated) {
        for (const id of favorites) {
          const response = await fetch("/api/games/favorites/" + id, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ selected: true }),
          });
          if (!response.ok)
            throw Error("Could not migrate game favorites to the Pi.");
        }
        localStorage.setItem("klinekraft.games.favorites.pi-migrated", "true");
      }
      const response = await fetch("/api/games/favorites", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) throw Error("Could not load saved game favorites.");
      const saved: string[] = await response.json();
      if (active) {
        setFavorites(saved);
        setFavoritesReady(true);
      }
    }
    void restore().catch((error: Error) => {
      if (active) setStorageWarning(error.message);
    });
    return () => {
      active = false;
    };
  }, []);
  async function favorite(id: string) {
    if (!favoritesReady || favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      if (!isHostedDemo) {
        const response = await fetch("/api/games/favorites/" + id, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ selected: !favorites.includes(id) }),
        });
        if (!response.ok)
          throw Error("Favorite was not saved on the Pi. Please retry.");
      }

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
    } catch (error) {
      setStorageWarning((error as Error).message);
    } finally {
      setFavoriteBusy(false);
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
  const [randomIds, setRandomIds] = useState<string[] | null>(null);
  const byId = new Map(filtered.map((game) => [game.id, game]));
  const shown =
    randomIds === null
      ? filtered
      : randomIds.flatMap((id) => {
          const game = byId.get(id);
          return game ? [game] : [];
        });
  function randomize() {
    const pool = [...filtered];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setRandomIds(pool.slice(0, 12).map((game) => game.id));
  }
  return (
    <section className="browser-panel" aria-labelledby="games-title">
      <h2 id="games-title" className="sr-only">
        Your library
      </h2>
      {isHostedDemo ? (
        <p className="browser-help">
          Your games and emulator run in the local Pi app. The web demo cannot
          launch them.
        </p>
      ) : (
        <>
          {!!data?.games.length && (
            <div className="games-toolbar">
              <label className="sr-only" htmlFor="game-search">
                Search games
              </label>
              <input
                id="game-search"
                className="k-field games-search"
                type="search"
                placeholder="Search your games"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(60);
                  setRandomIds(null);
                }}
              />
              <select
                className="k-select"
                aria-label="Game system"
                value={system}
                onChange={(e) => {
                  setSystem(e.target.value);
                  setLimit(60);
                  setRandomIds(null);
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
                className="k-btn"
                aria-pressed={onlyFavorites}
                onClick={() => {
                  setOnlyFavorites(!onlyFavorites);
                  setLimit(60);
                  setRandomIds(null);
                }}
              >
                <Star
                  size={14}
                  aria-hidden="true"
                  fill={onlyFavorites ? "currentColor" : "none"}
                />
                Favorites
              </button>
              <button
                className="k-btn"
                onClick={randomize}
                disabled={!filtered.length}
                aria-pressed={randomIds !== null}
                title="Show up to 12 random games from these filters"
              >
                <Shuffle size={14} aria-hidden="true" /> Random
              </button>
              {randomIds !== null && (
                <button
                  className="k-btn k-btn--quiet"
                  onClick={() => setRandomIds(null)}
                >
                  Show all
                </button>
              )}
              <button
                className="k-btn k-btn--quiet k-btn--icon"
                aria-label="Refresh games"
                title="Refresh games"
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          {error && !data && (
            <p role="alert" className="browser-warning">
              {error}
            </p>
          )}
          {offline && data && (
            <p role="status" className="games-offline">
              <span
                className="k-status-dot"
                data-state="warn"
                aria-hidden="true"
              />
              Library offline · reconnecting…
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
                <div className="k-empty games-empty">
                  <Gamepad2 size={32} aria-hidden="true" />
                  <h3>No games yet</h3>
                  <p>
                    Connect the USB drive, then run the Games installer from a
                    Terminal on the Pi desktop. Your games appear here
                    automatically.
                  </p>
                  <code>{setupCommand}</code>
                </div>
              ) : (
                <>
                  <p className="games-count">
                    {randomIds !== null
                      ? `${shown.length} random picks · `
                      : ""}
                    {filtered.length} {filtered.length === 1 ? "game" : "games"}
                    {onlyFavorites ? " in favorites" : ""}
                  </p>
                  {!filtered.length && (
                    <div className="k-empty">
                      <h3>No games match</h3>
                      <p>Try another title or system.</p>
                      <button
                        className="k-btn"
                        onClick={() => {
                          setSearch("");
                          setSystem("all");
                          setOnlyFavorites(false);
                          setRandomIds(null);
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                  <ul className="game-list">
                    {shown.slice(0, limit).map((game) => (
                      <li key={game.id}>
                        <div className="game-cover">
                          <LocalImage
                            src={`/api/games/${game.id}/artwork`}
                            alt={game.title}
                            fallback={
                              <span className="game-cover-fallback">
                                <small>{names[game.system]}</small>
                                <strong>{game.title}</strong>
                              </span>
                            }
                          />
                        </div>
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
                          className="k-btn"
                          disabled={
                            launching ||
                            offline ||
                            !!data.running ||
                            !!data.systems[game.system]
                          }
                          aria-label={`Play ${game.title}`}
                          onClick={() => void play(game)}
                        >
                          <Play size={14} aria-hidden="true" /> Play
                        </button>
                      </li>
                    ))}
                  </ul>
                  {randomIds === null && filtered.length > limit && (
                    <button
                      className="k-btn games-more"
                      onClick={() => setLimit((value) => value + 60)}
                    >
                      Show more games
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <details className="details-panel games-help">
            <summary>
              {data && !data.games.length
                ? "Supported systems & controller"
                : "Import more games & controller"}
            </summary>
            <div className="details-panel-content">
              {!!data?.games.length && (
                <>
                  <p>
                    Connect the USB drive and run the Games installer again from
                    a Terminal on the Pi desktop. Originals and save backups are
                    preserved.
                  </p>
                  <code>{setupCommand}</code>
                </>
              )}
              <p>
                NES, SNES and Genesis / Mega Drive are supported. The importer
                reads ROM types inside ZIPs, so misplaced Genesis files are
                routed correctly. Actual 32X ROMs are left on the source for a
                future core.
              </p>
              <p>
                Plug in the SAFFUN receiver and turn on the controller. If
                buttons are not mapped, use RetroArch Settings → Input →
                RetroPad Binds → Port 1 Controls. Keep a keyboard handy for the
                first test; F1 opens the RetroArch menu. Choose Quit RetroArch
                to return to the dashboard.
              </p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
