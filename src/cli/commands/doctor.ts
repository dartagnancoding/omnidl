/**
 * The `doctor` command: checks that required external binaries are on
 * PATH. Shared between the flag-based `omnidl doctor` invocation and
 * the interactive main menu.
 */
import chalk from "chalk";
import { checkBinaries, type BinaryName } from "../../services/binary.service.js";

const BINARIES: BinaryName[] = ["yt-dlp", "ffmpeg", "gallery-dl"];

/** Returns true when every required binary was found. */
export async function runDoctor(): Promise<boolean> {
  const results = await checkBinaries(BINARIES);
  let allOk = true;
  results.forEach((result, i) => {
    const name = BINARIES[i] as BinaryName;
    if (result.ok) {
      console.log(`${chalk.green("✔")} ${name} ${chalk.dim(result.value)}`);
    } else {
      allOk = false;
      console.log(`${chalk.red("✖")} ${name} — não encontrado`);
      if (result.error.hint) console.log(chalk.dim(`  ${result.error.hint}`));
    }
  });
  return allOk;
}
