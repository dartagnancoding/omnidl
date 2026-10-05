/**
 * Detects whether required external binaries (yt-dlp, ffmpeg,
 * gallery-dl) are available on PATH, with actionable install hints.
 */
import { execa } from "execa";
import { fail, ok, type Result } from "../core/result.js";

export type BinaryName = "yt-dlp" | "ffmpeg" | "gallery-dl";

const INSTALL_HINTS: Record<BinaryName, string> = {
  "yt-dlp":
    "Install with: winget install yt-dlp.yt-dlp  (or: pip install -U yt-dlp)",
  ffmpeg:
    "Install with: winget install Gyan.FFmpeg  (or download from https://ffmpeg.org)",
  "gallery-dl":
    "Install with: pip install -U gallery-dl  (or: winget install mikf.gallery-dl)",
};

const VERSION_FLAG: Record<BinaryName, string> = {
  "yt-dlp": "--version",
  ffmpeg: "-version",
  "gallery-dl": "--version",
};

// Cache per process: binary availability doesn't change mid-run.
const cache = new Map<BinaryName, Result<string>>();

/**
 * Checks that a binary is on PATH by invoking its version flag.
 * Returns the version string on success.
 */
export async function checkBinary(name: BinaryName): Promise<Result<string>> {
  const cached = cache.get(name);
  if (cached) return cached;

  let result: Result<string>;
  try {
    const { stdout } = await execa(name, [VERSION_FLAG[name]]);
    result = ok(stdout.split("\n")[0]?.trim() ?? "unknown");
  } catch {
    result = fail(
      "BINARY_NOT_FOUND",
      `'${name}' was not found on PATH.`,
      INSTALL_HINTS[name],
    );
  }
  cache.set(name, result);
  return result;
}

/** Convenience: checks several binaries and returns the failures. */
export async function checkBinaries(names: BinaryName[]): Promise<Result<string>[]> {
  return Promise.all(names.map((n) => checkBinary(n)));
}
