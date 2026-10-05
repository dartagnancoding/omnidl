/**
 * The `config` command: list, get, set and locate the persisted
 * configuration file.
 */
import chalk from "chalk";
import { ConfigSchema, configFilePath, loadConfig, saveConfig, type Config } from "../../core/config.js";

const KEYS = Object.keys(ConfigSchema.shape) as (keyof Config)[];

export async function runConfigList(): Promise<void> {
  const config = await loadConfig();
  for (const key of KEYS) {
    console.log(`${chalk.cyan(key)} = ${config[key]}`);
  }
  console.log(chalk.dim(`\narquivo: ${configFilePath()}`));
}

export async function runConfigGet(key: string): Promise<void> {
  const config = await loadConfig();
  if (!KEYS.includes(key as keyof Config)) {
    console.error(chalk.red(`Chave desconhecida '${key}'. Chaves válidas: ${KEYS.join(", ")}`));
    process.exitCode = 1;
    return;
  }
  console.log(String(config[key as keyof Config]));
}

export async function runConfigSet(key: string, value: string): Promise<void> {
  if (!KEYS.includes(key as keyof Config)) {
    console.error(chalk.red(`Chave desconhecida '${key}'. Chaves válidas: ${KEYS.join(", ")}`));
    process.exitCode = 1;
    return;
  }
  const config = await loadConfig();
  const candidate: Record<string, unknown> = { ...config };
  candidate[key] = key === "concurrency" ? Number(value) : value;

  const parsed = ConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error(chalk.red(`Valor inválido para '${key}': ${issue?.message ?? "falha na validação"}`));
    process.exitCode = 1;
    return;
  }
  await saveConfig(parsed.data);
  console.log(chalk.green(`${key} = ${parsed.data[key as keyof Config]}`));
}

export function runConfigPath(): void {
  console.log(configFilePath());
}
