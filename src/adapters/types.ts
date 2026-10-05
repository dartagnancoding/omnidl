/**
 * Adapter contract. Each adapter knows which URLs it handles and how to
 * drive its underlying tool (yt-dlp, gallery-dl, or a custom scraper).
 */
import type { Result } from "../core/result.js";

/** Media kind, used to pick the default destination directory. */
export type MediaKind = "video" | "audio" | "image";

/** Progress snapshot parsed from the underlying tool's stdout. */
export interface ProgressInfo {
  /** 0-100, or undefined when the tool doesn't report a percentage. */
  percent?: number;
  /** Human-readable transfer speed, e.g. "1.2MiB/s". */
  speed?: string;
  /** Human-readable ETA, e.g. "00:12". */
  eta?: string;
  /** Free-form status line (fallback when there is no percentage). */
  status?: string;
}

export interface DownloadOptions {
  /** Absolute destination directory. */
  outputDir: string;
  /** Extract audio and convert to mp3 (yt-dlp only). */
  audioOnly: boolean;
  /** Max video height cap: "best" | "1080" | "720" | "480" | "360". */
  quality: string;
  /** Raw yt-dlp -f format expression; overrides `quality` when set. */
  format?: string;
  /** Browser to read session cookies from (yt-dlp/gallery-dl flag). */
  cookiesFromBrowser?: string;
  /** Called on each parsed progress update. */
  onProgress?: (info: ProgressInfo) => void;
}

export interface DownloadedFile {
  filePath: string;
}

export interface Adapter {
  /** Short identifier shown in logs, e.g. "yt-dlp". */
  name: string;
  /** Media kind this adapter produces by default (routing to dirs). */
  kind: MediaKind;
  /** True when this adapter should handle the given URL. */
  matches(url: URL): boolean;
  /** Runs the download; expected failures come back as a failed Result. */
  download(url: URL, opts: DownloadOptions): Promise<Result<DownloadedFile[]>>;
}
