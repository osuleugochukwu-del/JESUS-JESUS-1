# Trade Avata cTrader Gateway — deploy-ready server

This folder is the secure server-side half of the live feed. It is shaped for a container service such as Google Cloud Run. The website never needs the cTrader Client Secret.

## Required environment values

- `CTRADER_CLIENT_ID` — cTrader Open API application Client ID.
- `CTRADER_CLIENT_SECRET` — cTrader Open API application secret. Keep only in the cloud secret store.
- `CTRADER_REDIRECT_URI` — exact approved callback page, e.g. `https://YOUR-SITE/ctrader-callback.html`.
- `CTRADER_PUBLIC_ACCESS_TOKEN` — initial token for the dedicated Trade Avata market-feed account.
- `CTRADER_PUBLIC_REFRESH_TOKEN` — strongly recommended; enables automatic long-term token refresh without editing code.
- `CTRADER_PUBLIC_ACCOUNT_ID` — cTID trader account ID used for the shared public market feed.
- `CTRADER_PUBLIC_ENV` — `demo` while testing, `live` when approved/ready.
- `CTRADER_TOKEN_ENCRYPTION_KEY` — 32 random bytes encoded in base64, used to encrypt cTrader tokens before server-side Firestore storage.
- `FIREBASE_PROJECT_ID=trade-avata`
- `TRADE_AVATA_ORIGIN` — comma-separated exact public Trade Avata origins for CORS/WebSocket origin checking. Production fails closed if omitted.
- `TRADE_AVATA_OWNER_UID` — optional Firebase UID that receives the server-issued Owner custom claim during secure account bootstrap.
- Optional safety limits: `TRADE_AVATA_MAX_WS_CLIENTS`, `TRADE_AVATA_MAX_WS_PER_IP`, `TRADE_AVATA_MAX_SUBSCRIPTIONS`, `TRADE_AVATA_MAX_WS_MESSAGE_BYTES`.
- Optional `CTRADER_SYMBOL_ALIASES` JSON, e.g. `{"NAS100":"USTEC"}` if a broker uses different symbol names.

## What it already does

- Maintains no more than one upstream connection per cTrader environment inside an instance and multiplexes website users over it.
- Sends the cTrader heartbeat every 10 seconds.
- Reconnects upstream and restores public symbol subscriptions automatically.
- Authenticates the Open API application server-side.
- Uses one dedicated cTrader account for the shared public market feed.
- Persists refreshed public tokens encrypted so a container restart does not discard the latest token pair.
- Resolves broker symbol IDs and supports alias mapping.
- Uses historical trendbars for supported timeframes.
- Uses actual historical bid ticks for sub-minute/tick/Renko/range history rather than invented candles.
- Pages tick history conservatively to respect historical-request limits.
- Streams live spot prices and builds current Trade Avata bars in memory.
- Sends normalized `history`, `bar`, and `quote` messages to browsers.
- Implements Firebase-protected cTrader OAuth start/complete/disconnect endpoints.
- Encrypts personal access/refresh tokens before Firestore storage.
- Refreshes personal cTrader tokens when they approach expiry.
- Sends personal account balance/equity, unrealized P&L, positions, orders and deal history.
- Watches cTrader execution/trader events and pushes journal-ready `trade-event` updates, then refreshes account/position/order snapshots.
- Restricts protected account access by verified Firebase UID, not TA ID or editable browser role state.

## Local check

```bash
npm install
npm test
npm start
```

## Container deployment

Build this folder using the included `Dockerfile`. Put sensitive values in your cloud provider's Secret Manager/environment configuration, not in GitHub.

After deployment, the website needs only the gateway's public HTTPS address in `src/live-ready-config.js`.

## Trade Avata identity bootstrap

The gateway now exposes Firebase-protected `POST /api/account/bootstrap`. It reserves a unique permanent `TA-########` identifier transactionally in Firestore and writes it to `users/{uid}.taId`. The browser cannot mint or change this ID.

Owner authority is never accepted from a browser email or editable role. Configure `TRADE_AVATA_OWNER_UID` on the backend, or run inside the deployed/admin-authenticated environment:

```bash
npm run bootstrap:owner -- --uid=FIREBASE_UID
# or
npm run bootstrap:owner -- --email=owner@example.com
```

After the claim is set, sign out/in or refresh the Firebase ID token.

## OAuth and connection hardening

- cTrader authorization uses a 32-byte one-time OAuth `state` stored server-side as a SHA-256 hash and consumed once.
- Production origin handling is fail-closed.
- HTTP OAuth/bootstrap endpoints are rate-limited per IP.
- WebSocket payload size, total connections, per-IP connections, per-client subscriptions and message rate are bounded.
