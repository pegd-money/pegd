import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { CollateralMode, quoteIssuance } from '@pegd/issuance-core';
import { CircuitBreaker, classifyRatio } from '@pegd/risk-module';
import type {
  PegdIssuerConfig,
  RegisterStableParams,
  ReserveSnapshot,
} from './types.js';

const STABLECOIN_META_SEED = Buffer.from('stable_meta');
const VAULT_STATE_SEED = Buffer.from('vault_state');
const ATTESTATION_SEED = Buffer.from('reserve_attestation');
const CONFIG_SEED = Buffer.from('pegd_config');

export class PegdIssuer {
  readonly programId: PublicKey;
  readonly provider: AnchorProvider;
  readonly breaker: CircuitBreaker;

  constructor(
    connection: Connection,
    wallet: Wallet,
    private readonly config: PegdIssuerConfig,
  ) {
    this.programId = config.programId;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    this.breaker = new CircuitBreaker();
  }

  configPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([CONFIG_SEED], this.programId);
  }

  stableMetaPda(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [STABLECOIN_META_SEED, mint.toBuffer()],
      this.programId,
    );
  }

  vaultStatePda(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [VAULT_STATE_SEED, mint.toBuffer()],
      this.programId,
    );
  }

  attestationPda(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [ATTESTATION_SEED, mint.toBuffer()],
      this.programId,
    );
  }

  quoteMint(params: {
    mode: CollateralMode;
    collateralValueUsd: BN;
    targetIssuanceUsd: BN;
  }) {
    return quoteIssuance(params);
  }

  assessRatio(ratioBps: number, nowSec: number) {
    const zone = classifyRatio(ratioBps);
    const state = this.breaker.checkRatio(ratioBps, nowSec);
    return { zone, breaker: state };
  }

  buildRegisterStableIx(
    stableMint: PublicKey,
    issuer: PublicKey,
    params: RegisterStableParams,
  ): TransactionInstruction {
    const [meta] = this.stableMetaPda(stableMint);
    const [config] = this.configPda();
    const data = encodeRegisterStable(params);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: config, isSigner: false, isWritable: true },
        { pubkey: meta, isSigner: false, isWritable: true },
        { pubkey: stableMint, isSigner: false, isWritable: true },
        { pubkey: issuer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  async fetchReserveSnapshot(stableMint: PublicKey): Promise<ReserveSnapshot | null> {
    const [attestationPda] = this.attestationPda(stableMint);
    const accountInfo = await this.provider.connection.getAccountInfo(attestationPda);
    if (!accountInfo) return null;
    return decodeAttestation(stableMint, accountInfo.data, accountInfo.owner);
  }

  cluster(): string {
    return this.config.cluster;
  }
}

function encodeRegisterStable(params: RegisterStableParams): Buffer {
  const nameBuf = Buffer.from(params.name.padEnd(32, '\0').slice(0, 32));
  const symbolBuf = Buffer.from(params.symbol.padEnd(8, '\0').slice(0, 8));
  const pegBuf = Buffer.from(params.pegCurrency.padEnd(8, '\0').slice(0, 8));
  const numeric = Buffer.alloc(1 + 4 + 4 + 1);
  numeric.writeUInt8(collateralModeToU8(params.collateralMode), 0);
  numeric.writeUInt32LE(params.minRatioBps, 1);
  numeric.writeUInt32LE(params.yieldRateBps, 5);
  numeric.writeUInt8(params.enableComplianceHook ? 1 : 0, 9);
  const discriminator = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
  return Buffer.concat([discriminator, nameBuf, symbolBuf, pegBuf, numeric]);
}

function collateralModeToU8(mode: CollateralMode): number {
  switch (mode) {
    case CollateralMode.OvercollateralizedCrypto:
      return 0;
    case CollateralMode.AttestedFiat:
      return 1;
    case CollateralMode.RwaBacked:
      return 2;
  }
}

function decodeAttestation(
  stableMint: PublicKey,
  data: Buffer,
  _owner: PublicKey,
): ReserveSnapshot {
  const offset = 8;
  const totalSupplyRaw = data.readBigUInt64LE(offset);
  const reserveValueUsdE6 = data.readBigUInt64LE(offset + 8);
  const ratioBps = data.readUInt32LE(offset + 16);
  const updatedSlot = Number(data.readBigUInt64LE(offset + 20));
  return {
    stableMint,
    totalSupplyRaw,
    reserveValueUsdE6,
    ratioBps,
    updatedSlot,
  };
}
