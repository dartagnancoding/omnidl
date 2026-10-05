/**
 * Parses yt-dlp stdout lines (run with --newline) into structured
 * progress and destination-file events.
 */
import type { ProgressInfo } from "../adapters/types.js";

// Example: "[download]  42.3% of 10.51MiB at 1.24MiB/s ETA 00:12"
const PROGRESS_RE =
  /^\[download\]\s+(\d{1,3}(?:\.\d+)?)%(?:\s+of\s+~?\s*\S+)?(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/;

// Lines that reveal where yt-dlp is writing the output file.
const DESTINATION_RE = /^\[download\]\s+Destination:\s+(.+)$/;
const MERGER_RE = /^\[Merger\]\s+Merging formats into\s+"(.+)"$/;
const EXTRACT_AUDIO_RE = /^\[ExtractAudio\]\s+Destination:\s+(.+)$/;
const ALREADY_RE = /^\[download\]\s+(.+?) has already been downloaded/;

/** Parses a yt-dlp progress line; returns undefined for non-progress lines. */
export function parseYtDlpProgress(line: string): ProgressInfo | undefined {
  const m = PROGRESS_RE.exec(line.trim());
  if (!m) return undefined;
  return {
    percent: Number(m[1]),
    speed: m[2] && m[2] !== "Unknown" ? m[2] : undefined,
    eta: m[3] && m[3] !== "Unknown" ? m[3] : undefined,
  };
}

/**
 * Extracts an output file path from a yt-dlp line, if present.
 * `final` paths (merge/audio-extract) supersede intermediate ones.
 */
export function parseYtDlpDestination(
  line: string,
): { filePath: string; final: boolean } | undefined {
  const trimmed = line.trim();
  const merged = MERGER_RE.exec(trimmed);
  if (merged?.[1]) return { filePath: merged[1], final: true };
  const audio = EXTRACT_AUDIO_RE.exec(trimmed);
  if (audio?.[1]) return { filePath: audio[1], final: true };
  const dest = DESTINATION_RE.exec(trimmed);
  if (dest?.[1]) return { filePath: dest[1], final: false };
  const already = ALREADY_RE.exec(trimmed);
  if (already?.[1]) return { filePath: already[1], final: false };
  return undefined;
}

/** Formats a ProgressInfo into a single spinner-friendly line. */
export function formatProgress(info: ProgressInfo): string {
  if (info.percent === undefined) return info.status ?? "downloading...";
  const parts = [`${info.percent.toFixed(1)}%`];
  if (info.speed) parts.push(info.speed);
  if (info.eta) parts.push(`ETA ${info.eta}`);
  return parts.join(" | ");
}
