# Trade Avata V11.2 — JESUS-JESUS Live-Ready Final R3

This release is a correction/additive layer on the current JESUS-JESUS V11.1 baseline.

## Mobile trading panel

- Portrait states: collapsed, half, full.
- Permanent top drag handle and fixed right-side collapse control.
- Horizontal tab scrolling does not move the collapse control off-screen.
- Drag up/down, strong downward collapse, immediate chart resize.
- Phone landscape hides the normal panel by default and restores full chart height.
- Landscape leaves only a tiny `▲ Trade Panel` call-out.
- Landscape panel opens as an overlay and closes by call-out, close button or downward swipe.
- Rotation uses resize/orientation/visualViewport handling without page reload.

## Indicator Portal

Separate from the normal Indicators menu:
- My Indicators
- Upload validation/static scan
- Build/Create/Edit drafts
- Build/Compile adapter with honest `backend required` state when secure sandbox is absent
- Test/Preview adapter
- Version management
- TA ID licensing and device allowance
- Draft/Private/Selected TA IDs/Published visibility
- Future Indicator Store-ready project metadata

Uploaded code is never directly executed by the browser. Existing `src/indicator-security.js` remains unchanged.

## Firebase Authentication

`src/firebase-auth-adapter.js` supplies the existing V11.1 login UI with:
- Email/password sign-in and signup
- Google sign-in
- Password reset
- Local persistent Firebase session
- Session restoration
- Sign-out
- Firebase ID token retrieval for protected backend calls

Profile creation is limited to a normal free profile. The included Firestore rules prevent ordinary users from promoting their own role/plan or assigning their own backend TA ID. Owner authority must be a verified custom claim/trusted backend decision.

## cTrader/live market preparation

- Provider-neutral market-feed bus.
- cTrader gateway WebSocket provider with reconnect/stale-feed detection.
- Honest feed states: LIVE, CONNECTING, RECONNECTING, OFFLINE, FEED NOT CONFIGURED, ERROR.
- Historical bar replacement and incremental live-bar update hooks into the existing native chart.
- Public chart feed is separate from personal account authorization.
- Personal account event hooks feed existing positions/orders/history/analytics plus a journal adapter hook.
- No Client Secret/access/refresh token in public GitHub code.
- The deploy-ready secure cTrader gateway is included under `gateway/`.
- It restores public subscriptions after upstream reconnects, encrypts/persists refreshed token pairs, pages historical ticks conservatively, retrieves account equity/unrealized P&L and pushes journal-ready execution events.
- One public frontend setting remains after gateway deployment: `src/live-ready-config.js` → `TRADE_AVATA_BACKEND_HTTP`.

## High-density chart performance correction

When the user zooms out and many candles are visible, the native candles keep control of panning. Expensive drawing/round-grid overlay work and synchronized pane range propagation are coalesced with `requestAnimationFrame`; decorative round-grid work is deferred during very dense active dragging and restored at release. Indicator formulas are not changed, and live indicator refreshes are throttled between ticks while closed-bar refreshes remain immediate. Heikin-Ashi live updates calculate only the newest candle during normal streaming instead of rebuilding the full history on every tick.

A diagnostic object is available at `window.__TRADE_AVATA_PERFORMANCE.sample()` for acceptance testing of visible candle counts.

## Service worker

Cache version is `trade-avata-chart-v11-1-correction-v11-2-live-ready-r3`. New local adapters are included. Old Trade Avata caches are removed on activation. Cross-origin Firebase/cTrader traffic is not cached by this service worker.

## Acceptance matrix

Before public deployment, run the existing JESUS-JESUS tests plus `npm run verify:live-ready`, then manually exercise:

- Desktop chart and all existing menus/features.
- Portrait phone panel collapsed/half/full and repeated drag cycles.
- Landscape rotation with panel open and closed.
- Small/tall phone viewport and no horizontal page overflow.
- Indicator Portal on desktop and phone.
- Email/password, Google, password reset, refresh/session restoration and sign-out.
- Dense panning at roughly 50/100/250/500/1000/2000+ visible candles.
- Feed not configured must never display `LIVE`.
- Once cTrader credentials are configured in the included gateway: disconnect/reconnect, stale feed, symbol/timeframe switching, live bar updates, token refresh/restart recovery, personal account snapshots, equity/P&L and trade-event ingestion.


## Baseline compatibility note

The original repository package version remains `11.1.0` because the existing JESUS-JESUS verifier explicitly requires that value. The additive release is identified separately as `tradeAvataLiveReady: 11.2`.

## R3 final corrections

The final correction pass adds the following without replacing any protected JESUS-JESUS baseline file:

- Landscape call-out CSS now follows the same short-landscape condition as JavaScript, so 915/932px-wide phones do not lose the Trade Panel call-out.
- Accepted indicator upload bytes are retained as Blob records in IndexedDB with SHA-256 metadata and passed to the future secure build adapter; arbitrary source still never executes in the browser.
- Authenticated Firestore sync is included for Indicator Portal project metadata, draft version metadata and entitlement reads. Source/package blobs deliberately remain outside Firestore until a secure staging/build backend receives them.
- `/api/account/bootstrap` securely allocates a permanent unique TA ID in the backend and can apply Owner authority only from the server-configured Firebase UID/custom claim.
- cTrader OAuth now uses server-stored one-time `state`; the gateway adds fail-closed production origin handling, request/WebSocket rate limits, max payload, connection and subscription limits.
- A one-time `gateway/scripts/bootstrap-owner.js` helper is included for explicit Owner claim setup.
