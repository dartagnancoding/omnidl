/**
 * The `download` command (also the default command). Accepts a single
 * URL, a batch .txt file, or no argument at all — in which case it
 * drops into interactive mode.
 */
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { MediaKind } from "../../adapters/types.js";
import { loadConfig, type Config } from "../../core/config.js";
import { route } from "../../core/router.js";
import { resolveCookiesFromBrowser } from "../../services/browser-cookies.service.js";
import { ensureDir, resolvePathLike, runPool } from "../../services/fs.service.js";
import { formatProgress } from "../../services/progress.service.js";

export interface DownloadCliOptions {
  output?: string;
  audioOnly?: boolean;
  quality: string;
  format?: string;
  batch?: string;
  concurrency?: string;
  cookiesFromBrowser?: string;
}

/** Picks the destination dir: explicit flag > config dir per media kind. */
function resolveOutputDir(kind: MediaKind, audioOnly: boolean, config: Config, explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (audioOnly) return config.audioDir;
  return kind === "image" ? config.imageDir : config.videoDir;
}

/** Downloads one URL; returns true on success. */
async function downloadOne(rawUrl: string, opts: DownloadCliOptions, config: Config): Promise<boolean> {
  const routed = route(rawUrl);
  if (!routed.ok) {
    console.error(chalk.red(`✖ ${routed.error.message}`));
    if (routed.error.hint) console.error(chalk.dim(`  ${routed.error.hint}`));
    return false;
  }

  const { adapter, isFallback } = routed.value;
  if (isFallback) {
    console.log(chalk.yellow(`Nenhum adapter específico para este domínio — tentando com ${adapter.name} mesmo assim.`));
  }

  const audioOnly = opts.audioOnly ?? false;
  const outputDir = resolveOutputDir(adapter.kind, audioOnly, config, opts.output);
  await ensureDir(outputDir);

  // Explicit --cookies-from-browser wins; otherwise fall back to the
  // persisted default (e.g. "zen") so it doesn't need to be typed every time.
  const cookiesRequested = opts.cookiesFromBrowser || (config.cookiesFromBrowser || undefined);
  let cookiesFromBrowser: string | undefined;
  if (cookiesRequested) {
    const resolved = await resolveCookiesFromBrowser(cookiesRequested);
    if (resolved.ok) {
      cookiesFromBrowser = resolved.value;
    } else {
      console.log(chalk.yellow(`⚠ ${resolved.error.message}`));
      if (resolved.error.hint) console.log(chalk.dim(`  ${resolved.error.hint}`));
    }
  }

  const spinner = ora(`${adapter.name} → ${rawUrl}`).start();
  const result = await adapter.download(new URL(rawUrl.trim()), {
    outputDir,
    audioOnly,
    quality: opts.quality,
    format: opts.format,
    cookiesFromBrowser,
    onProgress: (info) => {
      spinner.text = `${adapter.name} → ${formatProgress(info)}`;
    },
  });

  if (!result.ok) {
    spinner.fail(chalk.red(result.error.message));
    if (result.error.hint) console.error(chalk.dim(`  ${result.error.hint}`));
    return false;
  }

  const count = result.value.length;
  spinner.succeed(
    count > 0
      ? `${count} arquivo(s) salvo(s) em ${chalk.cyan(outputDir)}`
      : `Concluído (nada novo para baixar) — ${chalk.cyan(outputDir)}`,
  );
  for (const file of result.value.slice(0, 10)) {
    console.log(chalk.dim(`  ${file.filePath}`));
  }
  if (count > 10) console.log(chalk.dim(`  ... e mais ${count - 10}`));
  return true;
}

/** Reads a batch file: one URL per line, '#' starts a comment. */
async function readBatchFile(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/** Interactive mode: prompts for URL and options when none were given. */
async function promptInteractive(opts: DownloadCliOptions, config: Config): Promise<{ url: string; opts: DownloadCliOptions }> {
  const url = await input({
    message: "URL para baixar:",
    validate: (v) => (route(v).ok ? true : "Digite uma URL http(s) válida"),
  });

  // Image URLs (Pinterest etc.) go straight through gallery-dl — no
  // mp4/mp3 choice applies, so skip that prompt entirely.
  const routed = route(url);
  const isImage = routed.ok && routed.value.adapter.kind === "image";

  let audioOnly = false;
  let quality = opts.quality;
  if (!isImage) {
    const format = await select({
      message: "Formato:",
      choices: [
        { name: "Vídeo (mp4)", value: "video" },
        { name: "Áudio (mp3)", value: "audio" },
      ],
    });
    audioOnly = format === "audio";
    if (!audioOnly) {
      quality = await select({
        message: "Qualidade máxima:",
        choices: ["best", "1080", "720", "480"].map((q) => ({ value: q })),
        default: opts.quality,
      });
    }
  }

  const defaultDir = isImage ? config.imageDir : audioOnly ? config.audioDir : config.videoDir;
  // Relative input (e.g. "..", "../boards") is resolved against the
  // default dir shown above, like `cd`, not against the shell's cwd.
  const typedOutput = await input({ message: "Pasta de destino:", default: opts.output ?? defaultDir });
  const output = resolvePathLike(defaultDir, typedOutput);
  return { url, opts: { ...opts, audioOnly, quality, output } };
}

/** Entry point wired into commander. */
export async function runDownload(rawUrl: string | undefined, opts: DownloadCliOptions): Promise<void> {
  const config = await loadConfig();

  // Batch mode: file with one URL per line, limited-concurrency pool
  if (opts.batch) {
    const urls = await readBatchFile(opts.batch);
    if (urls.length === 0) {
      console.error(chalk.yellow("O arquivo de batch não tem nenhuma URL."));
      process.exitCode = 1;
      return;
    }
    const concurrency = opts.concurrency ? Number(opts.concurrency) : config.concurrency;
    console.log(chalk.cyan(`Batch: ${urls.length} URL(s), concorrência ${concurrency}\n`));
    let failures = 0;
    await runPool(urls, concurrency, async (url) => {
      const okResult = await downloadOne(url, opts, config);
      if (!okResult) failures++;
    });
    console.log(
      failures === 0
        ? chalk.green(`\nTodos os ${urls.length} download(s) concluídos.`)
        : chalk.yellow(`\n${urls.length - failures}/${urls.length} concluídos, ${failures} falharam.`),
    );
    if (failures > 0) process.exitCode = 1;
    return;
  }

  // Interactive mode when no URL was passed
  let url = rawUrl;
  let effectiveOpts = opts;
  if (!url) {
    const answers = await promptInteractive(opts, config);
    url = answers.url;
    effectiveOpts = answers.opts;
  }

  const success = await downloadOne(url, effectiveOpts, config);
  if (!success) process.exitCode = 1;
}
