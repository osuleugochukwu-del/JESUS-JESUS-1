import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('live-ready layer contains all three portrait panel states and landscape overlay',()=>{
  const x=read('src/live-ready-upgrade.js'),css=read('assets/live-ready-upgrade.css');
  for(const word of ['collapsed','half','full','mobileLandscapePanelOpen','ta-mobile-landscape'])assert.ok(x.includes(word));
  assert.ok(css.includes('@media(orientation:landscape) and (max-height:540px)'));
  assert.ok(!css.includes('@media(max-width:900px) and (orientation:landscape) and (max-height:540px)'));
});

test('Indicator Portal retains accepted source/package bytes for secure sandbox staging',()=>{
  const x=read('src/live-ready-upgrade.js');
  assert.ok(x.includes('fileBlobs'));
  assert.ok(x.includes('sha256File'));
  assert.ok(x.includes("files:sourceFiles"));
  assert.ok(x.includes('navigator.storage?.persist'));
});

test('Indicator Portal syncs project metadata and entitlements through authenticated Firestore adapter',()=>{
  const x=read('src/live-ready-upgrade.js'),c=read('src/indicator-cloud-adapter.js'),r=read('firestore.rules');
  assert.ok(x.includes('syncPortalCloud'));
  for(const term of ['indicatorProjects','indicatorEntitlements','indicatorVersions'])assert.ok(c.includes(term)&&r.includes(term));
  assert.ok(c.includes('sourceStoredInFirestore:false'));
});

test('Indicator Portal never fakes compilation success without backend adapter',()=>{
  const x=read('src/live-ready-upgrade.js');
  assert.ok(x.includes('backend-required'));
  assert.ok(x.includes('Secure sandbox compiler is not connected'));
  assert.ok(!/\beval\s*\(/.test(x));
});

test('Firebase adapter exposes V11.1 auth operations and secure backend identity bootstrap',()=>{
  const x=read('src/firebase-auth-adapter.js');
  for(const word of ['signIn','login','createAccount','signUp','resetPassword','sendPasswordResetEmail','signInWithGoogle','signOut','restoreSession','bootstrapIdentity','/api/account/bootstrap'])assert.ok(x.includes(word));
});

test('backend allocates TA ID and Owner authority server-side only',()=>{
  const x=read('gateway/account-identity.js'),r=read('firestore.rules');
  assert.ok(x.includes('TA-'));
  assert.ok(x.includes('TRADE_AVATA_OWNER_UID'));
  assert.ok(x.includes('setCustomUserClaims'));
  assert.ok(r.includes("match /taIds/{taId}"));
  assert.ok(r.includes('allow write: if false'));
});

test('cTrader OAuth uses server-stored state and callback returns it',()=>{
  const g=read('gateway/server.js'),st=read('gateway/secure-session-store.js'),cb=read('src/ctrader-oauth-callback.js');
  assert.ok(g.includes("auth.searchParams.set('state',state)"));
  assert.ok(g.includes('consumeOAuthState'));
  assert.ok(st.includes('stateHash'));
  assert.ok(cb.includes('params.get(\'state\')'));
  assert.ok(cb.includes('JSON.stringify({code,state})'));
});

test('cTrader gateway applies production origin, message, connection and subscription limits',()=>{
  const g=read('gateway/server.js');
  for(const word of ['MAX_WS_CLIENTS','MAX_WS_PER_IP','MAX_SUBSCRIPTIONS_PER_CLIENT','MAX_WS_MESSAGE_BYTES','production is fail-closed','rateLimit'])assert.ok(g.includes(word));
});

test('cTrader adapter has reconnect + secure OAuth gateway hooks and no embedded secret',()=>{
  const x=read('src/ctrader-feed-adapter.js');
  assert.ok(x.includes('WebSocket'));
  assert.ok(x.includes('scheduleReconnect'));
  assert.ok(x.includes('/api/ctrader/session/start'));
  assert.ok(!x.includes('CTRADER_CLIENT_SECRET'));
});

test('high-density chart performance patch is present',()=>{
  const x=read('src/live-ready-upgrade.js');
  assert.ok(x.includes('visibleCount'));
  assert.ok(x.includes('requestAnimationFrame'));
  assert.ok(x.includes('count>1600'));
  assert.ok(x.includes('count>700'));
});

test('secure cTrader gateway is included, reconnectable and journal-ready',()=>{
  const g=read('gateway/server.js'),c=read('gateway/ctrader-json-client.js'),st=read('gateway/secure-session-store.js');
  assert.ok(g.includes('recoverPublic'));
  assert.ok(g.includes("type:'trade-event'"));
  assert.ok(g.includes('positionPnl'));
  assert.ok(c.includes('POSITION_PNL_REQ:2187'));
  assert.ok(st.includes('aes-256-gcm'));
});

test('loader preserves the existing JESUS-JESUS V11.1 boot chain and only adds R3 adapters',()=>{
  const x=read('index.html');
  for(const term of ['./assets/styles.css','./assets/master-recovery.css','./assets/final-upgrade.css','./assets/v11-correction.css','./src/app.js','./src/master-recovery.js','./src/final-upgrade.js','./src/v11-correction.js'])assert.ok(x.includes(term));
  for(const term of ['./src/firebase-auth-adapter.js','./src/indicator-cloud-adapter.js','./src/market-feed-adapter.js','./src/ctrader-feed-adapter.js','./src/live-ready-upgrade.js'])assert.ok(x.includes(term));
});

test('service worker bumps R3 cache and keeps old plus new local assets',()=>{
  const x=read('sw.js');
  assert.ok(x.includes('v11-2-live-ready-r3'));
  for(const term of ['v11-correction.js','indicator-security.js','firebase-auth-adapter.js','indicator-cloud-adapter.js','live-ready-upgrade.js'])assert.ok(x.includes(term));
});


test('Indicator Portal local drafts are account-scoped and resource-limited',()=>{
  const x=read('src/live-ready-upgrade.js');
  for(const term of ['portalOwnerKey','draftKey','projectVisibleTo','PORTAL_MAX_FILES=32','PORTAL_MAX_TOTAL=32*1024*1024'])assert.ok(x.includes(term));
  assert.ok(x.includes('account-scoped local draft vault'));
});

test('browser never accepts profile-only Owner as verified production authority',()=>{
  const x=read('src/firebase-auth-adapter.js');
  assert.ok(x.includes("profileRole==='owner'?'free':profileRole"));
  assert.ok(x.includes('roleVerified:!!claimRole&&claimRole===role'));
});

test('installer validates the full V11.1 baseline and copies its own verifier tooling',()=>{
  const x=read('scripts/install-into-clone.mjs');
  assert.ok(x.includes('V11.1-SHA256.txt'));
  assert.ok(x.includes('BASELINE_MANIFEST_SHA256'));
  assert.ok(x.includes('CURRENT_WORKFLOW_SHA256'));
  assert.ok(x.includes("p==='.github/workflows/deploy.yml'"));
  assert.ok(x.includes("'scripts/install-into-clone.mjs'"));
  assert.ok(x.includes('baselineRows.length'));
});


test('GitHub Pages workflow preserves old checks and adds live-ready verification',()=>{
  const x=read('.github/workflows/deploy.yml');
  for(const term of ['npm test','npm run verify','npm run verify:live-ready','npm run stress','npm run stress:native-v3','npm run stress:full-native','npm run stress:parity','actions/deploy-pages@v5'])assert.ok(x.includes(term));
});
