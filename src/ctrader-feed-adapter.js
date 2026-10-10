/* cTrader-ready provider for Trade Avata.
 * No cTrader Client Secret is ever stored here.
 * This browser module talks only to a secure Trade Avata gateway over HTTPS/WSS.
 */
import hub from './market-feed-adapter.js';

const DEFAULT_CONFIG={
  enabled:false,
  gatewayWs:'',
  gatewayHttp:'',
  provider:'ctrader',
  reconnectMinMs:750,
  reconnectMaxMs:15000,
  staleAfterMs:15000,
  heartbeatMs:20000
};

function runtimeConfig(){
  const cfg={...DEFAULT_CONFIG,...(window.TRADE_AVATA_CTRADER_CONFIG||{})};
  const meta=document.querySelector('meta[name="trade-avata-ctrader-gateway"]')?.content?.trim();
  if(meta&&!cfg.gatewayHttp)cfg.gatewayHttp=meta;
  if(cfg.gatewayHttp&&!cfg.gatewayWs){
    try{const u=new URL(cfg.gatewayHttp,location.href);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname=u.pathname.replace(/\/$/,'')+'/ws/market';cfg.gatewayWs=u.toString();}catch{}
  }
  cfg.enabled=cfg.enabled===true||!!cfg.gatewayWs;
  return cfg;
}

function periodWire(period){
  if(!period)return{mode:'time',value:'15s'};
  if(typeof period==='string')return{mode:'time',value:period};
  return{mode:period.mode||'time',value:period.value??'15s'};
}

class CTraderGatewayProvider{
  constructor(){
    this.socket=null;this.hub=null;this.reconnectTimer=null;this.heartbeatTimer=null;this.staleTimer=null;
    this.attempt=0;this.manualClose=false;this.desiredSubscriptions=new Map();this.lastMessageAt=0;
  }

  get config(){return runtimeConfig();}

  connect(){
    const cfg=this.config;
    if(!cfg.enabled||!cfg.gatewayWs){this.hub?.setStatus('not-configured','cTrader gateway is ready in the frontend but its secure live endpoint has not been configured.');return;}
    if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;
    this.manualClose=false;clearTimeout(this.reconnectTimer);
    this.hub?.setStatus(this.attempt?'reconnecting':'connecting',this.attempt?'Reconnecting to cTrader live feed…':'Connecting to cTrader live feed…');
    try{
      this.socket=new WebSocket(cfg.gatewayWs);
    }catch(err){this.failAndRetry(err);return;}
    this.socket.addEventListener('open',()=>this.onOpen());
    this.socket.addEventListener('message',e=>this.onMessage(e.data));
    this.socket.addEventListener('close',e=>this.onClose(e));
    this.socket.addEventListener('error',()=>this.hub?.setStatus('error','The live market connection reported a network error.'));
  }

  onOpen(){
    this.attempt=0;this.lastMessageAt=Date.now();
    this.hub?.setStatus('live','cTrader live market feed connected.');
    for(const sub of this.desiredSubscriptions.values())this.send({type:'subscribe',...sub});
    this.authenticatePersonalSession();
    this.startHealthChecks();
  }

  async authenticatePersonalSession(){
    try{const token=await window.TRADE_AVATA_AUTH_ADAPTER?.getIdToken?.();if(token)this.send({type:'auth',firebaseIdToken:token});}catch(err){console.warn('[cTrader Gateway] Personal session authentication skipped',err);}
  }

  startHealthChecks(){
    clearInterval(this.heartbeatTimer);clearInterval(this.staleTimer);
    this.heartbeatTimer=setInterval(()=>this.send({type:'ping',time:Date.now()}),this.config.heartbeatMs);
    this.staleTimer=setInterval(()=>{
      if(!this.socket||this.socket.readyState!==WebSocket.OPEN)return;
      if(Date.now()-this.lastMessageAt>this.config.staleAfterMs){
        this.hub?.setStatus('reconnecting','Live feed became stale; reconnecting…');
        try{this.socket.close(4000,'stale-feed');}catch{}
      }
    },Math.min(5000,Math.max(1500,this.config.staleAfterMs/3)));
  }

  onMessage(raw){
    this.lastMessageAt=Date.now();
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(!msg||typeof msg!=='object')return;
    switch(msg.type){
      case 'hello':case 'pong':case 'heartbeat':break;
      case 'status':this.hub?.setStatus(msg.status||'live',msg.detail||'');break;
      case 'history':this.hub?.publishHistory(msg);break;
      case 'bar':this.hub?.publishBar(msg);break;
      case 'quote':this.hub?.publishQuote(msg);break;
      case 'account':this.hub?.publishAccount(msg);break;
      case 'positions':this.hub?.publishPositions(msg);break;
      case 'orders':this.hub?.publishOrders(msg);break;
      case 'trade-history':this.hub?.publishHistoryTrades(msg);break;
      case 'trade-event':this.hub?.publishTradeEvent(msg);break;
      case 'error':console.warn('[cTrader Gateway]',msg.message||msg);break;
      default:break;
    }
  }

  onClose(){
    clearInterval(this.heartbeatTimer);clearInterval(this.staleTimer);this.socket=null;
    if(this.manualClose){this.hub?.setStatus('offline','Live feed disconnected.');return;}
    this.scheduleReconnect();
  }

  failAndRetry(err){console.warn('[cTrader Gateway] Connection failed',err);this.scheduleReconnect();}

  scheduleReconnect(){
    const cfg=this.config;this.attempt+=1;
    const base=Math.min(cfg.reconnectMaxMs,cfg.reconnectMinMs*Math.pow(1.8,Math.min(this.attempt,8)));
    const delay=Math.round(base*(.8+Math.random()*.4));
    this.hub?.setStatus('reconnecting',`Reconnecting to cTrader live feed…`);
    clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.connect(),delay);
  }

  disconnect(reason='manual'){
    this.manualClose=true;clearTimeout(this.reconnectTimer);clearInterval(this.heartbeatTimer);clearInterval(this.staleTimer);
    try{this.socket?.close(1000,reason);}catch{}this.socket=null;
    this.hub?.setStatus('offline','Live feed disconnected.');
  }

  send(obj){if(this.socket?.readyState===WebSocket.OPEN){try{this.socket.send(JSON.stringify(obj));return true;}catch{}}return false;}

  subscribe({symbol,period}){
    const sub={symbol:String(symbol||'').toUpperCase(),period:periodWire(period)};
    const key=`${sub.symbol}|${JSON.stringify(sub.period)}`;this.desiredSubscriptions.set(key,sub);
    if(!this.socket||this.socket.readyState>1)this.connect();
    this.send({type:'subscribe',...sub});
  }

  unsubscribe({symbol,period}){
    const sub={symbol:String(symbol||'').toUpperCase(),period:periodWire(period)};
    const key=`${sub.symbol}|${JSON.stringify(sub.period)}`;this.desiredSubscriptions.delete(key);
    this.send({type:'unsubscribe',...sub});
  }

  async secureJson(path,{method='GET',body}={}){
    const cfg=this.config;if(!cfg.gatewayHttp)throw new Error('Secure cTrader account gateway is not configured.');
    const token=await window.TRADE_AVATA_AUTH_ADAPTER?.getIdToken?.();
    if(!token)throw new Error('Sign in to Trade Avata before connecting a trading account.');
    const r=await fetch(`${cfg.gatewayHttp.replace(/\/$/,'')}${path}`,{
      method,credentials:'omit',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:body==null?undefined:JSON.stringify(body)
    });
    if(!r.ok){const text=await r.text().catch(()=> '');throw new Error(text||`Gateway returned ${r.status}.`);}return r.json();
  }

  async connectTradingAccount({scope='accounts'}={}){
    sessionStorage.setItem('tradeAvataCTraderScope',scope);
    const result=await this.secureJson('/api/ctrader/session/start',{method:'POST',body:{scope}});
    if(!result?.authorizeUrl)throw new Error('The secure gateway did not return a cTrader authorization address.');
    location.assign(result.authorizeUrl);
  }

  async disconnectTradingAccount(){return this.secureJson('/api/ctrader/session/disconnect',{method:'POST',body:{}});}
}

const provider=new CTraderGatewayProvider();
hub.registerProvider('ctrader',provider);
hub.useProvider('ctrader');
queueMicrotask(()=>hub.connect());
window.addEventListener('tradeavata:auth-state',()=>provider.authenticatePersonalSession());
window.TRADE_AVATA_CTRADER_PROVIDER=provider;
export default provider;
