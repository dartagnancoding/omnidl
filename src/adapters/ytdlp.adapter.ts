/**
 * Adapter over yt-dlp. Handles video platforms (YouTube, Twitter/X,
 * TikTok, Instagram, Facebook, Reddit, Twitch, Vimeo, ...) plus audio
 * extraction to mp3. Also used as the router's last-resort fallback,
 * since yt-dlp supports ~1800 sites.
 */
import { execa } from "execa";
import path from "node:path";
import { fail, ok, type Result } from "../core/result.js";
import { checkBinary } from "../services/binary.service.js";
import {
  parseYtDlpDestination,
  parseYtDlpProgress,
} from "../services/progress.service.js";
import type { Adapter, DownloadedFile, DownloadOptions } from "./types.js";

/** Domains yt-dlp is the first choice for (fallback covers the rest). */
const KNOWN_HOSTS = [
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "reddit.com",
  "twitch.tv",
  "vimeo.com",
  "dailymotion.com",
  "soundcloud.com",
];

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Builds the -f expression from the quality cap, unless a raw format was given. */
function formatArgs(opts: DownloadOptions): string[] {
  if (opts.format) return ["-f", opts.format];
  if (opts.audioOnly || opts.quality === "best") return [];
  const height = Number(opts.quality);
  if (!Number.isFinite(height)) return [];
  // Trailing "/best" fallback: some sources (Instagram's DASH formats)
  // don't expose height metadata, so the height filter matches nothing
  // and yt-dlp would otherwise fail with "Requested format is not available".
  return ["-f", `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`];
}

export const ytDlpAdapter: Adapter = {
  name: "yt-dlp",
  kind: "video",

  matches(url: URL): boolean {
    return KNOWN_HOSTS.some((d) => hostMatches(url.hostname, d));
  },

  async download(url: URL, opts: DownloadOptions): Promise<Result<DownloadedFile[]>> {
    const bin = await checkBinary("yt-dlp");
    if (!bin.ok) return bin;

    if (opts.audioOnly) {
      // mp3 conversion needs ffmpeg; fail early with a clear message
      const ffmpeg = await checkBinary("ffmpeg");
      if (!ffmpeg.ok) return ffmpeg;
    }

    const args = [
      url.href,
      "--newline", // one progress update per line -> parseable
      "-o",
      path.join(opts.outputDir, "%(title)s [%(id)s].%(ext)s"),
      "--windows-filenames",
      // Sources like Twitter/X have no real "title" and fall back to the
      // full post text, which can blow past Windows' MAX_PATH; cap it.
      "--trim-filenames",
      "120",
      ...formatArgs(opts),
    ];
    if (opts.audioOnly) {
      args.push("-x", "--audio-format", "mp3");
    } else {
      // Normalize video output to mp4 regardless of the source's native
      // container (YouTube often serves webm) — remux is lossless/fast.
      args.push("--merge-output-format", "mp4", "--remux-video", "mp4");
    }
    if (opts.cookiesFromBrowser) args.push("--cookies-from-browser", opts.cookiesFromBrowser);

    const destinations: string[] = [];
    let finalFile: string | undefined;

    try {
      const subprocess = execa("yt-dlp", args, { all: true });
      subprocess.all?.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          const progress = parseYtDlpProgress(line);
          if (progress) opts.onProgress?.(progress);
          const dest = parseYtDlpDestination(line);
          if (dest) {
            if (dest.final) finalFile = dest.filePath;
            else destinations.push(dest.filePath);
          }
        }
      });
      await subprocess;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        "YTDLP_FAILED",
        `yt-dlp exited with an error for ${url.href}`,
        firstErrorLine(message),
      );
    }

    const files = finalFile ? [finalFile] : destinations;
    return ok(files.map((filePath) => ({ filePath })));
  },
};

/** Picks the most informative "ERROR:" line out of yt-dlp's output. */
function firstErrorLine(output: string): string | undefined {
  return output.split(/\r?\n/).find((l) => l.includes("ERROR:"))?.trim();
}
