# Trade Avata JESUS-JESUS V11.2 Final R3 — final three-way preservation audit

## Sources compared

1. Current `osuleugochukwu-del/JESUS-JESUS` main repository. The inspected GitHub tree reports `fb0815194417c7c6d4b55e24dbc560b451d0e7ca`. Its current top-level/subtree object hashes and files match the protected V11.1 baseline, with the current GitHub Pages workflow protected separately because its formatting was repasted after the older V11.1 checksum manifest was generated.
2. User-supplied `Trade-Avata-JESUS-JESUS-V11.2-Live-Ready-Final(1).zip` (34 files).
3. This corrected `V11.2 Live-Ready Final R3` package.

## Result: original V11.2 vs R3

- Original V11.2 files: **34**.
- R3 overlay files: **40**.
- Original V11.2 paths missing from R3: **0**.
- New R3 paths: **6**.
- The new paths are the preserved-current deploy workflow, Indicator Portal cloud adapter, server identity/Owner helper, Owner bootstrap utility, and R2/R3 audit documents.
- R3 corrects existing live-ready files where required but does not delete an original V11.2 path.

## Result: current JESUS-JESUS vs merged R3

A complete merged repository was built and compared file-for-file against the reconstructed current GitHub baseline:

- Current JESUS-JESUS baseline files: **88**.
- Final full R3 repository files: **125** (including the final full-repository checksum file).
- Current baseline files missing from final R3: **0**.
- Current baseline files byte-identical in final R3: **84**.
- Current baseline files intentionally integrated/replaced: **4** — `index.html`, `sw.js`, `package.json`, and `.github/workflows/deploy.yml`.
- New files added around the preserved baseline: **37**.
- The current deploy workflow diff is additive: the only logical CI addition is `npm run verify:live-ready`; all existing test, verify, stress and Pages deployment steps remain.

The installer protects the current repository before copying anything:

- It verifies the exact identity of `V11.1-SHA256.txt`.
- It verifies **86 manifest entries except the workflow entry** against the signed V11.1 manifest.
- It verifies the **current GitHub `deploy.yml` separately** using SHA-256 `5a6c4d383fe567b48d3ea9c89e70fc2948378783f576ab12383d944f57a40fd1`, because the workflow was formatting-repasted after the older V11.1 checksum was generated.
- If any protected file differs, installation stops before copying.
- After installation, the verifier checks **83 unchanged baseline files** again. The four intentional integration replacements are `index.html`, `sw.js`, `package.json`, and `.github/workflows/deploy.yml`; each is separately checked for preservation of the original boot, PWA, package-script, and CI behavior while adding V11.2.

No native chart engine, chart pane, drawing engine, existing indicator engine/security gate, analytics, AI, replay, layouts, themes, recovery layer, logo, existing baseline test, or stress script is removed.

## Corrections confirmed in R3

- Mobile portrait trade panel: collapsed / half / full, fixed collapse control, drag/swipe behavior.
- Mobile landscape: bottom panel disappears to maximize chart space; a tiny `Trade Panel` call-out restores it as an overlay. The call-out no longer fails on wide landscape phones above 900 CSS pixels.
- Full separate Indicator Portal restored: My Indicators, Upload, Builder/Edit, Build, Test/Preview, Versions, TA ID Licensing and security status.
- Uploaded indicator payloads are retained as SHA-256-tagged Blob data in an account-scoped IndexedDB draft vault; they are not executed as arbitrary browser JavaScript. Upload limits are enforced (32 files, 32 MB accepted payload, 8 MB per file).
- Indicator project/version metadata and entitlements have an authenticated Firestore adapter; source Blob payloads are not stored in Firestore.
- Permanent TA ID allocation and Owner custom-claim bootstrap are server-side gateway responsibilities. A profile-only `role: owner` is not accepted as verified Owner authority in production.
- Firebase email/password, Google sign-in, reset password, persistence and sign-out adapter are wired.
- cTrader gateway includes OAuth state validation, encrypted server token storage, fail-closed production origin rules, connection/subscription/message limits, reconnect and journal-ready execution events.
- Dense-candle interaction patch remains additive and does not alter candle values or indicator formulas.

## Extra issue found during this final comparison

The prior R2 installer copied the upgrade and then asked the verifier to check `scripts/install-into-clone.mjs`, but R2 did not copy that file into the merged target. That could make a correct installation report a false failure. R3 fixes this by copying its own installer and verifier tooling and by validating the current deploy workflow separately from the older manifest entry.

## Automated acceptance result

On a fresh reconstruction of the current JESUS-JESUS baseline, the final R3 installer completed successfully, then:

- `npm test`: **120 passed, 0 failed**.
- `npm run verify`: **passed**.
- `npm run verify:live-ready`: **233 passed, 0 failed**.
- transition/Renko stress: **100,000 passed**.
- Native V3 stress: **100,000 passed**.
- Full Native stress: **100,000 passed**.
- Final parity stress: **1,000 passed**.

These automated checks strongly reduce regression risk but do not replace final real-device/browser testing or deployment of external backend services.

## What is intentionally not claimed as live yet

The external arbitrary-code indicator compile sandbox is not deployed merely by uploading this static package. cTrader live connectivity also requires deployment/configuration of `gateway/`, and Firebase/Google requires the GitHub Pages domain to be authorized. The UI reports backend-required/unconfigured states rather than faking success.
