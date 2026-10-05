/**
 * Adapter over gallery-dl. Handles image galleries and boards
 * (Pinterest, Imgur, Tumblr, DeviantArt, Flickr, ...). Prints one file
 * path per line on stdout, which we use both as progress and result.
 */
import { execa } from "execa";
import { fail, ok, type Result } from "../core/result.js";
import { checkBinary } from "../services/binary.service.js";
import type { Adapter, DownloadedFile, DownloadOptions } from "./types.js";

const KNOWN_HOSTS = [
  "pinterest.com",
  "br.pinterest.com",
  "pin.it",
  "imgur.com",
  "tumblr.com",
  "deviantart.com",
  "flickr.com",
  "artstation.com",
  "danbooru.donmai.us",
];

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export const galleryDlAdapter: Adapter = {
  name: "gallery-dl",
  kind: "image",

  matches(url: URL): boolean {
    return KNOWN_HOSTS.some((d) => hostMatches(url.hostname, d));
  },

  async download(url: URL, opts: DownloadOptions): Promise<Result<DownloadedFile[]>> {
    const bin = await checkBinary("gallery-dl");
    if (!bin.ok) return bin;

    const args = [url.href, "-d", opts.outputDir];
    if (opts.cookiesFromBrowser) args.push("--cookies-from-browser", opts.cookiesFromBrowser);

    const files: string[] = [];
    try {
      const subprocess = execa("gallery-dl", args);
      subprocess.stdout?.on("data", (chunk: Buffer) => {
        for (const rawLine of chunk.toString().split(/\r?\n/)) {
          // gallery-dl prints each written file path; "# path" = skipped (exists)
          const line = rawLine.replace(/^#\s*/, "").trim();
          if (line.length === 0) continue;
          files.push(line);
          opts.onProgress?.({ status: `${files.length} file(s) — ${line}` });
        }
      });
      await subprocess;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fail(
        "GALLERYDL_FAILED",
        `gallery-dl exited with an error for ${url.href}`,
        message.split(/\r?\n/).find((l) => l.includes("error"))?.trim(),
      );
    }

    return ok(files.map((filePath) => ({ filePath })));
  },
};
