const CACHE='trade-avata-chart-v11-1-correction-v11-2-live-ready-r3';

const LOCAL=[
  './',
  './index.html',
  './ctrader-callback.html',
  './assets/styles.css',
  './assets/master-recovery.css',
  './assets/final-upgrade.css',
  './assets/v11-correction.css',
  './assets/live-ready-upgrade.css',

  './src/firebase-auth-adapter.js',
  './src/indicator-cloud-adapter.js',
  './src/live-ready-config.js',
  './src/market-feed-adapter.js',
  './src/ctrader-feed-adapter.js',
  './src/ctrader-oauth-callback.js',
  './src/app.js',
  './src/master-recovery.js',
  './src/final-upgrade.js',
  './src/v11-correction.js',
  './src/live-ready-upgrade.js',
  './src/native-v27-renderer.js',
  './src/native-chart.js',
  './src/native-v3-core.js',
  './src/chart-quality-ai.js',
  './src/chart-pane.js',
  './src/chart-transition.js',
  './src/data.js',
  './src/drawings.js',
  './src/state.js',
  './src/utils.js',
  './src/indicator-security.js',
  './src/alert-client.js',
  './src/replay-client.js',
  './src/indicators.js',
  './src/analytics.js',
  './src/workspace-sync.js',
  './src/share.js',
  './src/market-intelligence.js',
  './src/ai-client.js',

  './public/brand/trade-avata-logo.svg',
  './manifest.webmanifest'
];

self.addEventListener('install',event=>
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(LOCAL)).then(()=>self.skipWaiting())
  )
);

self.addEventListener('activate',event=>
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('trade-avata-chart-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
  )
);

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return; // Never cache Firebase/cTrader OAuth or remote credentials/tokens.
  event.respondWith(
    fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response?.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
      return response;
    }).catch(async()=>await caches.match(event.request)||caches.match('./index.html'))
  );
});
