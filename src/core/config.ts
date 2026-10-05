/**
 * Persisted user configuration, stored as JSON under
 * `~/.config/omnidl/config.json` (all platforms — keeps one predictable
 * location instead of three OS-specific ones).
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

export const ConfigSchema = z.object({
  /** Destination directory for video downloads. */
  videoDir: z.string().min(1),
  /** Destination directory for audio (mp3) downloads. */
  audioDir: z.string().min(1),
  /** Destination directory for image/gallery downloads. */
  imageDir: z.string().min(1),
  /** Max simultaneous downloads in batch mode. */
  concurrency: z.number().int().min(1).max(8),
  /**
   * Browser to read session cookies from by default (empty = none).
   * Instagram and X/Twitter now require an authenticated session for
   * most video extraction, even on public content.
   */
  cookiesFromBrowser: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_DIR = path.join(os.homedir(), ".config", "omnidl");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/** Returns the absolute path of the config file (for `omnidl config path`). */
export function configFilePath(): string {
  return CONFIG_FILE;
}

/** Built-in defaults, rooted at the user's Downloads folder. */
export function defaultConfig(): Config {
  const base = path.join(os.homedir(), "Downloads", "omnidl");
  return {
    videoDir: path.join(base, "video"),
    audioDir: path.join(base, "audio"),
    imageDir: path.join(base, "images"),
    concurrency: 2,
    cookiesFromBrowser: "",
  };
}

/**
 * Loads config from disk, merging over defaults. Unknown or invalid
 * fields are discarded field-by-field so a partially corrupt file
 * degrades gracefully instead of crashing the CLI.
 */
export async function loadConfig(): Promise<Config> {
  const defaults = defaultConfig();
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {
    return defaults; // missing or unreadable file -> defaults
  }
  const parsed = ConfigSchema.partial().safeParse(raw);
  if (!parsed.success) return defaults;
  return { ...defaults, ...parsed.data };
}

/** Persists the full config, creating the directory if needed. */
export async function saveConfig(config: Config): Promise<void> {
  ConfigSchema.parse(config); // fail fast on programmer error
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
}
