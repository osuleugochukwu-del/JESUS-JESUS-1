const status=document.querySelector('#status');
const set=(title,text)=>{status.innerHTML='';const s=document.createElement('strong');s.textContent=title;status.append(s,document.createTextNode(text));};
const params=new URLSearchParams(location.search),code=params.get('code'),state=params.get('state'),error=params.get('error')||params.get('errorCode');
async function run(){
  if(error){set('cTrader did not connect.',params.get('description')||error);return;}
  if(!code){set('No cTrader authorization code was received.','Return to Trade Avata and try Connect cTrader again.');return;}
  if(!state){set('The cTrader security state was not returned.','Return to Trade Avata and start the connection again.');return;}
  const cfg=window.TRADE_AVATA_CTRADER_CONFIG||{},base=String(cfg.gatewayHttp||'').replace(/\/$/,'');
  if(!base){set('Trade Avata gateway is not configured.','The cTrader authorization succeeded, but the secure Trade Avata gateway address has not been added yet.');return;}
  try{
    const adapter=window.TRADE_AVATA_AUTH_ADAPTER;if(!adapter)throw new Error('Trade Avata authentication is not available.');
    await adapter.sessionReady;const token=await adapter.getIdToken?.();if(!token)throw new Error('Your Trade Avata sign-in session was not restored. Sign in and connect cTrader again.');
    const r=await fetch(`${base}/api/ctrader/session/complete`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({code,state})});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Gateway returned ${r.status}.`);
    set('cTrader connected.','Returning to your Trade Avata workspace…');
    sessionStorage.removeItem('tradeAvataCTraderScope');
    setTimeout(()=>location.replace('./?ctrader=connected'),700);
  }catch(err){set('Could not finish the cTrader connection.',err?.message||'Please return to Trade Avata and try again.');}
}
run();
