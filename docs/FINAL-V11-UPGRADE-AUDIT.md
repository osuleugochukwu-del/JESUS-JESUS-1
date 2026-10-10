# Trade Avata Chart — Final V11 Upgrade Audit

Version: **11.0.0**  
Protected baseline: **SUPER-JESUS V10.2**  
Baseline source: latest successful GitHub Pages build from `main` at commit `540b279ed351bd92ac7f1910cfb3141c00fc3cbd`.

## Preservation rule

The approved V10.2 package was copied before any V11 work. The V11 work is additive and was performed against the clone. The protected baseline remains separate and has a SHA-256 manifest. No baseline file is missing from the V11 package.

The connected GitHub integration could read the repository, but branch creation returned HTTP 403 (`Resource not accessible by integration`). For that reason, the live `main` branch was deliberately **not overwritten**. This package is the tested upgrade candidate to upload/deploy once a safe write path is available.

## V11 product direction

V11 keeps the existing Trade Avata native chart and applies the agreed professional terminal direction:

- cTrader-inspired feature depth and trading maturity.
- TradingView-inspired chart polish, compactness, layout/workspace behavior, and contextual analytics.
- Trade Avata translucent/glass visual language rather than a pixel-for-pixel copy of another platform.
- Soft neutral light surfaces and equally supported dark themes.
- Existing approved chart layout preserved rather than replaced.

## Implemented V11 systems

### Visual system and themes

- New translucent/glass panel layer for menus, dropdowns, right panels, settings, modals, top bar, bottom panel and mobile sheets.
- User-adjustable panel opacity, menu opacity, modal opacity and blur.
- Soft-light theme avoids harsh large `#FFFFFF` surfaces.
- Additional themes: Default, Midnight, Graphite, Navy, Slate, Dusk, Forest, Wine, Ice, AMOLED, Sepia and Soft Light.
- Theme selection updates both the surrounding interface and chart palette immediately.
- Theme changes participate in Undo.
- Compact/comfortable UI density control.
- Square professional color-swatch palette rather than circular color dots.

### Chart responsiveness and performance

- Native chart remains the renderer; no external chart renderer was introduced.
- Chart resize responds to browser/window and `visualViewport` changes.
- Performance mode reduces expensive rendering effects and limits device-pixel-ratio cost on weaker devices.
- Existing smooth native line renderer uses sub-pixel positions plus rounded joins/caps, preserving indicator mathematics while improving line presentation.
- Added 6-chart and 8-chart layouts in addition to existing layouts.
- Existing chart pan/zoom/axis behavior remains under regression/stress coverage.

### Round-number price levels

Configurable round-number grid support was added. Presets include:

- Major 500 / 000 levels.
- Thousands.
- Hundreds.
- Fifties.
- Custom step.
- Optional minor levels.

Round levels can be rendered with stronger visual emphasis and labels without altering market prices.

### Indicator architecture

- Automatic indicator naming (examples: `20 EMA`, `50 WMA`, `RSI (14)`, `Stochastic (14,3,3)`).
- Added a general Moving Average type alongside dedicated EMA/SMA/WMA behavior.
- Added richer MA calculation choices, including SMA, EMA, WMA/linear-weighted, Wilder smoothing, Hull, Triangular, DEMA, TEMA and Linear Regression MA.
- Stochastic now supports K Periods, K Slowing, D Periods, MA type and LowHigh/CloseClose calculation modes.
- Indicator settings now expose professional live-edit controls for relevant parameters, line width/style/opacity/colors and levels.
- Settings changes preview immediately.
- Chart indicator legend supports Show/Hide, Edit and Remove.
- Large indicator counts collapse into an Indicator Manager rather than filling the chart header.
- Indicator Manager groups Main Chart and oscillator indicators and supports show/hide, edit, duplicate and remove operations.
- Licensed indicator entries can remain visible while locked after expiry/revocation.

### Watchlist, favorites and contextual symbol analytics

- Searchable, scrollable watchlist designed for large symbol lists.
- User can add additional symbols.
- Favorite/star support.
- Compact top symbol selector prioritizes favorites.
- Contextual selected-symbol analytics panel includes available price/range/trend/volume information from actual chart data.
- News and Events panels are switchable on/off.
- If no real provider is connected, V11 shows an honest unavailable/provider-needed state rather than fabricated headlines or events.

### Layout/workspace management

- Save current layout.
- Autosave toggle.
- Open/manage layouts.
- Rename layout.
- Make a copy.
- Share current layout.
- Export active chart data to CSV.
- Local persistence remains available.
- A cloud-settings adapter contract is present for account-level cross-device sync once the production account/backend adapter is connected.

### Guest access policy

- Guest users can try the chart and drawing tools.
- Guest drawings are not permanently persisted as account content.
- Approximately 10 minutes: dismissible sign-in reminder.
- Approximately 40 minutes total: blocking sign-in gate.
- 24-hour guest window/reset.
- Local timer state prevents a simple refresh from bypassing the current guest window.

### Login, profile and identity

- Compact professional Trade Avata login/profile interface.
- Trade Avata authentication is conceptually first; broker connection is separate and follows it.
- Public production builds do not fake authentication when no real auth adapter is connected.
- Local preview authentication is restricted to local-development contexts.
- Profile includes Trade Avata ID (TA ID) support.
- TA ID is treated as a public ecosystem identifier, not a password, broker credential, Firebase UID or security token.

### TA ID indicator licensing

V11 contains the UI and entitlement architecture for:

- TA ID profile display.
- Indicator licence listing.
- Active / expired / revoked visibility.
- Locked-but-visible expired indicators.
- Owner grant/revoke controls.
- Duration presets such as trial/temporary periods.
- Production entitlement contract built around authenticated user + indicator ID + status + start/expiry + permissions/device allowance.

Security rule: TA ID itself does not unlock an indicator. Production enforcement must be server-side. Proprietary indicator source/runtime is not faked or exposed merely to simulate licensing.

### Owner / Free / future paid architecture

Internal plan roles are prepared for:

- `OWNER`
- `FREE`
- `PRO` (hidden for now)
- `ADVANCED` (hidden for now)

Owner access is intended for the full personal trading/testing environment. Public users remain on the free/current experience until monetization is deliberately enabled.

Owner Resource Center includes configurable feature switches and provider quota status for advanced voice, deep research, chart AI, journal AI, analytics AI and agents.

Provider guard behavior is conservative:

- Requires a configured recurring/resetting allowance for owner-only free testing.
- Can reset counters according to provider configuration.
- Stops before overage.
- Does not silently cross from free allowance into paid usage.

No fake free quota has been invented for providers that are not connected.

### Voice

- Existing browser/device speech remains the free voice path.
- Browser voice selection, speech rate and pitch controls were added.
- Advanced natural voice is represented as an owner/premium provider-backed capability; it remains unavailable until a real recurring-free or paid provider is connected.

### Chart trading

- Prepare Trade mode creates draggable risk/reward geometry before execution.
- Buy and Sell preparation supported.
- Entry, Stop Loss and Take Profit values are reflected in the order workflow.
- Order ticket supports Market, Limit, Stop and Stop Limit modes.
- Units/lots, Risk %, Time In Force, Stop Loss and Take Profit controls.
- Live risk/reward and risk/reward money calculation in the ticket.
- Confirmation flow when one-click behavior is not enabled.
- Live broker submission is used only when a real gateway is connected; otherwise replay/demo behavior remains clearly non-live.
- DOM panel reads real market-depth state if supplied; otherwise it explicitly states that the current feed does not provide DOM.

### Demo/live-data integrity

- Demo position data is removed when connection state becomes live.
- News, events, DOM and other provider-dependent modules do not manufacture live values when the provider is absent.
- This prevents mixing fake information with real trading data.

### Mobile/PWA behavior

- Mobile panels receive compact close/drag affordances.
- Right panel can be dismissed naturally on mobile.
- Outside-click closing is supported for ordinary menus.
- Browser viewport changes trigger chart resizing.
- Existing PWA/service-worker structure is preserved with a new V11 cache version.

## Backend/provider integration contracts still required for production-live capabilities

The following cannot truthfully be made fully live using front-end code alone and are therefore wired as guarded adapter/provider capabilities rather than fake implementations:

1. Production authentication and cross-device account sync — connect the real Trade Avata/Firebase auth + database adapter.
2. Broker account connection/persistent authorization — connect supported broker OAuth/session APIs.
3. Live order execution — connect the broker/trading gateway.
4. Live DOM — requires market-depth data from a broker/feed that supplies it.
5. Live news/economic events/fundamentals/options — requires real licensed/free data providers as applicable.
6. Natural premium voice — requires a real voice provider and quota configuration.
7. Deep research / advanced AI — requires the selected AI/search provider.
8. Secure proprietary indicator licensing/enforcement — requires authenticated backend entitlement checks and protected runtime strategy.

V11 deliberately fails closed or shows an unavailable state for these instead of pretending they are connected.

## Verification results

- Node test suite: **91 / 91 passed**.
- Package verification: **passed**.
- Transition/Renko randomized stress: **100,000 passed**.
- Native geometry/axis/Home/timeframe-anchor stress: **100,000 passed**.
- Full-native geometry/transition stress: **100,000 passed** plus construction-integrity checks.
- Final native parity constructions: **1,000 passed**.
- Baseline preservation diff: **no baseline files missing**.

A managed browser smoke test could not be completed in this execution environment because its browser policy blocks localhost/file navigation. The code therefore relies on the extensive static, Node, construction and randomized stress coverage above; a final visual/device QA pass should still be performed after deployment on the real URL, especially on the actual Android PWA and Windows desktop devices.

## Release recommendation

Keep the protected V10.2 baseline archived. Deploy V11 first to a safe preview/new branch/repository when GitHub write access is available, visually verify it against the real deployed baseline, then promote it only after approval. Do not overwrite the current production build without that final visual confirmation.
