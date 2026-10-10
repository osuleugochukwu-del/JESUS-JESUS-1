# JESUS-JESUS preservation audit

The update was designed as an additive layer after the existing V11.1 boot sequence. No core chart engine, existing indicator-security gate, existing theme/recovery layer, or brand asset is included as a replacement in the overlay.

## Baseline fingerprints protected by the installer/verifier

- `public/brand/trade-avata-logo.svg` — `9cc86558ee79ecfbe63b31ce9d5d830dca0e8918`
- `assets/styles.css` — `05a3c149a18b50b6dd8fff0b204f9977a493dc43`
- `assets/master-recovery.css` — `ac4e8fd0448341a91a0d1c022c7c6b15042f9acb`
- `assets/final-upgrade.css` — `93f9adda0016f8a706404d6b8fe4d95717b87d28`
- `assets/v11-correction.css` — `cb8139efc97ba79716b064d2b30dc73f92a0662e`
- `src/app.js` — `11d899fbd39580dbae0ce137e90965f089d5e45f`
- `src/chart-pane.js` — `ac120e40278dafc0119d334e049e233c04d6d5e7`
- `src/data.js` — `4f633b4500bfe061563e7cf80c0c964dbe01818e`
- `src/indicator-security.js` — `7c8046dec263dee12d1a98244f792ad36416b475`
- `src/indicators.js` — `a59adb75a967f80175809894ddff51f8ad69bb49`
- `src/final-upgrade.js` — `54fd0368d08bdd5c13df21edeee3cf38422b1a68`
- `src/master-recovery.js` — `28e7350c4ac9531f8a3650e3af2a5f9cd85bb14d`
- `src/v11-correction.js` — `c6c2c8e6b048f79346e421aae0319eee98035f1c`

The live-ready verifier fails if these protected baseline files differ or disappear. This is intentional: it prevents a convenient new feature from silently replacing an approved old feature.

## Loader replacements

Only `index.html`, `sw.js`, `package.json`, and `.github/workflows/deploy.yml` are supplied as complete replacements. Their old V11.1 references are retained, then the new adapter/correction layer is added. The installer backs those four originals up before copying replacements.

## R3 comparison result

The R3 correction was applied only to the V11.2 additive package. No protected JESUS-JESUS baseline fingerprint was changed. The installer still stops before copying anything if any protected baseline file differs from the inspected repository. R3 retains those R2 additions and adds a full-baseline manifest guard, account-scoped indicator drafts, strict custom-claim Owner display authority, bounded uploads, and CI verification of the live-ready layer.
