import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface PegdConfig {
  rpcUrl: string;
  walletPath: string;
  programId: string | null;
  cluster: 'mainnet-beta' | 'devnet' | 'localnet';
}

const DEFAULT_CONFIG_PATH = join(homedir(), '.pegd', 'config.json');

const DEFAULT_CONFIG: PegdConfig = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  walletPath: join(homedir(), '.config', 'solana', 'id.json'),
  programId: null,
  cluster: 'mainnet-beta',
};

export function configPath(): string {
  return process.env.PEGD_CONFIG ?? DEFAULT_CONFIG_PATH;
}

export function loadConfig(): PegdConfig {
  const path = configPath();
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const raw = readFileSync(path, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(cfg: Partial<PegdConfig>): PegdConfig {
  const merged: PegdConfig = { ...loadConfig(), ...cfg };
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(merged, null, 2));
  return merged;
}
