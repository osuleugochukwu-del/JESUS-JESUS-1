# cTrader live activation — no frontend redesign required

The secure cTrader gateway is included in this package under `gateway/`. The Trade Avata browser already speaks its normalized WebSocket/API contract.

## What remains when cTrader approves Trade Avata

This is configuration/deployment, not another platform redesign:

1. Deploy the included `gateway/` container to an always-on/serverless container service such as Google Cloud Run.
2. Put the cTrader/Firebase secret values into the cloud service's secret/environment settings.
3. Register the exact cTrader redirect URI to the deployed Trade Avata callback page, e.g. `https://YOUR-TRADE-AVATA-SITE/ctrader-callback.html`.
4. In the public website, fill the one non-secret frontend address in `src/live-ready-config.js`:
   `const TRADE_AVATA_BACKEND_HTTP='https://YOUR-SECURE-GATEWAY'`
5. Run the live-ready verifier and activate the deployment.

Do **not** place cTrader Client Secret, access token, refresh token or broker passwords in GitHub Pages.

## Gateway environment values

Required:
- `CTRADER_CLIENT_ID`
- `CTRADER_CLIENT_SECRET`
- `CTRADER_REDIRECT_URI`
- `CTRADER_PUBLIC_ACCOUNT_ID`
- `CTRADER_PUBLIC_ENV=demo` or `live`
- `CTRADER_PUBLIC_ACCESS_TOKEN` for the initial dedicated public-feed account authorization
- `CTRADER_PUBLIC_REFRESH_TOKEN` strongly recommended so the public feed can refresh without code changes
- `CTRADER_TOKEN_ENCRYPTION_KEY` — base64 of exactly 32 random bytes
- `FIREBASE_PROJECT_ID=trade-avata`
- `TRADE_AVATA_ORIGIN` — comma-separated exact allowed origins; production is fail-closed when this is empty
- `TRADE_AVATA_OWNER_UID` — optional Firebase UID used for secure Owner custom-claim bootstrap
- Optional safety limits: `TRADE_AVATA_MAX_WS_CLIENTS`, `TRADE_AVATA_MAX_WS_PER_IP`, `TRADE_AVATA_MAX_SUBSCRIPTIONS`, `TRADE_AVATA_MAX_WS_MESSAGE_BYTES`

Optional:
- `CTRADER_SYMBOL_ALIASES` — JSON mapping when the chosen broker names symbols differently, e.g. `{"NAS100":"USTEC"}`.

The gateway persists refreshed public and personal cTrader tokens encrypted with AES-256-GCM in server-side Firestore collections. Client Firestore rules do not grant browsers access to these server token records.

## Public market-feed route

The hot path is intentionally short:

`cTrader → Trade Avata gateway memory → WebSocket → browser memory → existing native Trade Avata chart`

Firestore is not placed in the per-tick price path.

The gateway:
- keeps a shared public cTrader market connection rather than creating one upstream connection per website visitor;
- restores public subscriptions after an upstream cTrader reconnect;
- pages historical tick data conservatively;
- uses cTrader trendbars for supported timeframes and actual historical ticks for seconds/tick/Renko/range construction;
- streams live quotes and updates the current Trade Avata bar in memory;
- sends honest LIVE/CONNECTING/RECONNECTING/OFFLINE/NOT CONFIGURED states.

## Browser ↔ gateway market messages

Browser messages include:
- `subscribe` with symbol + Trade Avata period object
- `unsubscribe`
- `ping`
- authenticated `auth` with the current Firebase ID token for personal-account data

Gateway messages include:
- `status`
- `history`
- `bar`
- `quote`
- `account`
- `account-status`
- `positions`
- `orders`
- `trade-history`
- `trade-event`

The existing chart adapter already consumes these normalized messages.

## Personal cTrader authorization

The existing **Connect cTrader** workflow calls the secure gateway at `/api/ctrader/session/start` using the signed-in user's Firebase ID token. cTrader handles its own login/consent page. The Trade Avata browser never receives the Client Secret.

The start endpoint creates a one-time server-stored OAuth `state`, and the callback must return the same value before token exchange. The callback page calls `/api/ctrader/session/complete`. The gateway exchanges the short-lived code server-side, encrypts the token pair, restores/refreshes it when necessary and associates it with the authenticated Firebase UID.

Personal account streams are prepared for:
- balance and equity;
- unrealized P&L;
- positions;
- orders;
- trade/deal history;
- live execution events;
- automatic Journal event ingestion;
- existing Analytics/Positions/Orders/History panels.

Read-only `accounts` permission is the normal Journal/Analytics path. Full `trading` permission should only be requested by a feature that truly needs trade execution.

## Security rules

- TA ID is never accepted as authentication.
- Firebase ID token is verified on protected HTTP and WebSocket account paths.
- cTrader secrets/tokens remain server-side.
- WebSocket/HTTP origin is restricted to `TRADE_AVATA_ORIGIN`; production fails closed when no allowed origin is configured.
- WebSocket payload, per-IP connection, per-client subscription and message-rate limits are enforced.
- Personal and public refreshed tokens survive container restarts through encrypted server-side storage.
- The service sends cTrader heartbeats every 10 seconds and re-authenticates/resubscribes after upstream reconnects.
