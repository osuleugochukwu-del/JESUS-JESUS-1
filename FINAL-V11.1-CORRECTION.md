# Trade Avata V11.1 Correction

Baseline: the currently deployed LORD-JESUS V11 package. V11 is preserved as the comparison point; this correction layer is added on top rather than replacing the approved chart shell.

## Implemented corrections

- Guest lockout is OFF by default. Owner/Admin can enable the timer, soft reminder and hard lock later from Guest Access Admin. Owner sessions bypass guest enforcement. A hard lock, when enabled, leaves the platform visible behind a translucent interaction gate.
- Premium panel/dropdown visual shell added across floating menus, right panels, cards and modals. Existing panel content/functionality is preserved.
- Mobile dropdowns use a fixed, scrollable bottom-sheet pattern so they do not open off-screen.
- Authentication UI replaced with a modern Login/Sign-up experience: email/password, password visibility, confirm password, Forgot Password, Google sign-in adapter, and clean phone layout.
- Profile retains Trade Avata ID (TA ID), role/plan, account information, Copy TA ID, licences and broker actions.
- Private Owner Trading Lab added with working local surfaces for Chart context report, Journal Coach notes, Analytics report, Strategy Vault, Projects/Workspaces and Avata Agent definitions, plus secure adapter surfaces for Deep Research, Advanced Voice and File/PDF Analysis.
- Guest Access Admin added with master enable switch, reminder/hard-lock switches, timing controls, preview controls and manual session reset.
- Candle View Scale added. It moves the candle view visually farther/closer without resizing the Trade Avata interface. Home/Reset preserves the selected scale; Reset Candle View returns it to 100%.
- Candle settings transaction corrected: live preview, OK commits, Cancel/X/backdrop roll back. Manual candle colours take priority over theme defaults after the user edits them.
- Interactive native-chart repaint path added to reduce perceived pointer-follow delay during active dragging while keeping normal RAF coalescing for background updates.
- Service worker cache bumped and V11.1 correction assets added.
- Deployment workflow included in `.github/workflows/deploy.yml`.

## Backend-dependent items

Google login, permanent backend-issued TA IDs, Owner role authority, cross-device account sync, secure indicator entitlement enforcement, AI/research providers, advanced voice and PDF analysis still require the production authentication/backend adapters. The UI does not fake provider output when an adapter is absent.

## Verification

- 99 Node tests passed.
- Package verifier passed.
- 100,000 randomized transition/Renko stress scenarios passed.
- 100,000 native geometry/axis/Home/timeframe-anchor scenarios passed.
- 100,000 full-native geometry/transition scenarios plus construction integrity checks passed.
- 1,000 final parity chart constructions passed.
