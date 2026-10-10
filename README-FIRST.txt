TRADE AVATA — JESUS-JESUS V11.2 LIVE-READY FINAL R3 PACKAGE
=========================================================

WHAT THIS PACKAGE IS
--------------------
This is an ADDITIVE correction/live-ready layer for the exact JESUS-JESUS V11.1 repository.
It does not replace the native Trade Avata chart, old indicators, drawings, themes, layouts,
AI areas, analytics, Owner Lab, logo, recovery layers, or existing assets.

IMPORTANT
---------
The connected GitHub tool could read JESUS-JESUS but GitHub rejected branch/file writes with
"Resource not accessible by integration". For safety, the live main repository was NOT changed.
This package is therefore made to be applied to an exact clone/copy of JESUS-JESUS.

EASIEST SAFE INSTALL
--------------------
1. Make an exact copy/clone of osuleugochukwu-del/JESUS-JESUS.
2. Unzip this package somewhere on your computer.
3. Open a terminal in THIS package folder.
4. Run:

   node scripts/install-into-clone.mjs "FULL PATH TO THE JESUS-JESUS CLONE"

The installer first validates the exact V11.1 baseline-manifest identity, checks all manifest-protected files,
and separately checks the CURRENT JESUS-JESUS GitHub Pages workflow (whose formatting was repasted after that old manifest).
If the clone is not the inspected current baseline, it STOPS before changing anything.

It backs up the four intentional integration replacements (index.html, sw.js, package.json, and the GitHub Pages deploy workflow) and then adds
the new live-ready files. It does NOT delete old files.

WHAT IS ALREADY WIRED
---------------------
- Portrait phone trade panel: collapsed / half / full, drag + strong swipe collapse.
- Fixed collapse control that cannot disappear with scrolling tabs.
- Landscape phone: chart gets full height; tiny Trade Panel call-out; overlay panel on demand.
- Chart resizes after panel/orientation changes without page reload.
- Full separate Indicator Portal: My Indicators, Upload, Builder/Edit, Build, Test/Preview,
  Versions, TA ID Licensing, visibility/publishing, security/sandbox status.
- Uploaded indicator files are retained as hashed Blob payloads in IndexedDB for later secure sandbox staging.
- Indicator project metadata/versions/entitlements sync through authenticated Firestore; source blobs are not put in Firestore.
- Existing src/indicator-security.js remains untouched.
- Firebase Email/Password, Google sign-in, reset password, persistent sessions and sign-out adapter.
- Secure backend account bootstrap allocates permanent TA IDs; Owner authority uses Firebase custom claims only.
- Backend-safe Owner/TA ID posture and Firestore rules template.
- cTrader/public market feed bus, WebSocket reconnecting, historical/live bar hooks,
  plus the deploy-ready secure `gateway/` server itself: OAuth with state validation, encrypted token refresh, public feed,
  personal account balance/equity/P&L, positions/orders/history and journal-ready execution events.
- Dense-candle drag performance correction: overlay/range work is coalesced while native candles pan.
- Service-worker cache bumped so phones do not remain stuck on old layout code.
- Live status is honest: LIVE / CONNECTING / RECONNECTING / OFFLINE / FEED NOT CONFIGURED.

THE ONE PUBLIC FRONTEND ADDRESS LEFT
------------------------------------
Open:
  src/live-ready-config.js

Later, deploy the INCLUDED `gateway/` folder with your private cTrader credentials/account settings.
Then fill the one non-secret browser address:
  TRADE_AVATA_BACKEND_HTTP='https://YOUR-SECURE-GATEWAY'

Do NOT put cTrader Client Secret, access token, refresh token, or broker password in GitHub.
Those belong only in the included gateway's cloud secret/environment settings. No frontend redesign is required.

VERIFY
------
Inside the MERGED JESUS-JESUS clone run:
  npm test
  npm run verify
  npm run verify:live-ready

See docs/FINAL-LIVE-READY-RELEASE.md for the full acceptance checklist.
