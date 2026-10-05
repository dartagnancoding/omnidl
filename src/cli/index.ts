#!/usr/bin/env node
/**
 * omnidl — media download CLI.
 * Orchestration layer over yt-dlp and gallery-dl: routes a URL to the
 * right tool, manages destinations, progress and batch queues.
 */
import chalk from "chalk";
import { Command } from "commander";
import { runClaude } from "./commands/claude.js";
import { runConfigGet, runConfigList, runConfigPath, runConfigSet } from "./commands/config.js";
import { runDoctor } from "./commands/doctor.js";
import { runDownload, type DownloadCliOptions } from "./commands/download.js";
import { runMainMenu } from "./commands/menu.js";

const program = new Command();

program
  .name("omnidl")
  .description("Baixa mídia do YouTube, Twitter/X, TikTok, Instagram, Pinterest e ~1800 outros sites.\nSem argumentos, abre o menu interativo.")
  .version("0.1.0");

program
  .command("download", { isDefault: true })
  .description("Baixa mídia a partir de uma URL (comando padrão; interativo se a URL for omitida)")
  .argument("[url]", "URL da mídia (omita para modo interativo)")
  .option("-o, --output <dir>", "pasta de destino (sobrepõe a config)")
  .option("-a, --audio-only", "extrai o áudio e converte para mp3")
  .option("-q, --quality <q>", "altura máxima do vídeo: best|1080|720|480|360", "best")
  .option("-f, --format <fmt>", "expressão de formato crua do yt-dlp (sobrepõe --quality)")
  .option("-b, --batch <file>", "arquivo de texto com uma URL por linha (# para comentários)")
  .option("-c, --concurrency <n>", "downloads paralelos no modo batch (sobrepõe a config)")
  .option("--cookies-from-browser <browser>", "lê cookies de sessão de um browser (chrome|firefox|edge...) — necessário para boards/contas privadas")
  .action(async (url: string | undefined, opts: DownloadCliOptions) => {
    await runDownload(url, opts);
  });

const config = program.command("config").description("Gerencia a configuração persistida (pastas padrão, concorrência)");
config.command("list").description("Mostra todas as configurações").action(runConfigList);
config.command("get <key>").description("Mostra uma configuração").action(runConfigGet);
config.command("set <key> <value>").description("Altera uma configuração").action(runConfigSet);
config.command("path").description("Mostra o caminho do arquivo de configuração").action(runConfigPath);

program
  .command("claude [dir]")
  .description("Abre o Claude Code direto numa pasta (padrão: pasta atual)")
  .action(async (dir: string | undefined) => {
    await runClaude(dir);
  });

program
  .command("doctor")
  .description("Verifica se os binários externos necessários (yt-dlp, ffmpeg, gallery-dl) estão instalados")
  .action(async () => {
    const allOk = await runDoctor();
    if (!allOk) process.exitCode = 1;
  });

program.addHelpText(
  "after",
  `
Exemplos:
  $ omnidl                                    Abre o menu interativo
  $ omnidl "https://youtube.com/watch?v=..."  Baixa um vídeo (mp4)
  $ omnidl "..." --audio-only                 Baixa e converte para mp3
  $ omnidl "..." -q 720                       Limita a qualidade a 720p
  $ omnidl -b urls.txt -c 3                   Baixa uma lista de URLs (batch)
  $ omnidl config set videoDir "D:\\Videos"    Muda a pasta padrão de vídeo
  $ omnidl doctor                             Verifica a instalação
  $ omnidl claude                             Abre o Claude Code na pasta atual
  $ omnidl claude D:\\Projetos\\meu-app         Abre o Claude Code numa pasta específica
`,
);

async function main(): Promise<void> {
  // Bare `omnidl` (no flags, no subcommand, no URL) -> friendly menu.
  // Any argument (URL, flag, or subcommand) keeps the direct CLI path.
  if (process.argv.length <= 2) {
    await runMainMenu();
    return;
  }
  await program.parseAsync();
}

main().catch((error: unknown) => {
  // Inquirer throws when the user aborts a prompt with Ctrl+C
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(130);
  }
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
