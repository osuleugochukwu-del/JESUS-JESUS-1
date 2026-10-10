import http from 'node:http';
import crypto from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {URL} from 'node:url';
import {CTraderJsonConnection,PT} from './ctrader-json-client.js';
import {
  planForPeriod,periodKey,trendbarToBar,aggregateTimeBars,decodeTickData,
  ticksToTimeBars,ticksToCountBars,ticksToRenko,ticksToRange,normalizeSymbolMap,
  normalizePosition,normalizeOrder,normalizeDeals,bucketStart,secondsOf
} from './market-engine.js';
import {
  verifyBearer,saveSession,loadSession,deleteSession,saveSystemSession,loadSystemSession,saveOAuthState,consumeOAuthState
} from './secure-session-store.js';
import {ensureAccountIdentity} from './account-identity.js';

const PORT=Number(process.env.PORT||8080);
const CLIENT_ID=process.env.CTRADER_CLIENT_ID||'';
const CLIENT_SECRET=process.env.CTRADER_CLIENT_SECRET||'';
const REDIRECT_URI=process.env.CTRADER_REDIRECT_URI||'';
const PUBLIC_BOOTSTRAP_ACCESS=process.env.CTRADER_PUBLIC_ACCESS_TOKEN||'';
const PUBLIC_BOOTSTRAP_REFRESH=process.env.CTRADER_PUBLIC_REFRESH_TOKEN||'';
const PUBLIC_ACCOUNT=process.env.CTRADER_PUBLIC_ACCOUNT_ID||'';
const PUBLIC_ENV=(process.env.CTRADER_PUBLIC_ENV||'demo').toLowerCase()==='live'?'live':'demo';
const aliases=(()=>{try{return JSON.parse(process.env.CTRADER_SYMBOL_ALIASES||'{}');}catch{return{};}})();
const configuredOrigins=String(process.env.TRADE_AVATA_ORIGIN||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
const production=String(process.env.NODE_ENV||'').toLowerCase()==='production';
const MAX_WS_CLIENTS=Math.max(10,Number(process.env.TRADE_AVATA_MAX_WS_CLIENTS||5000));
const MAX_WS_PER_IP=Math.max(1,Number(process.env.TRADE_AVATA_MAX_WS_PER_IP||20));
const MAX_SUBSCRIPTIONS_PER_CLIENT=Math.max(1,Number(process.env.TRADE_AVATA_MAX_SUBSCRIPTIONS||12));
const MAX_WS_MESSAGE_BYTES=Math.max(1024,Number(process.env.TRADE_AVATA_MAX_WS_MESSAGE_BYTES||32768));
const connections={live:null,demo:null};
const clients=new Set();
const personalWatchers={live:new Map(),demo:new Map()};
const publicState={
  ready:false,symbolMap:null,fullSymbols:new Map(),subscribedIds:new Set(),
  subscriptions:new Map(),historyCache:new Map(),historyPending:new Map(),
  listenerAttached:false,recovering:null,session:null,sessionLoaded:false
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function normalizedOrigin(origin=''){return String(origin||'').trim().replace(/\/$/,'');}
function originAllowed(origin=''){
  const value=normalizedOrigin(origin);
  if(configuredOrigins.length)return configuredOrigins.includes(value);
  if(production)return false; // production is fail-closed until TRADE_AVATA_ORIGIN is configured.
  return !value||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}
function cors(req){const value=normalizedOrigin(req.headers.origin||'');return originAllowed(value)?(value||configuredOrigins[0]||'null'):'null';}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();}
const rateBuckets=new Map();
function rateLimit(key,limit=120,windowMs=60000){
  const now=Date.now(),row=rateBuckets.get(key);if(!row||now-row.start>=windowMs){rateBuckets.set(key,{start:now,count:1});return true;}row.count+=1;return row.count<=limit;
}
function requireRate(req,res,label,limit=120){if(rateLimit(`${label}:${clientIp(req)}`,limit))return true;json(req,res,429,{error:'Too many requests. Please try again shortly.'});return false;}
function send(ws,obj){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(obj){for(const ws of clients)send(ws,obj);}
function json(req,res,status,obj){
  const headers={
    'access-control-allow-origin':cors(req),'access-control-allow-headers':'authorization,content-type',
    'access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'
  };
  if(status===204){res.writeHead(status,headers);return res.end();}
  res.writeHead(status,{'content-type':'application/json',...headers});res.end(JSON.stringify(obj));
}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>1_000_000)throw Object.assign(new Error('Request too large'),{status:413});}return s?JSON.parse(s):{};}
function normalizeName(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function price(v){return Number(v)/100000;}
function money(v,digits=0){return v==null?null:Number(v)/Math.pow(10,Number(digits)||0);}
function expiresAt(token){return Date.now()+Number(token?.expiresIn||2628000)*1000;}

function conn(env){
  if(!CLIENT_ID||!CLIENT_SECRET)throw new Error('cTrader application credentials are not configured');
  if(connections[env])return connections[env];
  const c=new CTraderJsonConnection({environment:env,clientId:CLIENT_ID,clientSecret:CLIENT_SECRET});
  c.addEventListener('close',()=>onUpstreamClose(env));
  c.addEventListener('ready',()=>onUpstreamReady(env));
  c.addEventListener(`payload:${PT.EXECUTION_EVENT}`,e=>onPersonalExecution(env,e.detail));
  c.addEventListener(`payload:${PT.TRADER_UPDATE}`,e=>onPersonalTraderUpdate(env,e.detail));
  connections[env]=c;return c;
}

async function tokenExchange(params){
  const u=new URL('https://openapi.ctrader.com/apps/token');
  for(const[k,v]of Object.entries(params))if(v!=null)u.searchParams.set(k,String(v));
  u.searchParams.set('client_id',CLIENT_ID);u.searchParams.set('client_secret',CLIENT_SECRET);
  const r=await fetch(u,{headers:{accept:'application/json'}}),j=await r.json();
  if(!r.ok||j.errorCode)throw new Error(j.description||j.errorCode||`cTrader token exchange ${r.status}`);
  return j;
}
async function refreshSession(session){
  if(!session?.refreshToken)throw new Error('No cTrader refresh token is available');
  const t=await tokenExchange({grant_type:'refresh_token',refresh_token:session.refreshToken});
  return{...session,...t,expiresAt:expiresAt(t)};
}
async function publicSession({forceRefresh=false}={}){
  if(!publicState.sessionLoaded){
    publicState.sessionLoaded=true;
    publicState.session=await loadSystemSession('public-feed').catch(()=>null);
    if(!publicState.session&&(PUBLIC_BOOTSTRAP_ACCESS||PUBLIC_BOOTSTRAP_REFRESH)){
      publicState.session={accessToken:PUBLIC_BOOTSTRAP_ACCESS||null,refreshToken:PUBLIC_BOOTSTRAP_REFRESH||null,expiresAt:null};
    }
  }
  let s=publicState.session;
  if(!s?.accessToken&&s?.refreshToken)forceRefresh=true;
  if(!s?.accessToken&&!s?.refreshToken)throw new Error('Public cTrader access/refresh token is not configured');
  if((forceRefresh||(s.expiresAt&&s.expiresAt-Date.now()<3*86400000))&&s.refreshToken){
    s=await refreshSession(s);publicState.session=s;await saveSystemSession('public-feed',s);
  }
  return s;
}
async function freshSession(uid){
  let s=await loadSession(uid);if(!s)return null;
  if(s.expiresAt&&s.expiresAt-Date.now()<3*86400000&&s.refreshToken){s=await refreshSession(s);await saveSession(uid,s);}
  return s;
}

async function ensurePublic(){
  if(publicState.ready)return;
  if(!PUBLIC_ACCOUNT)throw new Error('Public cTrader account ID is not configured');
  const c=conn(PUBLIC_ENV);let s=await publicSession();
  try{await c.ensureAccount(PUBLIC_ACCOUNT,s.accessToken);}
  catch(err){if(!s.refreshToken)throw err;s=await publicSession({forceRefresh:true});await c.ensureAccount(PUBLIC_ACCOUNT,s.accessToken);}
  const lights=await c.getSymbols(PUBLIC_ACCOUNT);
  publicState.symbolMap=normalizeSymbolMap(lights,aliases);publicState.lightSymbols=lights;
  if(!publicState.listenerAttached){c.addEventListener(`payload:${PT.SPOT_EVENT}`,e=>onPublicSpot(e.detail));publicState.listenerAttached=true;}
  publicState.ready=true;
}
async function recoverPublic(){
  if(publicState.recovering)return publicState.recovering;
  publicState.recovering=(async()=>{
    for(let attempt=0;attempt<8;attempt++){
      try{
        await ensurePublic();
        for(const sub of publicState.subscriptions.values()){
          const meta=await ensureSpot(sub.symbol);sub.symbolId=String(meta.light.symbolId);
          sub.brickSize=meta.pipSize*(sub.period.mode==='renko-time'?5:(Number(sub.period.value)||5));
          sub.rangeSize=meta.pipSize*(Number(sub.period.value)||5);
        }
        broadcast({type:'status',status:'live',detail:'cTrader live market feed connected.'});return true;
      }catch(err){if(attempt===7){broadcast({type:'status',status:'offline',detail:err.message||'cTrader feed reconnect failed.'});return false;}await sleep(Math.min(12000,750*Math.pow(1.7,attempt)));}
    }
    return false;
  })().finally(()=>{publicState.recovering=null;});
  return publicState.recovering;
}
function onUpstreamClose(env){
  if(env===PUBLIC_ENV){publicState.ready=false;publicState.subscribedIds.clear();publicState.fullSymbols.clear();publicState.symbolMap=null;publicState.historyCache.clear();broadcast({type:'status',status:'reconnecting',detail:'Restoring the cTrader market connection…'});setTimeout(()=>recoverPublic(),250);}
  for(const set of personalWatchers[env].values())for(const ws of set)send(ws,{type:'account-status',status:'reconnecting'});
}
function onUpstreamReady(env){
  if(env===PUBLIC_ENV&&!publicState.ready)setTimeout(()=>recoverPublic(),0);
  setTimeout(()=>recoverPersonalEnvironment(env),50);
}
async function fullSymbol(symbolId){
  if(publicState.fullSymbols.has(String(symbolId)))return publicState.fullSymbols.get(String(symbolId));
  const rows=await conn(PUBLIC_ENV).getFullSymbols(PUBLIC_ACCOUNT,[symbolId]),s=rows[0]||{};publicState.fullSymbols.set(String(symbolId),s);return s;
}
async function resolveSymbol(name){
  await ensurePublic();const light=publicState.symbolMap.nameFor(String(name||'').toUpperCase());
  if(!light)throw new Error(`Symbol ${name} was not found on the configured cTrader account. Use CTRADER_SYMBOL_ALIASES if your broker uses a different name.`);
  const full=await fullSymbol(light.symbolId);return{light,full,digits:Number(full.digits??8),pipSize:Math.pow(10,-Number(full.pipPosition??4))};
}
function trendSeconds(id){return({1:60,2:120,3:180,4:240,5:300,6:600,7:900,8:1800,9:3600,10:14400,11:43200,12:86400,13:604800,14:2592000})[id]||60;}
async function historicalTicks(c,accountId,symbolId,fromTimestamp,toTimestamp,maxPages=5){
  let cursor=toTimestamp,all=[];
  for(let page=0;page<maxPages&&cursor>fromTimestamp;page++){
    const r=await c.getTicks(accountId,symbolId,1,{fromTimestamp,toTimestamp:cursor}),chunk=decodeTickData(r.tickData||[]);
    if(!chunk.length)break;all.push(...chunk);const oldest=Math.min(...chunk.map(x=>Number(x.time)).filter(Number.isFinite));
    if(!r.hasMore||!Number.isFinite(oldest)||oldest<=fromTimestamp)break;cursor=oldest-1;if(page+1<maxPages)await sleep(220);
  }
  const byTime=new Map();for(const t of all)byTime.set(`${t.time}|${t.price}`,t);return[...byTime.values()].sort((a,b)=>a.time-b.time);
}
async function history(symbol,period,count=1800){
  const p=period||{mode:'time',value:'15s'},key=`${symbol}|${periodKey(p)}`,cached=publicState.historyCache.get(key);
  if(cached&&Date.now()-cached.at<15000)return cached.bars;if(publicState.historyPending.has(key))return publicState.historyPending.get(key);
  const job=(async()=>{
    const c=conn(PUBLIC_ENV),meta=await resolveSymbol(symbol),plan=planForPeriod(p),now=Date.now();let bars=[];
    if(plan.kind==='trend'){
      const factor=Math.max(1,plan.aggregate||1),baseSec=trendSeconds(plan.trend),needed=Math.min(5000,Math.max(count*factor,300)),from=now-needed*baseSec*1000*1.2;
      const r=await c.getTrendbars(PUBLIC_ACCOUNT,meta.light.symbolId,plan.trend,{fromTimestamp:Math.max(0,Math.floor(from)),toTimestamp:now,count:needed});
      bars=(r.trendbar||[]).map(x=>trendbarToBar(x,meta.digits)).sort((a,b)=>a.time-b.time);if(factor>1)bars=aggregateTimeBars(bars,p.value);bars=bars.slice(-count);
    }else{
      const value=p.value,sec=p.mode==='time'?secondsOf(value):1;let lookback=Math.min(7*86400000,Math.max(30*60*1000,count*sec*1000*2));
      if(p.mode==='tick')lookback=Math.min(7*86400000,Math.max(60*60*1000,Number(value||50)*count*250));
      const ticks=await historicalTicks(c,PUBLIC_ACCOUNT,meta.light.symbolId,now-lookback,now,5);
      if(p.mode==='time')bars=ticksToTimeBars(ticks,value);else if(p.mode==='tick')bars=ticksToCountBars(ticks,Number(value)||50);else if(p.mode==='renko-pips')bars=ticksToRenko(ticks,meta.pipSize*(Number(value)||5));else if(p.mode==='range-pips')bars=ticksToRange(ticks,meta.pipSize*(Number(value)||5));else if(p.mode==='renko-time'){const timed=ticksToTimeBars(ticks,String(value||'1m')),pseudo=timed.map(b=>({time:b.time*1000,price:b.close}));bars=ticksToRenko(pseudo,meta.pipSize*5);}bars=bars.slice(-count);
    }
    publicState.historyCache.set(key,{at:Date.now(),bars});return bars;
  })().finally(()=>publicState.historyPending.delete(key));
  publicState.historyPending.set(key,job);return job;
}

async function ensureSpot(symbol){const meta=await resolveSymbol(symbol),id=String(meta.light.symbolId);if(!publicState.subscribedIds.has(id)){await conn(PUBLIC_ENV).subscribeSpots(PUBLIC_ACCOUNT,[id]);publicState.subscribedIds.add(id);}return meta;}
function onPublicSpot(p){
  if(String(p.ctidTraderAccountId)!==String(PUBLIC_ACCOUNT))return;const light=publicState.symbolMap?.byId.get(String(p.symbolId));if(!light)return;
  const bid=p.bid!=null?price(p.bid):null,ask=p.ask!=null?price(p.ask):null,mid=bid??ask;if(mid==null)return;const rawTs=Number(p.timestamp||Date.now()),ms=rawTs<1e12?rawTs*1000:rawTs;
  for(const sub of publicState.subscriptions.values()){if(String(sub.symbolId)!==String(p.symbolId))continue;sendToSubscription(sub,{type:'quote',symbol:sub.symbol,bid,ask,time:ms});const closed=advanceBar(sub,{time:ms,price:mid});if(closed)sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:closed.bar,closed:closed.closed});}
}
function sendToSubscription(sub,msg){for(const ws of sub.clients)send(ws,msg);}
function advanceBar(sub,tick){const mode=sub.period?.mode||'time';if(mode==='time')return advanceTime(sub,tick);if(mode==='renko-time')return advanceRenkoTime(sub,tick);if(mode==='tick')return advanceTick(sub,tick);if(mode==='renko-pips')return advanceRenko(sub,tick);if(mode==='range-pips')return advanceRange(sub,tick);return null;}
function advanceTime(sub,tick){const sec=Math.floor(tick.time/1000),b=bucketStart(sec,sub.period.value),x=sub.currentBar;if(!x||x.time!==b){const prev=x?{...x}:null;sub.currentBar={time:b,open:tick.price,high:tick.price,low:tick.price,close:tick.price,volume:1};sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:sub.currentBar,closed:false});return prev?{bar:prev,closed:true}:null;}x.high=Math.max(x.high,tick.price);x.low=Math.min(x.low,tick.price);x.close=tick.price;x.volume++;sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:{...x},closed:false});return null;}
function advanceTick(sub,tick){const n=Math.max(1,Number(sub.period.value)||50);sub.tickBuffer.push(tick);if(!sub.currentBar)sub.currentBar={time:Math.floor(tick.time/1000),open:tick.price,high:tick.price,low:tick.price,close:tick.price,volume:1};else{sub.currentBar.high=Math.max(sub.currentBar.high,tick.price);sub.currentBar.low=Math.min(sub.currentBar.low,tick.price);sub.currentBar.close=tick.price;sub.currentBar.volume++;}sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:{...sub.currentBar},closed:false});if(sub.tickBuffer.length>=n){const done={...sub.currentBar};sub.tickBuffer=[];sub.currentBar=null;return{bar:done,closed:true};}return null;}
function renkoFeedPrice(sub,tick){const size=sub.brickSize;if(!(size>0))return;if(sub.anchor==null){sub.anchor=tick.price;return;}let guard=0;while(guard++<5000){let dir=0;if(!sub.renkoDir){if(tick.price>=sub.anchor+size)dir=1;else if(tick.price<=sub.anchor-size)dir=-1;}else if(sub.renkoDir>0){if(tick.price>=sub.anchor+size)dir=1;else if(tick.price<=sub.anchor-2*size){sub.anchor-=size;dir=-1;}}else{if(tick.price<=sub.anchor-size)dir=-1;else if(tick.price>=sub.anchor+2*size){sub.anchor+=size;dir=1;}}if(!dir)break;const o=sub.anchor,c=o+dir*size;sub.anchor=c;sub.renkoDir=dir;sub.syntheticTime=Math.max((sub.syntheticTime||0)+1,Math.floor(tick.time/1000));sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:{time:sub.syntheticTime,open:o,high:Math.max(o,c),low:Math.min(o,c),close:c,volume:1},closed:true});}}
function advanceRenko(sub,tick){renkoFeedPrice(sub,tick);return null;}
function advanceRenkoTime(sub,tick){const value=String(sub.period.value||'1m'),sec=Math.floor(tick.time/1000),bucket=bucketStart(sec,value),x=sub.timeBucket;if(!x||x.time!==bucket){if(x)renkoFeedPrice(sub,{time:x.time*1000,price:x.close});sub.timeBucket={time:bucket,open:tick.price,high:tick.price,low:tick.price,close:tick.price,volume:1};return null;}x.high=Math.max(x.high,tick.price);x.low=Math.min(x.low,tick.price);x.close=tick.price;x.volume++;return null;}
function advanceRange(sub,tick){const size=sub.rangeSize;if(!(size>0))return null;if(!sub.currentBar)sub.currentBar={time:Math.floor(tick.time/1000),open:tick.price,high:tick.price,low:tick.price,close:tick.price,volume:1};let x=sub.currentBar;x.high=Math.max(x.high,tick.price);x.low=Math.min(x.low,tick.price);x.close=tick.price;x.volume++;sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:{...x},closed:false});let guard=0;while(x.high-x.low>=size&&guard++<5000){const up=x.high-x.open>=size,c=up?x.open+size:x.open-size,done={time:Math.floor(tick.time/1000),open:x.open,high:Math.max(x.open,c),low:Math.min(x.open,c),close:c,volume:x.volume};sendToSubscription(sub,{type:'bar',symbol:sub.symbol,period:sub.period,bar:done,closed:true});x={time:Math.floor(tick.time/1000),open:c,high:Math.max(c,tick.price),low:Math.min(c,tick.price),close:tick.price,volume:0};sub.currentBar=x;}return null;}

async function subscribe(ws,symbol,period){
  const name=String(symbol||'').toUpperCase(),p=period||{mode:'time',value:'15s'},key=`${name}|${periodKey(p)}`;let sub=publicState.subscriptions.get(key);
  if(!sub){const meta=await ensureSpot(name);sub={key,symbol:name,period:p,symbolId:String(meta.light.symbolId),clients:new Set(),tickBuffer:[],currentBar:null,timeBucket:null,anchor:null,renkoDir:0,syntheticTime:0,brickSize:meta.pipSize*(p.mode==='renko-time'?5:(Number(p.value)||5)),rangeSize:meta.pipSize*(Number(p.value)||5)};publicState.subscriptions.set(key,sub);}
  sub.clients.add(ws);ws.subscriptions.add(key);const bars=await history(name,p,1800);
  if(bars.length){const last=bars.at(-1);if(p.mode==='time')sub.currentBar={...last};if(p.mode==='tick'){const n=Math.max(1,Number(p.value)||50),partial=Math.max(0,Math.min(n-1,Number(last.volume)||0));if(partial>0){sub.currentBar={...last};sub.tickBuffer=new Array(partial).fill(null);}else{sub.currentBar=null;sub.tickBuffer=[];}}if(p.mode==='range-pips')sub.currentBar={time:Number(last.time)||0,open:Number(last.close),high:Number(last.close),low:Number(last.close),close:Number(last.close),volume:0};if(p.mode==='renko-pips'||p.mode==='renko-time'){sub.anchor=Number(last.close);sub.renkoDir=Number(last.close)>=Number(last.open)?1:-1;sub.syntheticTime=Number(last.time)||0;}}
  send(ws,{type:'history',symbol:name,period:p,bars});
}
async function unsubscribe(ws,symbol,period){
  const key=`${String(symbol||'').toUpperCase()}|${periodKey(period)}`,sub=publicState.subscriptions.get(key);if(!sub)return;sub.clients.delete(ws);ws.subscriptions.delete(key);
  if(!sub.clients.size){publicState.subscriptions.delete(key);const id=String(sub.symbolId);if(![...publicState.subscriptions.values()].some(x=>String(x.symbolId)===id)){try{await conn(PUBLIC_ENV).unsubscribeSpots(PUBLIC_ACCOUNT,[id]);}catch{}publicState.subscribedIds.delete(id);}}
}

function unregisterPersonal(ws){
  const p=ws.personal;if(!p)return;const set=personalWatchers[p.env]?.get(String(p.accountId));set?.delete(ws);if(set&&!set.size)personalWatchers[p.env].delete(String(p.accountId));ws.personal=null;
}
function registerPersonal(ws,info){unregisterPersonal(ws);ws.personal=info;let set=personalWatchers[info.env].get(String(info.accountId));if(!set){set=new Set();personalWatchers[info.env].set(String(info.accountId),set);}set.add(ws);}
function schedulePersonalSnapshot(ws){clearTimeout(ws.personalRefreshTimer);ws.personalRefreshTimer=setTimeout(()=>{if(ws.userUid&&ws.readyState===WebSocket.OPEN)personalSnapshot(ws,ws.userUid).catch(err=>send(ws,{type:'account-status',status:'error',detail:err.message}));},150);}
function onPersonalExecution(env,p){
  const accountId=String(p.ctidTraderAccountId||''),set=personalWatchers[env].get(accountId);if(!set?.size)return;
  for(const ws of set){const trade=p.deal?normalizeDeals([p.deal],ws.personal?.symbolById||new Map())[0]:null;send(ws,{type:'trade-event',event:{executionType:p.executionType,accountId,trade,positionId:p.position?.positionId||p.deal?.positionId||null,orderId:p.order?.orderId||p.deal?.orderId||null,time:Date.now()}});schedulePersonalSnapshot(ws);}
}
function onPersonalTraderUpdate(env,p){const set=personalWatchers[env].get(String(p.ctidTraderAccountId||''));if(!set?.size)return;for(const ws of set)schedulePersonalSnapshot(ws);}
async function recoverPersonalEnvironment(env){const all=new Set();for(const set of personalWatchers[env].values())for(const ws of set)all.add(ws);for(const ws of all)if(ws.userUid&&ws.readyState===WebSocket.OPEN)personalSnapshot(ws,ws.userUid).catch(()=>{});}
async function personalSnapshot(ws,uid){
  const s=await freshSession(uid);if(!s){unregisterPersonal(ws);return send(ws,{type:'account',connected:false});}
  let accounts=[];try{accounts=await conn('live').getAccounts(s.accessToken);}catch{try{accounts=await conn('demo').getAccounts(s.accessToken);}catch{}}
  if(!accounts.length){unregisterPersonal(ws);return send(ws,{type:'account',connected:false,detail:'No cTrader account was authorised.'});}
  const selected=accounts.find(a=>String(a.ctidTraderAccountId)===String(s.selectedAccountId))||accounts[0],env=selected.isLive?'live':'demo',c=conn(env),accountId=String(selected.ctidTraderAccountId);
  await c.ensureAccount(accountId,s.accessToken);const symbols=await c.getSymbols(accountId),symbolById=new Map(symbols.map(x=>[String(x.symbolId),x]));
  const [trader,recon,deals,pnl]=await Promise.all([c.trader(accountId),c.reconcile(accountId),c.deals(accountId,{maxRows:1000}),c.positionPnl(accountId).catch(()=>({}))]);
  const traderRow=trader.trader||{},digits=Number(pnl.moneyDigits??traderRow.moneyDigits??0),pnlById=new Map((pnl.positionUnrealizedPnL||[]).map(x=>[String(x.positionId),x]));
  const positions=(recon.position||[]).map(x=>{const row=normalizePosition(x,symbolById),pp=pnlById.get(String(x.positionId));return{...row,grossUnrealizedPnl:money(pp?.grossUnrealizedPnL,digits),pnl:money(pp?.netUnrealizedPnL,digits)};});
  const balance=money(traderRow.balance,digits),netUnrealized=[...pnlById.values()].reduce((sum,x)=>sum+(money(x.netUnrealizedPnL,digits)||0),0),equity=Number.isFinite(balance)?balance+netUnrealized:null;
  if(String(s.selectedAccountId||'')!==accountId){s.selectedAccountId=accountId;await saveSession(uid,s);}
  registerPersonal(ws,{env,accountId,symbolById});
  send(ws,{type:'account',connected:true,account:{ctidTraderAccountId:accountId,traderLogin:selected.traderLogin,broker:selected.brokerTitleShort,isLive:!!selected.isLive,balance,equity,unrealizedPnl:netUnrealized,moneyDigits:digits}});
  send(ws,{type:'positions',positions});send(ws,{type:'orders',orders:(recon.order||[]).map(x=>normalizeOrder(x,symbolById))});send(ws,{type:'trade-history',trades:normalizeDeals(deals.deal||[],symbolById)});send(ws,{type:'account-status',status:'live'});
}

const server=http.createServer(async(req,res)=>{
  if(!originAllowed(req.headers.origin||'')&&req.headers.origin)return json(req,res,403,{error:'Origin not allowed'});
  if(req.method==='OPTIONS')return json(req,res,204,{});const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  try{
    if(u.pathname==='/health')return json(req,res,200,{ok:true,publicFeedConfigured:!!(CLIENT_ID&&CLIENT_SECRET&&PUBLIC_ACCOUNT&&(PUBLIC_BOOTSTRAP_ACCESS||PUBLIC_BOOTSTRAP_REFRESH)),environment:PUBLIC_ENV,originConfigured:configuredOrigins.length>0});
    if(u.pathname==='/api/account/bootstrap'&&req.method==='POST'){
      if(!requireRate(req,res,'account-bootstrap',30))return;const decoded=await verifyBearer(req.headers.authorization||'');const result=await ensureAccountIdentity(decoded);return json(req,res,200,result);
    }
    if(u.pathname==='/api/ctrader/session/start'&&req.method==='POST'){
      if(!requireRate(req,res,'oauth-start',12))return;const decoded=await verifyBearer(req.headers.authorization||'');const b=await body(req),scope=b.scope==='trading'?'trading':'accounts';if(!CLIENT_ID||!REDIRECT_URI)throw new Error('cTrader OAuth is not configured');
      const state=crypto.randomBytes(32).toString('base64url');await saveOAuthState(decoded.uid,state,scope);
      const auth=new URL('https://id.ctrader.com/my/settings/openapi/grantingaccess/');auth.searchParams.set('client_id',CLIENT_ID);auth.searchParams.set('redirect_uri',REDIRECT_URI);auth.searchParams.set('scope',scope);auth.searchParams.set('product','web');auth.searchParams.set('state',state);return json(req,res,200,{authorizeUrl:auth.toString(),scope});
    }
    if(u.pathname==='/api/ctrader/session/complete'&&req.method==='POST'){
      if(!requireRate(req,res,'oauth-complete',12))return;const decoded=await verifyBearer(req.headers.authorization||''),b=await body(req);if(!b.code)throw Object.assign(new Error('Missing cTrader authorization code'),{status:400});if(!b.state)throw Object.assign(new Error('Missing OAuth state'),{status:400});
      const oauth=await consumeOAuthState(decoded.uid,b.state);const t=await tokenExchange({grant_type:'authorization_code',code:b.code,redirect_uri:REDIRECT_URI});await saveSession(decoded.uid,{...t,scope:oauth.scope,expiresAt:expiresAt(t)});return json(req,res,200,{ok:true,scope:oauth.scope});
    }
    if(u.pathname==='/api/ctrader/session/disconnect'&&req.method==='POST'){if(!requireRate(req,res,'oauth-disconnect',30))return;const decoded=await verifyBearer(req.headers.authorization||'');await deleteSession(decoded.uid);return json(req,res,200,{ok:true});}
    return json(req,res,404,{error:'Not found'});
  }catch(err){console.error(err);return json(req,res,err.status||500,{error:err.message||'Gateway error'});}
});

const wss=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:MAX_WS_MESSAGE_BYTES});
server.on('upgrade',(req,socket,head)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),ip=clientIp(req);if(u.pathname!=='/ws/market'||!originAllowed(req.headers.origin||'')){socket.destroy();return;}
  const sameIp=[...clients].filter(x=>x.__taIp===ip).length;if(clients.size>=MAX_WS_CLIENTS||sameIp>=MAX_WS_PER_IP){socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{ws.__taIp=ip;wss.emit('connection',ws,req);});
});
wss.on('connection',ws=>{
  ws.subscriptions=new Set();ws.userUid=null;ws.personal=null;ws.__taMessageWindow={start:Date.now(),count:0};clients.add(ws);send(ws,{type:'hello',service:'Trade Avata cTrader Gateway'});
  if(!(CLIENT_ID&&CLIENT_SECRET&&PUBLIC_ACCOUNT&&(PUBLIC_BOOTSTRAP_ACCESS||PUBLIC_BOOTSTRAP_REFRESH)))send(ws,{type:'status',status:'not-configured',detail:'The cTrader gateway is deployed but public feed credentials/account are not configured.'});else send(ws,{type:'status',status:'connecting',detail:'Preparing cTrader market feed…'});
  ws.on('message',async raw=>{
    const now=Date.now();if(now-ws.__taMessageWindow.start>=60000)ws.__taMessageWindow={start:now,count:0};if(++ws.__taMessageWindow.count>180){send(ws,{type:'error',message:'WebSocket message rate limit exceeded.'});return ws.close(1008,'rate-limit');}
    let m;try{m=JSON.parse(raw.toString());}catch{return;}
    try{
      if(m.type==='ping')return send(ws,{type:'pong',time:Date.now()});
      if(m.type==='subscribe'){if(ws.subscriptions.size>=MAX_SUBSCRIPTIONS_PER_CLIENT&&!ws.subscriptions.has(`${String(m.symbol||'').toUpperCase()}|${periodKey(m.period)}`))throw Object.assign(new Error('Subscription limit reached for this connection.'),{status:429});if(String(m.symbol||'').length>32)throw new Error('Invalid symbol.');await ensurePublic();await subscribe(ws,m.symbol,m.period);send(ws,{type:'status',status:'live',detail:'cTrader live market feed connected.'});return;}
      if(m.type==='unsubscribe'){await unsubscribe(ws,m.symbol,m.period);return;}
      if(m.type==='auth'&&m.firebaseIdToken){const decoded=await verifyBearer(`Bearer ${m.firebaseIdToken}`);ws.userUid=decoded.uid;await personalSnapshot(ws,decoded.uid);return;}
    }catch(err){send(ws,{type:'error',message:err.message||'Gateway request failed'});}
  });
  ws.on('close',()=>{clients.delete(ws);clearTimeout(ws.personalRefreshTimer);unregisterPersonal(ws);for(const key of ws.subscriptions){const sub=publicState.subscriptions.get(key);sub?.clients.delete(ws);if(sub&&!sub.clients.size)publicState.subscriptions.delete(key);}});
});

server.listen(PORT,()=>console.log(`Trade Avata cTrader gateway listening on ${PORT}`));
process.on('SIGTERM',()=>{for(const c of Object.values(connections))c?.stop();server.close(()=>process.exit(0));});
