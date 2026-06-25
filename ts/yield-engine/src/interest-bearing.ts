import {
  createInitializeInterestBearingMintInstruction,
  createUpdateRateInterestBearingMintInstruction,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export interface InitializeInterestBearingParams {
  mint: PublicKey;
  rateAuthority: PublicKey;
  rateBps: number;
}

export function buildInitializeInterestBearingIx(
  params: InitializeInterestBearingParams,
): TransactionInstruction {
  return createInitializeInterestBearingMintInstruction(
    params.mint,
    params.rateAuthority,
    params.rateBps,
    TOKEN_2022_PROGRAM_ID,
  );
}

export interface UpdateRateParams {
  mint: PublicKey;
  rateAuthority: PublicKey;
  newRateBps: number;
}

export function buildUpdateRateIx(params: UpdateRateParams): TransactionInstruction {
  return createUpdateRateInterestBearingMintInstruction(
    params.mint,
    params.rateAuthority,
    params.newRateBps,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
}
