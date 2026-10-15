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
- `POST /api/reviews` stores an evidence-backed review in Supabase and invalidates the wallet score cache.
- `GET/POST /api/profile` attaches public display name, X handle, bio, and PFP context to a wallet.
- `GET/POST /api/index/kolscan` imports the current Kolscan leaderboard wallet, PNL, X, name, and PFP records into the REP index.
- Wallet snapshots, the five latest transactions, score indicators, and score events are designed to be indexed in Supabase rather than recomputed on every page view.
- The profile page refreshes on a 20-second live loop so new reviews and score changes appear without a hard refresh.
- Apply `supabase/migrations/20261015_rep.sql` to create the REP wallet, profile, transaction-cache, and review tables.

Cielo, Supabase, and SVS credentials are server-only environment variables. Use `.env.example` as the deployment checklist. The score is intentionally explainable: win rate, PNL, trade sample, positive signals, and warnings are shown as separate indicators rather than hidden in a black box.
