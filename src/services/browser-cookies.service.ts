/**
 * Resolves a user-facing browser name into the value yt-dlp/gallery-dl
 * expect for --cookies-from-browser. Both tools recognize Chromium-family
 * browsers and Firefox natively, but not Firefox forks like Zen — those
 * need an explicit profile path via the `firefox:<path>` form.
 *
 * Instagram and X/Twitter now require an authenticated session for most
 * video extraction, even on public content, so this is what makes
 * cookiesFromBrowser usable as a persisted default instead of a manual
 * per-download flag.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, ok, type Result } from "../core/result.js";

const ZEN_ALIASES = new Set(["zen", "zen-browser", "zenbrowser"]);

/**
 * Finds Zen's actively-used profile: the one with the most recently
 * modified cookies.sqlite. More robust than parsing profiles.ini (whose
 * section layout varies across Firefox forks) and directly tracks which
 * profile was last used to browse.
 */
async function findZenProfileDir(): Promise<Result<string>> {
  const profilesRoot = path.join(os.homedir(), "AppData", "Roaming", "zen", "Profiles");

  let entries: string[];
  try {
    entries = await fs.readdir(profilesRoot);
  } catch {
    return fail(
      "ZEN_NOT_FOUND",
      "Perfil do Zen Browser não encontrado (esperado em %APPDATA%\\zen\\Profiles).",
      'Zen está instalado? Se estiver em outro local, use --cookies-from-browser "firefox:<caminho-do-perfil>" diretamente.',
    );
  }

  let newest: { dir: string; mtimeMs: number } | undefined;
  for (const entry of entries) {
    const cookiesPath = path.join(profilesRoot, entry, "cookies.sqlite");
    try {
      const stat = await fs.stat(cookiesPath);
      if (!newest || stat.mtimeMs > newest.mtimeMs) {
        newest = { dir: path.join(profilesRoot, entry), mtimeMs: stat.mtimeMs };
      }
    } catch {
      // profile has no cookies.sqlite yet — skip
    }
  }

  if (!newest) {
    return fail(
      "ZEN_NOT_FOUND",
      "Nenhum perfil do Zen com cookies foi encontrado.",
      "Faça login no site pelo menos uma vez no Zen e tente de novo.",
    );
  }
  return ok(newest.dir);
}

/**
 * Resolves a --cookies-from-browser value for yt-dlp/gallery-dl.
 * "zen" is translated to firefox:<profile path>; every other value
 * (chrome, firefox, edge, brave, ...) passes through unchanged since
 * both tools already know how to locate those natively.
 */
export async function resolveCookiesFromBrowser(value: string): Promise<Result<string>> {
  const trimmed = value.trim();
  if (!ZEN_ALIASES.has(trimmed.toLowerCase())) return ok(trimmed);

  const profile = await findZenProfileDir();
  if (!profile.ok) return profile;
  return ok(`firefox:${profile.value}`);
}
