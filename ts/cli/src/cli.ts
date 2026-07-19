import { Command } from 'commander';
import { issue } from './commands/issue.js';
import { mint } from './commands/mint.js';
import { burn } from './commands/burn.js';
import { reserves } from './commands/reserves.js';
import { por } from './commands/por.js';
import { stress } from './commands/stress.js';
import { loadConfig, saveConfig } from './config.js';

const program = new Command();

program
  .name('pegd')
  .description('Pegd -- Solana stablecoin issuance framework CLI')
  .version('0.1.0');

program
  .command('issue <name>')
  .description('Prepare a new stablecoin issuance plan')
  .requiredOption('--peg <currency>', 'peg currency (e.g. USD, EUR, XAU)')
  .requiredOption('--collateral <mode>', 'collateral mode: crypto | attested | rwa')
  .option('--target <usd>', 'target issuance in USD', '1000')
  .option('--yield-bps <bps>', 'yield rate in basis points', '0')
  .option('--compliance', 'enable Token-2022 compliance transfer hook', false)
  .action(issue);

program
  .command('mint')
  .description('Mint stable tokens against deposited collateral')
  .requiredOption('--mint <pubkey>', 'stablecoin mint address')
  .requiredOption('--amount <n>', 'raw amount to mint')
  .action(mint);

program
  .command('burn')
  .description('Burn stable tokens to reclaim collateral')
  .requiredOption('--mint <pubkey>', 'stablecoin mint address')
  .requiredOption('--amount <n>', 'raw amount to burn')
  .action(burn);

program
  .command('reserves <mint>')
  .description('Query live reserves for a Pegd stablecoin mint')
  .action(reserves);

program
  .command('por <mint>')
  .description('Query the latest Proof-of-Reserve attestation for a mint')
  .action(por);

program
  .command('stress')
  .description('Simulate a peg stress scenario against a collateral position')
  .requiredOption('--mode <mode>', 'crypto | attested | rwa')
  .requiredOption('--collateral <usd>', 'collateral USD value')
  .requiredOption('--issued <usd>', 'issued supply USD value')
  .requiredOption('--shock <pct>', 'downside shock in percent (e.g. 30)')
  .action(stress);

program
  .command('config')
  .description('Show current Pegd CLI config')
  .action(() => {
    console.log(JSON.stringify(loadConfig(), null, 2));
  });

program
  .command('config:set')
  .description('Update Pegd CLI config')
  .option('--rpc <url>')
  .option('--wallet <path>')
  .option('--program-id <id>')
  .option('--cluster <cluster>')
  .action(opts => {
    const patch: Record<string, unknown> = {};
    if (opts.rpc) patch.rpcUrl = opts.rpc;
    if (opts.wallet) patch.walletPath = opts.wallet;
    if (opts.programId) patch.programId = opts.programId;
    if (opts.cluster) patch.cluster = opts.cluster;
    const updated = saveConfig(patch);
    console.log(JSON.stringify(updated, null, 2));
  });

program.parseAsync(process.argv);
