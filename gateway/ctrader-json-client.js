import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';

export const PT={
  HEARTBEAT:51,
  APP_AUTH_REQ:2100,APP_AUTH_RES:2101,
  ACCOUNT_AUTH_REQ:2102,ACCOUNT_AUTH_RES:2103,
  SYMBOLS_LIST_REQ:2114,SYMBOLS_LIST_RES:2115,
  SYMBOL_BY_ID_REQ:2116,SYMBOL_BY_ID_RES:2117,
  TRADER_REQ:2121,TRADER_RES:2122,TRADER_UPDATE:2123,
  RECONCILE_REQ:2124,RECONCILE_RES:2125,EXECUTION_EVENT:2126,
  SUBSCRIBE_SPOTS_REQ:2127,SUBSCRIBE_SPOTS_RES:2128,
  UNSUBSCRIBE_SPOTS_REQ:2129,UNSUBSCRIBE_SPOTS_RES:2130,SPOT_EVENT:2131,
  DEAL_LIST_REQ:2133,DEAL_LIST_RES:2134,
  GET_TRENDBARS_REQ:2137,GET_TRENDBARS_RES:2138,
  GET_TICKDATA_REQ:2145,GET_TICKDATA_RES:2146,
  ACCOUNTS_BY_TOKEN_REQ:2149,ACCOUNTS_BY_TOKEN_RES:2150,
  ACCOUNT_LOGOUT_REQ:2162,ACCOUNT_LOGOUT_RES:2163,
  ORDER_LIST_REQ:2175,ORDER_LIST_RES:2176,
  POSITION_PNL_REQ:2187,POSITION_PNL_RES:2188,
  ERROR_RES:2142
};

const endpoint=env=>env==='demo'?'wss://demo.ctraderapi.com:5036':'wss://live.ctraderapi.com:5036';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export class CTraderJsonConnection extends EventTarget{
  constructor({environment='live',clientId,clientSecret,logger=console}={}){
    super();this.environment=environment==='demo'?'demo':'live';this.clientId=clientId;this.clientSecret=clientSecret;this.logger=logger;
    this.ws=null;this.pending=new Map();this.readyPromise=null;this.heartbeat=null;this.authenticatedAccounts=new Set();this.stopped=false;this.reconnectAttempt=0;
  }
  get isOpen(){return this.ws?.readyState===WebSocket.OPEN;}
  async connect(){
    if(this.readyPromise)return this.readyPromise;
    this.stopped=false;
    this.readyPromise=new Promise((resolve,reject)=>{
      const ws=new WebSocket(endpoint(this.environment),{perMessageDeflate:false,handshakeTimeout:12000});this.ws=ws;
      const timer=setTimeout(()=>reject(new Error(`cTrader ${this.environment} connection timed out`)),15000);
      ws.on('open',async()=>{try{await this.request(PT.APP_AUTH_REQ,{clientId:this.clientId,clientSecret:this.clientSecret},{expect:PT.APP_AUTH_RES,timeout:12000});clearTimeout(timer);this.reconnectAttempt=0;this.startHeartbeat();this.dispatchEvent(new Event('ready'));resolve(this);}catch(err){clearTimeout(timer);reject(err);try{ws.close();}catch{}}});
      ws.on('message',buf=>this.onMessage(buf.toString()));
      ws.on('close',()=>this.onClose());
      ws.on('error',err=>this.logger.warn?.(`[cTrader ${this.environment}]`,err?.message||err));
    }).catch(err=>{this.readyPromise=null;throw err;});
    return this.readyPromise;
  }
  startHeartbeat(){clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>this.sendRaw({clientMsgId:randomUUID(),payloadType:PT.HEARTBEAT,payload:{}}),10000);}
  sendRaw(message){if(!this.isOpen)throw new Error('cTrader socket is not open');this.ws.send(JSON.stringify(message));}
  request(payloadType,payload={},opts={}){
    const clientMsgId=randomUUID(),expect=opts.expect,timeout=opts.timeout||15000;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(clientMsgId);reject(new Error(`cTrader request ${payloadType} timed out`));},timeout);
      this.pending.set(clientMsgId,{resolve,reject,timer,expect});
      try{this.sendRaw({clientMsgId,payloadType,payload});}catch(err){clearTimeout(timer);this.pending.delete(clientMsgId);reject(err);}
    });
  }
  onMessage(raw){
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(msg.clientMsgId&&this.pending.has(msg.clientMsgId)){
      const p=this.pending.get(msg.clientMsgId);
      if(msg.payloadType===PT.ERROR_RES||msg.payload?.errorCode){clearTimeout(p.timer);this.pending.delete(msg.clientMsgId);p.reject(new Error(`${msg.payload?.errorCode||'CTRADER_ERROR'}: ${msg.payload?.description||'Request failed'}`));return;}
      if(!p.expect||p.expect===msg.payloadType){clearTimeout(p.timer);this.pending.delete(msg.clientMsgId);p.resolve(msg.payload||{});}
    }
    this.dispatchEvent(new CustomEvent('message',{detail:msg}));
    this.dispatchEvent(new CustomEvent(`payload:${msg.payloadType}`,{detail:msg.payload||{}}));
  }
  onClose(){
    clearInterval(this.heartbeat);this.heartbeat=null;this.readyPromise=null;this.authenticatedAccounts.clear();
    for(const [id,p] of this.pending){clearTimeout(p.timer);p.reject(new Error('cTrader connection closed'));this.pending.delete(id);}
    this.dispatchEvent(new Event('close'));
    if(!this.stopped)this.scheduleReconnect();
  }
  scheduleReconnect(){const n=++this.reconnectAttempt,delay=Math.min(15000,750*Math.pow(1.8,Math.min(n,8)));setTimeout(()=>{if(!this.stopped)this.connect().catch(()=>{});},Math.round(delay*(.85+Math.random()*.3)));}
  async ensureAccount(accountId,accessToken){await this.connect();const id=String(accountId);if(this.authenticatedAccounts.has(id))return;await this.request(PT.ACCOUNT_AUTH_REQ,{ctidTraderAccountId:id,accessToken},{expect:PT.ACCOUNT_AUTH_RES});this.authenticatedAccounts.add(id);}
  async getAccounts(accessToken){await this.connect();const r=await this.request(PT.ACCOUNTS_BY_TOKEN_REQ,{accessToken},{expect:PT.ACCOUNTS_BY_TOKEN_RES});return r.ctidTraderAccount||[];}
  async getSymbols(accountId){const r=await this.request(PT.SYMBOLS_LIST_REQ,{ctidTraderAccountId:String(accountId),includeArchivedSymbols:false},{expect:PT.SYMBOLS_LIST_RES});return r.symbol||[];}
  async getFullSymbols(accountId,ids){const r=await this.request(PT.SYMBOL_BY_ID_REQ,{ctidTraderAccountId:String(accountId),symbolId:ids.map(String)},{expect:PT.SYMBOL_BY_ID_RES});return r.symbol||[];}
  async subscribeSpots(accountId,ids){return this.request(PT.SUBSCRIBE_SPOTS_REQ,{ctidTraderAccountId:String(accountId),symbolId:ids.map(String),subscribeToSpotTimestamp:true},{expect:PT.SUBSCRIBE_SPOTS_RES});}
  async unsubscribeSpots(accountId,ids){return this.request(PT.UNSUBSCRIBE_SPOTS_REQ,{ctidTraderAccountId:String(accountId),symbolId:ids.map(String)},{expect:PT.UNSUBSCRIBE_SPOTS_RES});}
  async getTrendbars(accountId,symbolId,period,{fromTimestamp,toTimestamp,count=1800}={}){return this.request(PT.GET_TRENDBARS_REQ,{ctidTraderAccountId:String(accountId),symbolId:String(symbolId),period,fromTimestamp,toTimestamp,count},{expect:PT.GET_TRENDBARS_RES,timeout:20000});}
  async getTicks(accountId,symbolId,type,{fromTimestamp,toTimestamp}={}){return this.request(PT.GET_TICKDATA_REQ,{ctidTraderAccountId:String(accountId),symbolId:String(symbolId),type,fromTimestamp,toTimestamp},{expect:PT.GET_TICKDATA_RES,timeout:20000});}
  async trader(accountId){return this.request(PT.TRADER_REQ,{ctidTraderAccountId:String(accountId)},{expect:PT.TRADER_RES});}
  async reconcile(accountId){return this.request(PT.RECONCILE_REQ,{ctidTraderAccountId:String(accountId),returnProtectionOrders:false},{expect:PT.RECONCILE_RES});}
  async deals(accountId,{fromTimestamp=Date.now()-90*86400000,toTimestamp=Date.now(),maxRows=1000}={}){return this.request(PT.DEAL_LIST_REQ,{ctidTraderAccountId:String(accountId),fromTimestamp,toTimestamp,maxRows},{expect:PT.DEAL_LIST_RES});}
  async orders(accountId,{fromTimestamp=Date.now()-90*86400000,toTimestamp=Date.now()}={}){return this.request(PT.ORDER_LIST_REQ,{ctidTraderAccountId:String(accountId),fromTimestamp,toTimestamp},{expect:PT.ORDER_LIST_RES});}
  async positionPnl(accountId){return this.request(PT.POSITION_PNL_REQ,{ctidTraderAccountId:String(accountId)},{expect:PT.POSITION_PNL_RES});}
  stop(){this.stopped=true;clearInterval(this.heartbeat);try{this.ws?.close(1000,'shutdown');}catch{}this.ws=null;}
}
