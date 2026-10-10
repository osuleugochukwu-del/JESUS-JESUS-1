# JESUS-JESUS Live-Ready update manifest — R3

Baseline inspected: `osuleugochukwu-del/JESUS-JESUS` main tree `fb0815194417c7c6d4b55e24dbc560b451d0e7ca`.

## Intentional integration replacements

These are backed up by the installer before replacement:
- `index.html` — preserves the existing page structure and boot order, adds the new adapters/layer.
- `sw.js` — preserves the existing PWA strategy, bumps cache identity and caches new local assets.
- `package.json` — keeps baseline version `11.1.0`, adds `tradeAvataLiveReady: 11.2`, revision R3 and `verify:live-ready`.
- `.github/workflows/deploy.yml` — preserves all existing deployment/test/stress steps and adds `npm run verify:live-ready` before deployment.

## New additive files

- `SOURCE-BASELINE.txt`
- `LIVE-ACTIVATION-LATER.txt`
- `APPLY-TO-JESUS-JESUS.bat` / `VERIFY-AFTER-INSTALL.bat` (Windows helpers)

- `assets/live-ready-upgrade.css`
- `src/firebase-auth-adapter.js`
- `src/indicator-cloud-adapter.js`
- `src/live-ready-config.js`
- `src/market-feed-adapter.js`
- `src/ctrader-feed-adapter.js`
- `src/ctrader-oauth-callback.js`
- `src/live-ready-upgrade.js`
- `ctrader-callback.html`
- `gateway/` — deploy-ready secure cTrader market/account gateway, permanent TA ID/Owner bootstrap, OAuth state validation, safety limits, Dockerfile and tests
- `firestore.rules`
- `scripts/verify-live-ready.mjs`
- `tests/live-ready.test.js`
- `docs/FINAL-LIVE-READY-RELEASE.md`
- `docs/PRESERVATION-AUDIT.md`
- `docs/R2-FINAL-AUDIT.md`
- `docs/R3-THREE-WAY-AUDIT.md`
- `docs/CTRADER-LIVE-PLUG.md`
- `docs/LIVE-READY-MANIFEST.md`

## Deliberately not replaced

All other existing JESUS-JESUS files remain in place, including the native chart engines, images/logo, chart pane, data/indicators, drawings, analytics, AI tools, recovery layers, V11/V11.1 correction files, existing tests/documentation and native/PWA assets. In particular, `src/indicator-security.js` is not replaced.

## Live feed plug

The secure gateway implementation is included. Live activation later consists of deploying `gateway/`, supplying cTrader/Firebase secret environment values and setting `src/live-ready-config.js` → `TRADE_AVATA_BACKEND_HTTP`. Secrets/tokens stay in the gateway environment/encrypted server storage, never in the public website.

## R3 correction scope

R3 preserves the complete signed V11.1 baseline except the four intentional integration replacements listed above, which are separately checked for preserved boot/deployment behavior. It retains every original V11.2 path, fixes the installer/verifier mismatch found during the second comparison, scopes local Indicator Portal drafts by account, bounds upload resources, requires custom-claim Owner authority, keeps the wide-phone landscape fix, cloud metadata/entitlement sync, permanent TA ID bootstrap, and cTrader OAuth/resource hardening.
