/**
 * URL -> adapter routing. Custom adapters take priority over the two
 * generic tool wrappers; yt-dlp is the last-resort fallback because it
 * supports far more sites than we can enumerate.
 */
import { galleryDlAdapter } from "../adapters/gallerydl.adapter.js";
import { ytDlpAdapter } from "../adapters/ytdlp.adapter.js";
import type { Adapter } from "../adapters/types.js";
import { fail, ok, type Result } from "./result.js";

/** Ordered registry: custom adapters first, generic wrappers after. */
const adapters: Adapter[] = [
  // custom adapters go here (Fase 4)
  galleryDlAdapter,
  ytDlpAdapter,
];

export interface Route {
  adapter: Adapter;
  /** True when no adapter matched and we fell back to yt-dlp. */
  isFallback: boolean;
}

/** Validates the raw string as an http(s) URL and picks an adapter. */
export function route(rawUrl: string): Result<Route> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return fail("INVALID_URL", `'${rawUrl}' is not a valid URL.`, "Expected something like https://youtube.com/watch?v=...");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail("INVALID_URL", `Unsupported protocol '${url.protocol}'.`, "Only http/https URLs are supported.");
  }

  const adapter = adapters.find((a) => a.matches(url));
  if (adapter) return ok({ adapter, isFallback: false });
  return ok({ adapter: ytDlpAdapter, isFallback: true });
}

/** Parses and returns the URL object (already validated by route()). */
export function parseUrl(rawUrl: string): URL {
  return new URL(rawUrl.trim());
}
