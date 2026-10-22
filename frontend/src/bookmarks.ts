import { useState } from "react";

export type Bookmark = { id: string; title: string; url: string };
type BrowserPreferences = {
  version: 1;
  bookmarks: Bookmark[];
  launchUrl: string;
};
const storageKey = "klinekraft.browser.v1";
const empty: BrowserPreferences = { version: 1, bookmarks: [], launchUrl: "" };

export function browserUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048)
    throw new Error("Enter a web address, up to 2,048 characters.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "Enter a complete address starting with https:// or http://.",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use an http:// or https:// address without an embedded username or password.",
    );
  return url.href;
}

function readPreferences(): { data: BrowserPreferences; warning: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { data: empty, warning: "" };
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Array.isArray(data.bookmarks) ||
      data.bookmarks.length > 100 ||
      typeof data.launchUrl !== "string"
    )
      throw new Error();
    const ids = new Set<string>();
    const bookmarks = data.bookmarks.map((item: Bookmark) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !item.id ||
        ids.has(item.id) ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.length > 80 ||
        typeof item.url !== "string"
      )
        throw new Error();
      ids.add(item.id);
      return {
        id: item.id,
        title: item.title.trim(),
        url: browserUrl(item.url),
      };
    });
    return {
      data: {
        version: 1,
        bookmarks,
        launchUrl: data.launchUrl ? browserUrl(data.launchUrl) : "",
      },
      warning: "",
    };
  } catch {
    return {
      data: empty,
      warning:
        "Saved browser preferences could not be loaded. Changes will try to replace them when you save.",
    };
  }
}

export function useBrowserPreferences() {
  const [state, setState] = useState(readPreferences);
  function save(data: BrowserPreferences) {
    let warning = "";
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      warning =
        "Browser storage is unavailable. Changes only last until this page is reloaded.";
    }
    setState({ data, warning });
  }
  return { ...state, save };
}
export type BrowserStore = ReturnType<typeof useBrowserPreferences>;
