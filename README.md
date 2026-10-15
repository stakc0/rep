# REP

A direct clone of the WRLD/politic launchpad checkout, packaged as `/rep`.

- Homepage: `/`
- Launch: `/launch`
- Docs: `/docs`
- API reads proxy to the public WRLD API origin so live world data and launch configuration remain functional.

The frontend preserves the original ASCII/paper-terminal visual language while REP reframes it as a public reputation layer for pump.fun wallets and traders.

## Wallet intelligence

- `GET /api/wallet?address=<solana-wallet>` fetches the current SOL balance from SVS RPC, the latest five Cielo transactions, performance data, and a transparent REP score.
- `GET /api/reviews?wallet=<solana-wallet>` reads community reviews.
- `POST /api/reviews` stores an evidence-backed review in Supabase.
- Apply `supabase/migrations/20261015_rep.sql` to create the REP wallet and review tables.

Cielo, Supabase, and SVS credentials are server-only environment variables. Use `.env.example` as the deployment checklist. The score is intentionally explainable: win rate, PNL, trade sample, positive signals, and warnings are shown as separate indicators rather than hidden in a black box.
