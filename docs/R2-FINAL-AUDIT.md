# Trade Avata JESUS-JESUS V11.2 Live-Ready Final R2 — preservation & correction audit

## Preservation result

The uploaded V11.2 package was copied first, then corrected in-place as an additive R2 revision.

- Original uploaded V11.2 package files: **34**
- Original V11.2 files removed by R2: **0**
- R2 new package files: **4**
  - `src/indicator-cloud-adapter.js`
  - `gateway/account-identity.js`
  - `gateway/scripts/bootstrap-owner.js`
  - `docs/R2-FINAL-AUDIT.md`
- All other R2 differences are edits to V11.2 additive/load/config/test/documentation files required for the corrections.
- The installer still protects the exact inspected `osuleugochukwu-del/JESUS-JESUS` baseline and refuses installation if any protected original fingerprint differs.

R2 does **not** replace the protected native chart, chart pane, data/indicator engine, drawings, original indicator security gate, V11 recovery layers, V11.1 correction layer, logo, themes, analytics or AI modules.

## Corrections implemented

1. **Wide-phone landscape call-out** — removed the accidental `max-width:900px` CSS restriction. JavaScript still decides whether the device is a phone/short landscape, so phones around 915/932px wide keep the small `Trade Panel` call-out instead of losing access to the hidden panel.
2. **Indicator upload payload retention** — accepted files are SHA-256 hashed and retained as Blob records in IndexedDB. The secure build adapter receives the actual retained file payloads; uploaded code is still never executed directly by the browser.
3. **Indicator Portal cloud state** — authenticated Firestore sync is included for creator project metadata, draft version metadata and entitlement reads. Local IndexedDB remains the source/package draft vault; source blobs are deliberately not written to Firestore.
4. **Permanent TA ID** — the secure backend adds `POST /api/account/bootstrap`, transactionally reserves a unique `TA-########` record and writes it to the authenticated user's profile. Browser code cannot mint/change the production TA ID.
5. **Owner authority** — Owner is issued only as a Firebase custom claim from trusted backend configuration (`TRADE_AVATA_OWNER_UID`) or the included one-time Admin helper. No client email hardcoding or editable browser role is accepted as authority.
6. **Gateway hardening** — cTrader OAuth uses a one-time server-stored `state`; production origins fail closed; HTTP bootstrap/OAuth endpoints are rate limited; WebSocket payload size, connections, subscriptions and message rate are bounded.

## Automated validation

R2 package tests: **17 passed / 0 failed**.

The test suite covers the original gateway market engine plus R2 checks for mobile landscape behavior, retained indicator payloads, Firestore portal sync, honest sandbox status, Firebase auth/backend identity bootstrap, server-side TA ID/Owner authority, OAuth state, gateway safety limits, dense-chart performance patch and cTrader reconnect/journal wiring.

All modified/new JavaScript implementation files were also checked with `node --check` successfully.

## Remaining deployment/configuration actions (not code regressions)

- Add `osuleugochukwu-del.github.io` to Firebase Authentication Authorized domains if it has not already been added.
- Deploy the included `firestore.rules` before relying on cloud project/entitlement access controls.
- Deploy the included `gateway/` with Firebase Admin credentials and required environment values.
- Put only the gateway's public HTTPS address into `src/live-ready-config.js` as `TRADE_AVATA_BACKEND_HTTP`.
- Set `TRADE_AVATA_OWNER_UID` (or run the included Admin helper) for the real Owner account.
- The arbitrary-code indicator compiler/test sandbox remains an external secure service by design; the frontend reports `backend required` until that service is actually connected.
