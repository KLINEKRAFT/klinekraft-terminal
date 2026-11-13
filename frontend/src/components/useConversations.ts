import { useEffect, useState } from "react";
import { isHostedDemo } from "../runtime";
import { localJSON, type WikiReference } from "./WikiReader";
import type { Turn } from "./AssistantPanel";

type Summary = { id: string; title: string; revision: number; updated: string };
type Chat = Summary & { turns: Turn[]; context: WikiReference | null };
let recovery: Chat | null = null;
const LAST = "klinekraft.lastChat.v1";
function remember(id: string) {
  try {
    localStorage.setItem(LAST, id);
  } catch {
    /* History still works without browser storage. */
  }
}
function fresh(context: WikiReference | null = null): Chat {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    revision: 0,
    updated: "",
    turns: [],
    context,
  };
}
export function downloadJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useConversations(initialContext: WikiReference | null) {
  const [chat, setChat] = useState<Chat>(
    () => recovery ?? fresh(initialContext),
  );
  const [loading, setLoading] = useState(!isHostedDemo);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!!recovery);
  const [error, setError] = useState("");
  const [items, setItems] = useState<Summary[]>([]);
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (isHostedDemo) return;
    if (recovery) {
      setLoading(false);
      setError("This answer has not been saved. Retry saving or export it.");
      return;
    }
    const request = new AbortController();
    let id = "";
    try {
      id = localStorage.getItem(LAST) || "";
    } catch {}
    if (!id || initialContext) {
      setLoading(false);
      return;
    }
    void localJSON("/api/conversations/" + encodeURIComponent(id), {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    })
      .then((data) => {
        if (!request.signal.aborted) setChat(data);
      })
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, []); // Restore once; a Library article intentionally starts a fresh chat.
  useEffect(() => {
    if (isHostedDemo) return;
    const request = new AbortController();
    const timer = setTimeout(
      () =>
        void localJSON(
          "/api/conversations?" + new URLSearchParams({ q: query }),
          {
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(10000),
            ]),
          },
        )
          .then((data) => {
            if (!request.signal.aborted) setItems(data.chats);
          })
          .catch((e) => {
            if (!request.signal.aborted) setError(e.message);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [query, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(next = chat) {
    recovery = next;
    setChat(next);
    setDirty(true);
    setSaving(true);
    setError("");
    try {
      const result = await localJSON("/api/conversations/" + next.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify(next),
      });
      setChat({ ...next, ...result });
      recovery = null;
      setDirty(false);
      remember(next.id);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function update(turns: Turn[]) {
    if (!turns.length) {
      setChat(fresh());
      remember("");
      setError("");
      return;
    }
    await save({
      ...chat,
      turns,
      title:
        chat.revision === 0
          ? turns[0].question.trim().slice(0, 120) || "Untitled chat"
          : chat.title,
    });
  }
  async function open(id: string) {
    setLoading(true);
    setError("");
    try {
      const data = await localJSON("/api/conversations/" + id, {
        signal: AbortSignal.timeout(10000),
      });
      setChat(data);
      remember(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this saved conversation from the Pi?")) return;
    setSaving(true);
    setError("");
    try {
      await localJSON(
        "/api/conversations/" + chat.id + "?revision=" + chat.revision,
        { method: "DELETE", signal: AbortSignal.timeout(10000) },
      );
      setChat(fresh());
      remember("");
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
      setRefresh((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }
  async function exportAll() {
    try {
      downloadJSON(
        await localJSON("/api/conversations/export", {
          signal: AbortSignal.timeout(15000),
        }),
        "klinekraft-chats.json",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function clearContext() {
    const next = { ...chat, context: null };
    if (chat.revision) void save(next);
    else setChat(next);
  }
  return {
    chat,
    loading,
    saving,
    dirty,
    error,
    items,
    query,
    setQuery,
    save,
    update,
    open,
    remove,
    exportAll,
    clearContext,
    retry: () => save(),
    copy: () => save({ ...chat, id: crypto.randomUUID(), revision: 0 }),
    refresh: () => setRefresh((v) => v + 1),
  };
}
