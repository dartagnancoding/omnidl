/**
 * Filesystem helpers: directory creation, filename sanitization and
 * concurrency-limited task pooling for batch downloads.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

/** Characters invalid on Windows filesystems (superset of POSIX). */
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Sanitizes a string for use as a filename component: strips invalid
 * characters, collapses whitespace and trims trailing dots/spaces
 * (which Windows silently drops).
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/\s+/g, " ") // collapse first so tabs/newlines become spaces, not "_"
    .replace(INVALID_CHARS, "_")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned.length > 0 ? cleaned : "untitled";
}

/** Ensures a directory exists (mkdir -p). */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Resolves a user-typed path like `cd` would: absolute input is used
 * as-is, relative input (including "..") is resolved against `base`
 * instead of `process.cwd()`. Lets a folder prompt whose default is
 * e.g. `.../omnidl/images` accept ".." to reach `.../omnidl` and
 * "../boards" to land on a sibling folder, regardless of where the
 * command was launched from.
 */
export function resolvePathLike(base: string, input: string): string {
  const trimmed = input.trim();
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(base, trimmed);
}

/**
 * Runs `worker` over `items` with at most `limit` tasks in flight.
 * Rejections are captured per item and returned, never thrown, so one
 * failed download doesn't abort the batch.
 */
export async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function lane(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      try {
        results[index] = { status: "fulfilled", value: await worker(item, index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: lanes }, () => lane()));
  return results;
}
