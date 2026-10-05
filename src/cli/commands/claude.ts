/**
 * The `claude` command: launches the Claude Code CLI in a given
 * directory (default: the current working directory) without having
 * to `cd` there first.
 */
import { execa } from "execa";
import chalk from "chalk";
import path from "node:path";

/** Runs `claude` with the terminal handed over (stdio inherited). */
export async function runClaude(dir: string | undefined): Promise<void> {
  const cwd = dir ? path.resolve(dir) : process.cwd();

  try {
    await execa("claude", [], { cwd, stdio: "inherit" });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { exitCode?: number };
    if (err.code === "ENOENT") {
      console.error(chalk.red("'claude' não foi encontrado no PATH."));
      console.error(chalk.dim("  Instale com: npm install -g @anthropic-ai/claude-code"));
      process.exitCode = 1;
      return;
    }
    // Claude Code forwards its own exit code (e.g. Ctrl+C) here — that's
    // not an omnidl failure, just pass it through instead of throwing.
    if (typeof err.exitCode === "number") {
      process.exitCode = err.exitCode;
      return;
    }
    throw error;
  }
}
