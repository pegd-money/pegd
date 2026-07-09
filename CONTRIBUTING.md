# Contributing to Pegd

Thanks for taking the time to contribute. This document describes how to set up a development environment, how the codebase is laid out, and what we expect from a change before it lands on `main`.

## Repository Layout

- `programs/pegd_issuance` -- Anchor program: issuance vault, register/deposit/mint/burn/pause, Proof-of-Reserve attestation.
- `programs/pegd_compliance_hook` -- Optional Token-2022 transfer hook program with an allowlist state.
- `ts/issuance-core` -- Collateral mode logic and issuance/burn quote math.
- `ts/risk-module` -- Ratio thresholds, circuit breaker, and liquidation planner.
- `ts/yield-engine` -- Token-2022 interest-bearing extension wrappers and accrual math.
- `ts/sdk` -- The `@pegd/sdk` TypeScript client with `PegdIssuer`.
- `ts/cli` -- The `pegd` command line front-end.
- `docs/` -- Architecture, issuance spec, PoR spec, and security notes.
- `tests/` -- Anchor integration test surface (`ts-mocha` driven).

## Development Environment

You will need:

- Rust `1.79` or newer with the `wasm32-unknown-unknown` target if you plan to build interfaces.
- Solana toolchain `1.18` (`solana --version`).
- Anchor CLI `0.31.1`.
- Node `20+` and `pnpm 9+` (`corepack enable pnpm`).
- `git` with commit signing enabled if you have a GPG or SSH signing key.

Bootstrap the workspace:

```bash
git clone https://github.com/pegd-money/pegd
cd pegd
pnpm install
cargo check --workspace
```

## Building and Testing

TypeScript packages:

```bash
pnpm -r --parallel typecheck
pnpm -r --parallel build
```

Rust programs (host build, no on-chain deploy):

```bash
cargo check --workspace
cargo fmt --check
```

Anchor integration tests (requires a local validator):

```bash
anchor build
anchor test
```

## Coding Guidelines

- Rust: follow `cargo fmt` and `cargo clippy -- -D warnings`. Prefer `Result` returns and explicit errors from `PegdError` over `unwrap`.
- TypeScript: no `any` outside of Anchor `Program<any>` bindings that require dynamic account access. Prefer `BN` for on-chain amounts.
- No new placeholder markers (`TODO: implement later`, `unimplemented!()`, empty function bodies) in `main`. Ship real code or open a tracking issue instead.

## Pull Requests

- Branch from `main` and keep pull requests focused. One conceptual change per PR.
- Include a short description of what changed and why. If the change touches on-chain accounts or invariants, note them explicitly.
- Add or update tests where a new invariant is introduced.
- Commit messages are natural-language sentences (no `feat:`, `fix:`, or other Conventional Commits prefixes).
- Sign your commits if you can (`git commit -S`). Unsigned commits are still accepted for now.

## Reporting Bugs

For security-sensitive issues follow `SECURITY.md` instead of opening a public issue. For everything else, an issue with a minimal reproduction is the fastest path to a fix.

## License

By contributing you agree that your work is licensed under the MIT license shipped with this repository.
