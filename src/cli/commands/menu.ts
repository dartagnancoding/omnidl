/**
 * Interactive main menu shown when `omnidl` is run with zero arguments.
 * Lets the user download media, change the default destination folders
 * (or any other setting) and check the installation, all without
 * needing to remember flag syntax.
 */
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { loadConfig, saveConfig, type Config } from "../../core/config.js";
import { resolvePathLike } from "../../services/fs.service.js";
import { runClaude } from "./claude.js";
import { runDoctor } from "./doctor.js";
import { runDownload } from "./download.js";

type DirKey = "videoDir" | "audioDir" | "imageDir";

const DIR_LABELS: Record<DirKey, string> = {
  videoDir: "Pasta padrão de vídeo",
  audioDir: "Pasta padrão de áudio (mp3)",
  imageDir: "Pasta padrão de imagens (Pinterest, galerias)",
};

const COOKIES_CHOICES = [
  { name: "Zen (fork do Firefox)", value: "zen" },
  { name: "Firefox", value: "firefox" },
  { name: "Chrome", value: "chrome" },
  { name: "Edge", value: "edge" },
  { name: "Brave", value: "brave" },
  { name: "Nenhum (desativar)", value: "" },
];

async function settingsMenu(): Promise<void> {
  for (;;) {
    const config = await loadConfig();
    const cookiesLabel = config.cookiesFromBrowser || "nenhum";
    const choice = await select<DirKey | "concurrency" | "cookiesFromBrowser" | "back">({
      message: "O que você quer alterar?",
      choices: [
        { name: `${DIR_LABELS.videoDir} — ${chalk.dim(config.videoDir)}`, value: "videoDir" },
        { name: `${DIR_LABELS.audioDir} — ${chalk.dim(config.audioDir)}`, value: "audioDir" },
        { name: `${DIR_LABELS.imageDir} — ${chalk.dim(config.imageDir)}`, value: "imageDir" },
        {
          name: `Downloads simultâneos em batch — ${chalk.dim(String(config.concurrency))}`,
          value: "concurrency",
        },
        {
          name: `Navegador para login (Instagram/X) — ${chalk.dim(cookiesLabel)}`,
          value: "cookiesFromBrowser",
        },
        { name: "◀ Voltar", value: "back" },
      ],
    });
    if (choice === "back") return;

    if (choice === "concurrency") {
      const value = await input({
        message: "Novo valor (1-8):",
        default: String(config.concurrency),
        validate: (v) => (/^[1-8]$/.test(v.trim()) ? true : "Digite um número inteiro de 1 a 8"),
      });
      await saveConfig({ ...config, concurrency: Number(value.trim()) });
    } else if (choice === "cookiesFromBrowser") {
      const value = await select({
        message: "Ler cookies de qual navegador? (necessário para baixar do Instagram/X hoje em dia)",
        choices: COOKIES_CHOICES,
        default: config.cookiesFromBrowser,
      });
      await saveConfig({ ...config, cookiesFromBrowser: value });
    } else {
      // Relative input (e.g. "..", "../boards") is resolved against the
      // current folder shown above, like `cd`, not against the shell's cwd.
      const value = await input({
        message: `${DIR_LABELS[choice]}: ${chalk.dim("(pode usar caminho relativo, ex: .. ou ../pasta-nova)")}`,
        default: config[choice],
      });
      const updated: Config = { ...config, [choice]: resolvePathLike(config[choice], value) };
      await saveConfig(updated);
    }
    console.log(chalk.green("✔ Configuração salva.\n"));
  }
}

/** Runs the download flow via the same interactive prompts as `omnidl` with no URL. */
async function downloadFlow(): Promise<void> {
  await runDownload(undefined, { quality: "best" });
}

function printHelp(): void {
  console.log(chalk.bold("Como usar o omnidl\n"));
  console.log("Cole a URL de um vídeo (YouTube, Twitter/X, TikTok, Instagram, Facebook,");
  console.log("Reddit, Twitch...) ou de um pin/board do Pinterest — o omnidl detecta a");
  console.log("origem sozinho e escolhe a ferramenta certa (yt-dlp ou gallery-dl).\n");
  console.log(chalk.cyan("Baixar mídia") + "        pede a URL, mp4 ou mp3, qualidade e a pasta de destino");
  console.log(chalk.cyan("                ") + "(já vem preenchida com a pasta padrão, dá pra trocar na hora)");
  console.log(chalk.cyan("Configurar") + "          muda a pasta padrão de vídeo/áudio/imagem, a concorrência do");
  console.log(chalk.cyan("                ") + "batch e o navegador de login — fica salvo para os próximos downloads");
  console.log(
    chalk.dim("                ") +
      "Instagram e X/Twitter hoje exigem sessão logada até em posts públicos;",
  );
  console.log(
    chalk.dim("                ") + "configure o navegador uma vez e todo download usa esses cookies.",
  );
  console.log(chalk.cyan("Verificar instalação") + " confere se yt-dlp, ffmpeg e gallery-dl estão no PATH");
  console.log(chalk.cyan("Abrir Claude Code") + "    abre o Claude Code direto na pasta atual\n");
  console.log(
    chalk.dim("Nas pastas de destino (menu e prompt de download) dá pra usar caminho"),
  );
  console.log(
    chalk.dim('relativo à pasta padrão mostrada, tipo "cd": ".." sobe um nível, "../pasta-nova"'),
  );
  console.log(chalk.dim("cria/usa uma pasta irmã.\n"));
  console.log(chalk.dim("Atalhos para quem preferir linha de comando direta (sem menu):"));
  console.log(chalk.dim('  omnidl "URL"                       baixa direto, sem passar pelo menu'));
  console.log(chalk.dim('  omnidl "URL" --audio-only           baixa e converte para mp3'));
  console.log(chalk.dim('  omnidl "URL" -q 720                 limita a qualidade a 720p'));
  console.log(chalk.dim("  omnidl -b lista.txt -c 3            baixa várias URLs de um arquivo"));
  console.log(chalk.dim('  omnidl config set videoDir "..."    muda a pasta padrão sem abrir o menu'));
  console.log(chalk.dim("  omnidl claude                       abre o Claude Code na pasta atual"));
  console.log(chalk.dim("  omnidl --help                       lista todas as flags disponíveis\n"));
}

/** Top-level menu loop; returns when the user chooses to exit. */
export async function runMainMenu(): Promise<void> {
  console.log(chalk.bold.cyan("omnidl") + chalk.dim(" — baixador de mídia\n"));

  for (;;) {
    const choice = await select<"download" | "settings" | "doctor" | "claude" | "help" | "exit">({
      message: "O que você quer fazer?",
      choices: [
        { name: "Baixar mídia", value: "download" },
        { name: "Configurar pastas padrão / opções", value: "settings" },
        { name: "Verificar instalação (yt-dlp, ffmpeg, gallery-dl)", value: "doctor" },
        { name: "Abrir Claude Code aqui", value: "claude" },
        { name: "Ajuda", value: "help" },
        { name: "Sair", value: "exit" },
      ],
    });

    console.log();
    switch (choice) {
      case "download":
        await downloadFlow();
        break;
      case "settings":
        await settingsMenu();
        break;
      case "doctor":
        await runDoctor();
        break;
      case "claude":
        await runClaude(undefined);
        break;
      case "help":
        printHelp();
        break;
      case "exit":
        return;
    }
    console.log();
  }
}
