/* Trade Avata Live-Ready Final Layer
 * Additive/corrective only: current JESUS-JESUS V11.1 remains the baseline.
 * - mobile portrait/landscape trading panel correction
 * - restored Indicator Portal
 * - cTrader/public market-feed socket + personal account hooks
 * - dense-chart pan performance correction
 * - Firebase session restoration wiring
 */
import {el,toast,clamp} from './utils.js';
import {ChartPane} from './chart-pane.js';
import {heikinAshi,formatPrice} from './data.js';
import {computeIndicator,valuesToData} from './indicators.js';
import {validateIndicatorSpec,safeIndicatorSummary} from './indicator-security.js';
import marketFeed from './market-feed-adapter.js';
import cTraderProvider from './ctrader-feed-adapter.js';

const BUILD='Trade Avata V11.2 Live-Ready Final R3';
const PORTAL_MAX_FILE=8*1024*1024;
const PORTAL_MAX_FILES=32;
const PORTAL_MAX_TOTAL=32*1024*1024;
const SOURCE_MAX_FILE=768*1024;
const ALLOWED_EXT=new Set(['json','cs','algo','zip','mq4','mq5','mqh','txt','md','taind']);
const SOURCE_EXT=new Set(['json','cs','mq4','mq5','mqh','txt','md','taind']);
const PANEL_TABS=['orders','positions','analytics','replay','alerts','history'];

const $=q=>document.querySelector(q);
const nowIso=()=>new Date().toISOString();
const clone=v=>{try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}};
const uid=(p='id')=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const cap=s=>String(s||'').replace(/^./,m=>m.toUpperCase());
const currentUser=app=>app.state.connection?.tradeAvataUser||null;
const authed=app=>!!currentUser(app);
const role=app=>String(currentUser(app)?.role||app.state.identity?.role||'guest').toLowerCase();
const isOwner=app=>role(app)==='owner';

function viewSize(){const v=window.visualViewport;return{w:Math.round(v?.width||innerWidth),h:Math.round(v?.height||innerHeight)};}
function isMobile(){return viewSize().w<=780||('ontouchstart'in window&&Math.min(viewSize().w,viewSize().h)<=780);}
function isPhoneLandscape(){const{w,h}=viewSize();return isMobile()&&w>h&&h<=540;}
function afterFrame(fn){requestAnimationFrame(()=>requestAnimationFrame(fn));}
function resizeCharts(app){cancelAnimationFrame(app.__taResizeRAF);app.__taResizeRAF=requestAnimationFrame(()=>{for(const p of app.panes||[])try{p.resize?.();}catch{};});}

/* -------------------------------------------------------------------------- */
/* Dense chart interaction: keep native candles moving while expensive         */
/* overlays/range-sync are coalesced during zoomed-out drag.                   */
/* -------------------------------------------------------------------------- */
function visibleCount(pane){
  try{const r=pane.chart?.timeScale?.().getVisibleLogicalRange?.();return r?Math.max(0,Math.ceil(r.to-r.from)):0;}catch{return 0;}
}

function patchDenseChartPerformance(app){
  if(!ChartPane.prototype.__taLiveReadyOverlay){
    const original=ChartPane.prototype.renderOverlays;
    ChartPane.prototype.__taLiveReadyOverlay=original;
    ChartPane.prototype.renderOverlays=function(force=false){
      const count=visibleCount(this),interacting=document.body.classList.contains('ta-chart-interacting');
      const t=performance.now();
      const gap=interacting?(count>1600?48:count>700?32:16):0;
      if(force||!interacting||t-(this.__taOverlayLast||0)>=gap){
        this.__taOverlayLast=t;
        if(interacting&&count>700){
          // Draw user drawings at a capped frame rate; defer the decorative round grid
          // until release. Native candles remain fully interactive underneath.
          try{this.drawingLayer?.render?.();}catch{}
          this.__taRoundGridDirty=true;
        }else{
          original.call(this);
          this.__taRoundGridDirty=false;
        }
        return;
      }
      if(this.__taOverlayRAF)return;
      this.__taOverlayRAF=requestAnimationFrame(()=>{
        this.__taOverlayRAF=0;this.__taOverlayLast=performance.now();
        if(document.body.classList.contains('ta-chart-interacting')&&visibleCount(this)>700){try{this.drawingLayer?.render?.();}catch{};this.__taRoundGridDirty=true;}
        else{original.call(this);this.__taRoundGridDirty=false;}
      });
    };
  }

  if(!app.__taRangeSyncOriginal){
    app.__taRangeSyncOriginal=app.onPaneRangeChanged?.bind(app);
    app.onPaneRangeChanged=function(source,range){
      if(this.state.replay.active&&source===this.activePane?.()&&this.state.replay.follow){this.state.replay.follow=false;this.renderReplayControls?.(source);}
      if(!this.state.layoutSync?.time)return;
      source.__taPendingRange=range||source.chart?.timeScale?.().getVisibleLogicalRange?.();
      if(source.__taRangeRAF)return;
      source.__taRangeRAF=requestAnimationFrame(()=>{
        source.__taRangeRAF=0;const next=source.__taPendingRange;if(!next)return;
        for(const p of this.panes||[]){if(p===source)continue;try{p.suppressRangeEvent=true;p.chart.timeScale().setVisibleLogicalRange(next);queueMicrotask(()=>{p.suppressRangeEvent=false;});}catch{p.suppressRangeEvent=false;}}
      });
    };
  }

  const finish=()=>{for(const p of app.panes||[]){if(p.__taRoundGridDirty){p.__taRoundGridDirty=false;try{p.__taLiveReadyOverlay?.call(p);}catch{try{p.renderOverlays?.(true);}catch{}}}}};
  document.addEventListener('pointerup',finish,{capture:true});
  document.addEventListener('pointercancel',finish,{capture:true});

  // Optional diagnostics for acceptance testing; invisible unless inspected.
  window.__TRADE_AVATA_PERFORMANCE={
    sample(){return (app.panes||[]).map(p=>({pane:p.id,symbol:p.symbol,visibleCandles:visibleCount(p),barsLoaded:p.displayBars?.length||0}));},
    build:BUILD
  };
}

/* -------------------------------------------------------------------------- */
/* Mobile bottom panel: portrait = collapsed/half/full; landscape = overlay.   */
/* -------------------------------------------------------------------------- */
function portraitHeights(){
  const{h}=viewSize();
  const collapsed=38;
  const half=Math.round(clamp(h*.42,190,Math.max(190,h-170)));
  const full=Math.round(clamp(h-78,half,Math.max(half,h-54)));
  return{collapsed,half,full};
}

function ensureLandscapeCallout(app){
  let b=$('.ta-landscape-panel-callout');
  if(!isPhoneLandscape()){b?.remove();return null;}
  if(!b){
    b=el('button',{class:'ta-landscape-panel-callout',type:'button'},'▲ Trade Panel');
    b.addEventListener('click',()=>{app.state.mobileLandscapePanelOpen=!app.state.mobileLandscapePanelOpen;app.renderBottom();app.save?.();resizeCharts(app);});
    document.body.append(b);
  }
  b.textContent=app.state.mobileLandscapePanelOpen?'▼ Close Panel':'▲ Trade Panel';
  return b;
}

function panelContent(app,content){
  if(app.state.bottomTab==='positions')app.renderPositions(content);
  else if(app.state.bottomTab==='analytics')app.renderAnalytics(content);
  else if(app.state.bottomTab==='replay')app.renderReplay(content);
  else if(app.state.bottomTab==='alerts')app.renderBottomAlerts(content);
  else if(app.state.bottomTab==='history')app.renderHistory(content);
  else app.renderOrders(content);
}

function makePanelHeader(app,{landscape=false}={}){
  const header=el('div',{class:'ta-mobile-panel-header'});
  const grip=el('button',{class:'ta-bottom-grip',type:'button','aria-label':'Drag trading panel'},el('span'));
  const scroll=el('div',{class:'ta-mobile-panel-tabs'});
  for(const t of PANEL_TABS){
    scroll.append(el('button',{class:`bottom-tab ${app.state.bottomTab===t?'active':''}`,onclick:()=>{app.state.bottomTab=t;if(!landscape&&app.state.mobilePanelState==='collapsed')app.state.mobilePanelState='half';app.state.bottomOpen=true;app.renderBottom();app.save?.();resizeCharts(app);}},cap(t),t==='positions'?el('span',{class:'bottom-badge'},app.positions?.length||0):null));
  }
  const close=el('button',{class:'ta-bottom-collapse-fixed',type:'button','aria-label':landscape?'Close trade panel':'Collapse trade panel',onclick:()=>{
    if(landscape){app.state.mobileLandscapePanelOpen=false;}else{app.state.mobilePanelState='collapsed';app.state.bottomOpen=false;}
    app.renderBottom();app.save?.();resizeCharts(app);
  }},landscape?'×':'⌄');
  header.append(grip,scroll,close);return header;
}

function renderMobileBottom(app){
  const p=$('#bottom-panel'),grid=$('#chart-grid');if(!p||!grid)return;
  ensureLandscapeCallout(app);
  p.innerHTML='';p.removeAttribute('style');p.classList.remove('collapsed','ta-mobile-portrait','ta-mobile-landscape','ta-panel-collapsed','ta-panel-half','ta-panel-full');

  if(isPhoneLandscape()){
    grid.style.bottom='0px';
    p.classList.add('ta-mobile-landscape');
    if(!app.state.mobileLandscapePanelOpen){p.hidden=true;resizeCharts(app);return;}
    p.hidden=false;p.append(makePanelHeader(app,{landscape:true}));
    const content=el('div',{class:'bottom-content ta-mobile-overlay-content'});p.append(content);panelContent(app,content);resizeCharts(app);return;
  }

  p.hidden=false;p.classList.add('ta-mobile-portrait');
  const h=portraitHeights();let state=app.state.mobilePanelState||(!app.state.bottomOpen?'collapsed':'half');
  if(!['collapsed','half','full'].includes(state))state='collapsed';app.state.mobilePanelState=state;
  const px=h[state];p.style.height=`${px}px`;grid.style.bottom=`${px}px`;p.classList.add(`ta-panel-${state}`);
  app.state.bottomOpen=state!=='collapsed';app.state.bottomHeight=px;
  p.append(makePanelHeader(app,{landscape:false}));
  if(state!=='collapsed'){const content=el('div',{class:'bottom-content'});p.append(content);panelContent(app,content);}
  resizeCharts(app);
}

function patchMobileBottomPanel(app){
  if(app.__taLiveReadyBottom)return;app.__taLiveReadyBottom=app.renderBottom.bind(app);
  app.state.mobilePanelState=app.state.mobilePanelState||(!app.state.bottomOpen?'collapsed':'half');
  app.state.mobilePortraitRestore=app.state.mobilePortraitRestore||app.state.mobilePanelState;
  app.state.mobileLandscapePanelOpen=false;

  app.renderBottom=function(){if(isMobile())return renderMobileBottom(this);ensureLandscapeCallout(this);return this.__taLiveReadyBottom();};
  app.openBottom=function(tab){this.state.bottomTab=tab;if(isPhoneLandscape()){this.state.mobileLandscapePanelOpen=true;}else if(isMobile()){this.state.mobilePanelState=this.state.mobilePanelState==='collapsed'?'half':this.state.mobilePanelState;this.state.bottomOpen=true;}else{this.state.bottomOpen=true;this.state.bottomHeight=Math.max(180,this.state.bottomLastHeight||this.state.bottomHeight||280);}this.renderBottom();this.save?.();resizeCharts(this);};
  app.toggleBottom=function(){if(isPhoneLandscape()){this.state.mobileLandscapePanelOpen=!this.state.mobileLandscapePanelOpen;}else if(isMobile()){this.state.mobilePanelState=this.state.mobilePanelState==='collapsed'?'half':'collapsed';this.state.bottomOpen=this.state.mobilePanelState!=='collapsed';}else{if(this.state.bottomOpen){this.state.bottomLastHeight=this.state.bottomHeight;this.state.bottomOpen=false;}else{this.state.bottomOpen=true;this.state.bottomHeight=this.state.bottomLastHeight||360;}}this.renderBottom();this.save?.();resizeCharts(this);};

  // Use capture so the old V11.1 resize listener never sees mobile grip events.
  document.addEventListener('pointerdown',e=>{
    const grip=e.target.closest?.('.ta-bottom-grip');if(!grip)return;
    e.preventDefault();e.stopPropagation();
    const p=$('#bottom-panel'),rect=p?.getBoundingClientRect();if(!p||!rect)return;
    app.__taPanelDrag={id:e.pointerId,startY:e.clientY,startH:rect.height,lastY:e.clientY,lastT:performance.now(),landscape:isPhoneLandscape()};
    try{grip.setPointerCapture?.(e.pointerId);}catch{}
    document.body.classList.add('ta-panel-dragging');
  },true);
  document.addEventListener('pointermove',e=>{
    const d=app.__taPanelDrag;if(!d||d.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();
    const p=$('#bottom-panel');if(!p)return;const{h}=viewSize();const next=clamp(d.startH+(d.startY-e.clientY),d.landscape?96:38,d.landscape?Math.min(h*.78,430):Math.max(190,h-54));p.style.height=`${Math.round(next)}px`;if(!d.landscape)$('#chart-grid').style.bottom=`${Math.round(next)}px`;d.lastY=e.clientY;d.lastT=performance.now();resizeCharts(app);
  },true);
  const end=e=>{
    const d=app.__taPanelDrag;if(!d||d.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();app.__taPanelDrag=null;document.body.classList.remove('ta-panel-dragging');
    const dy=e.clientY-d.startY;
    if(d.landscape){if(dy>60)app.state.mobileLandscapePanelOpen=false;app.renderBottom();app.save?.();return;}
    const p=$('#bottom-panel'),cur=p?.getBoundingClientRect().height||d.startH,h=portraitHeights();
    if(dy>90)app.state.mobilePanelState='collapsed';else{const choices=[['collapsed',h.collapsed],['half',h.half],['full',h.full]];app.state.mobilePanelState=choices.sort((a,b)=>Math.abs(a[1]-cur)-Math.abs(b[1]-cur))[0][0];}
    app.state.bottomOpen=app.state.mobilePanelState!=='collapsed';app.renderBottom();app.save?.();resizeCharts(app);
  };
  document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);

  let lastLandscape=isPhoneLandscape(),orientationTimer;
  const orient=()=>{clearTimeout(orientationTimer);orientationTimer=setTimeout(()=>{
    const landscape=isPhoneLandscape();if(landscape&&!lastLandscape){app.state.mobilePortraitRestore=app.state.mobilePanelState||'collapsed';app.state.mobileLandscapePanelOpen=false;}else if(!landscape&&lastLandscape){app.state.mobileLandscapePanelOpen=false;app.state.mobilePanelState=app.state.mobilePortraitRestore||'collapsed';app.state.bottomOpen=app.state.mobilePanelState!=='collapsed';}
    lastLandscape=landscape;app.renderBottom();resizeCharts(app);
  },80);};
  window.addEventListener('resize',orient,{passive:true});window.addEventListener('orientationchange',orient,{passive:true});window.visualViewport?.addEventListener('resize',orient,{passive:true});
}

/* -------------------------------------------------------------------------- */
/* Indicator Portal: frontend complete; unsafe source never executes here.      */
/* -------------------------------------------------------------------------- */
function portalState(app){
  const s=app.state;s.indicatorPortal=s.indicatorPortal||{projects:[],activeProjectId:null,maxUploadBytes:PORTAL_MAX_FILE};
  s.indicatorPortal.projects=Array.isArray(s.indicatorPortal.projects)?s.indicatorPortal.projects:[];return s.indicatorPortal;
}
function portalOwnerKey(app){return currentUser(app)?.uid||'guest';}
function projectVisibleTo(app,p){return String(p?.ownerUid||'guest')===portalOwnerKey(app);}
function portalProjects(app){return portalState(app).projects.filter(p=>projectVisibleTo(app,p));}
function portalProject(app,id){return portalProjects(app).find(x=>String(x.id)===String(id));}
function draftKey(app,projectId){return `${portalOwnerKey(app)}::${String(projectId)}`;}

const draftDb={
  open(){return new Promise((resolve,reject)=>{const req=indexedDB.open('trade-avata-indicator-drafts',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('drafts'))req.result.createObjectStore('drafts',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});},
  async put(record){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(record);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});},
  async get(id){const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
};

async function sha256File(file){
  try{const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch{return '';}
}
function cloudAdapter(){return window.TRADE_AVATA_INDICATOR_CLOUD||null;}
async function persistProjectCloud(app,p){
  const a=cloudAdapter();if(!authed(app)||typeof a?.saveProject!=='function')return false;
  try{await a.saveProject(p);portalState(app).cloudStatus='synced';return true;}catch(err){portalState(app).cloudStatus='offline-cache';console.warn('[Indicator Portal cloud save]',err);return false;}
}
function mergeCloudProject(local,remote){
  const base=local||newProject(),keep={buildState:base.buildState,buildLog:base.buildLog,lastBuild:base.lastBuild,testState:base.testState,testResult:base.testResult,files:base.files};
  return{...base,...remote,id:remote.projectId||remote.id||base.id,ownerUid:remote.ownerUid||base.ownerUid,...keep,files:(base.files?.length?base.files:(remote.draftMetadata?.files||[]))};
}
async function syncPortalCloud(app,{force=false}={}){
  const ps=portalState(app),a=cloudAdapter();if(!authed(app)||typeof a?.listProjects!=='function')return false;
  if(ps.cloudSyncing)return ps.cloudSyncing;if(!force&&ps.lastCloudSyncAt&&Date.now()-ps.lastCloudSyncAt<15000)return true;
  ps.cloudStatus='syncing';
  ps.cloudSyncing=(async()=>{
    try{
      const [projects,entitlements,versions]=await Promise.all([a.listProjects(),a.listEntitlements?.()||[],a.listVersions?.()||[]]);
      const ownerKey=portalOwnerKey(app),other=ps.projects.filter(x=>!projectVisibleTo(app,x));
      const local=new Map(portalProjects(app).map(x=>[String(x.id),x]));
      for(const r of projects||[]){const id=String(r.projectId||r.id||'');if(!id)continue;local.set(id,mergeCloudProject(local.get(id),{...r,ownerUid:ownerKey}));}
      const mine=[...local.values()].map(x=>({...x,ownerUid:ownerKey}));ps.projects=[...other,...mine];for(const p of mine){const remote=(versions||[]).filter(v=>String(v.projectId)===String(p.id));p.versions=Array.isArray(p.versions)?p.versions:[];for(const v of remote)if(!p.versions.some(x=>String(x.version)===String(v.version)))p.versions.push({version:v.version,createdAt:v.createdAt||nowIso(),buildState:'not-built',build:null});}app.state.indicatorEntitlements=Array.isArray(entitlements)?entitlements:[];
      ps.cloudStatus='synced';ps.lastCloudSyncAt=Date.now();app.save?.();return true;
    }catch(err){ps.cloudStatus='offline-cache';console.warn('[Indicator Portal cloud sync]',err);return false;}
    finally{ps.cloudSyncing=null;}
  })();
  return ps.cloudSyncing;
}

function newProject(app=null){return{id:uid('indproj'),ownerUid:app?portalOwnerKey(app):'guest',name:'Untitled Indicator',version:'1.0',targetPlatform:'Trade Avata',description:'',parameters:[],files:[],visibility:'Draft',sharedTaIds:[],buildState:'not-built',buildLog:[],testState:'not-tested',createdAt:nowIso(),updatedAt:nowIso(),versions:[],licensing:{mode:'until-revoked',startDate:null,expiry:null,deviceAllowance:2}};}
function ext(name){return String(name||'').split('.').pop().toLowerCase();}
function staticScanText(text){
  const rules=[[/\beval\s*\(/i,'eval'],[/new\s+Function\b/i,'new Function'],[/\bdocument\s*\./i,'DOM access'],[/\bwindow\s*\./i,'window access'],[/\bfetch\s*\(/i,'network fetch'],[/\bWebSocket\b/i,'WebSocket/network'],[/\blocalStorage\b/i,'localStorage'],[/\bsessionStorage\b/i,'sessionStorage'],[/\bchild_process\b/i,'process spawning'],[/\bprocess\.env\b/i,'environment access'],[/\bFileSystem\b|\bfs\./i,'filesystem access']];
  return rules.filter(([re])=>re.test(text)).map(([,name])=>name);
}
async function inspectUpload(file){
  const extension=ext(file.name),errors=[],warnings=[];
  if(!ALLOWED_EXT.has(extension))errors.push(`.${extension||'?'} is not a supported indicator project/source type.`);
  if(file.size>PORTAL_MAX_FILE)errors.push(`File is larger than ${Math.round(PORTAL_MAX_FILE/1024/1024)} MB.`);
  let text='',spec=null,flags=[];
  if(!errors.length&&SOURCE_EXT.has(extension)&&file.size<=SOURCE_MAX_FILE){
    try{text=await file.text();flags=staticScanText(text);if(flags.length)warnings.push(`Static scan flagged: ${flags.join(', ')}.`);if(extension==='json'||extension==='taind'){try{spec=JSON.parse(text);const gate=validateIndicatorSpec(spec);if(!gate.ok)warnings.push(...gate.errors.map(x=>`Declarative gate: ${x}`));}catch{warnings.push('Metadata JSON could not be parsed as a declarative indicator specification.');}}}catch{warnings.push('Text preview could not be read locally.');}
  }
  if(extension==='zip')warnings.push('Archive structure will be inspected only inside the secure backend sandbox; the browser will not unpack or execute it.');
  const sha256=errors.length?'':await sha256File(file);return{name:file.name,size:file.size,type:file.type||'',extension,accepted:errors.length===0,errors,warnings,flags,specSummary:spec?safeIndicatorSummary(spec):null,sha256,draftText:text,textPreview:text.slice(0,16000)};
}

function portalNav(app,active,onchange){
  const nav=el('nav',{class:'ta-indicator-portal-nav'});for(const [id,label,icon] of [['mine','My Indicators','▦'],['upload','Upload Indicator','⇧'],['build','Build / Create','＋'],['test','Test / Preview','▶'],['versions','Versions','⟲'],['licensing','TA ID Licensing','♙'],['security','Security / Sandbox','⬡']])nav.append(el('button',{class:active===id?'active':'',onclick:()=>onchange(id)},el('b',{},icon),el('span',{},label)));return nav;
}

function projectCard(app,p){
  const licence=p.licensing?.expiry?`Expires ${new Date(p.licensing.expiry).toLocaleDateString()}`:p.licensing?.mode||'Until revoked';
  return el('article',{class:'ta-portal-project-card'},
    el('div',{class:'ta-project-card-head'},el('div',{},el('strong',{},p.name),el('small',{},`v${p.version} · ${p.targetPlatform}`)),el('span',{class:`ta-build-state ${p.buildState}`},String(p.buildState||'not-built').replaceAll('-',' '))),
    el('div',{class:'ta-project-facts'},el('span',{},`Licence: ${licence}`),el('span',{},`Access: ${p.visibility}`),el('span',{},`Updated: ${new Date(p.updatedAt).toLocaleString()}`)),
    el('div',{class:'ta-project-actions'},el('button',{class:'secondary',onclick:()=>app.openIndicatorPortal('build',p.id)},'Edit'),el('button',{class:'secondary',onclick:()=>app.openIndicatorPortal('test',p.id)},'Test'),el('button',{class:'secondary',onclick:()=>app.openIndicatorPortal('versions',p.id)},'Versions'),el('button',{class:'secondary',onclick:()=>app.openIndicatorPortal('licensing',p.id)},'Licence'))
  );
}

function renderPortalMine(app,body){
  const ps=portalState(app),head=el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},'My Indicators'),el('p',{},`Indicators you created or that were granted to this signed-in Trade Avata account. Cloud: ${ps.cloudStatus||'local cache'}.`)),el('div',{class:'ta-builder-actions'},el('button',{class:'secondary',onclick:async()=>{await syncPortalCloud(app,{force:true});app.openIndicatorPortal('mine');}},'↻ Sync'),el('button',{class:'primary',onclick:()=>app.openIndicatorPortal('build')},'+ Create indicator')));body.append(head);
  for(const p of portalProjects(app))body.append(projectCard(app,p));
  for(const e of app.state.indicatorEntitlements||[]){body.append(el('article',{class:'ta-portal-project-card'},el('div',{class:'ta-project-card-head'},el('div',{},el('strong',{},e.name||e.indicatorId||'Licensed indicator'),el('small',{},`${e.version||'Current'} · ${e.targetPlatform||'Trade Avata'}`)),el('span',{class:'ta-build-state succeeded'},String(e.status||'active'))),el('div',{class:'ta-project-facts'},el('span',{},e.expiresAt?`Expires ${new Date(e.expiresAt).toLocaleDateString()}`:'No expiry'),el('span',{},'Granted licence'),el('span',{},e.publisher||'Trade Avata'))));}
  if(!portalProjects(app).length&&!(app.state.indicatorEntitlements||[]).length)body.append(el('div',{class:'empty-state'},'No indicator projects or grants yet. Create a project or upload supported source/package files.'));
}

function renderPortalUpload(app,body){
  body.append(el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},'Upload Indicator'),el('p',{},'Files are validated and scanned here. Uploaded code is never executed directly by this browser.'))));
  const drop=el('label',{class:'ta-upload-zone'},el('strong',{},'Choose indicator project/source/package files'),el('span',{},'.cs · .algo · .zip · .mq4 · .mq5 · .mqh · .json · .taind · text/metadata'),el('input',{type:'file',multiple:true,accept:'.cs,.algo,.zip,.mq4,.mq5,.mqh,.json,.taind,.txt,.md'}));
  const results=el('div',{class:'ta-upload-results'});body.append(drop,results);
  drop.querySelector('input').addEventListener('change',async e=>{
    results.innerHTML='';const selected=[...(e.target.files||[])];if(!selected.length)return;
    if(selected.length>PORTAL_MAX_FILES)results.append(el('p',{class:'neg'},`Only the first ${PORTAL_MAX_FILES} files are considered per upload.`));
    const files=selected.slice(0,PORTAL_MAX_FILES),p=newProject(app);p.name=files[0].name.replace(/\.[^.]+$/,'')||p.name;p.files=[];let accepted=0,totalAccepted=0;const fileBlobs=[];let sourceText='';
    for(const f of files){let meta;if(totalAccepted+f.size>PORTAL_MAX_TOTAL){meta={name:f.name,size:f.size,type:f.type||'',extension:ext(f.name),accepted:false,errors:[`Accepted upload payload would exceed ${Math.round(PORTAL_MAX_TOTAL/1024/1024)} MB total.`],warnings:[],flags:[],specSummary:null,sha256:'',draftText:'',textPreview:''};}else{meta=await inspectUpload(f);}p.files.push({...meta,textPreview:undefined,draftText:undefined});if(meta.accepted){accepted++;totalAccepted+=f.size;fileBlobs.push({name:f.name,size:f.size,type:f.type||'',lastModified:f.lastModified||0,sha256:meta.sha256,blob:f.slice(0,f.size,f.type||'application/octet-stream')});if(!sourceText&&SOURCE_EXT.has(meta.extension)&&meta.draftText)sourceText=meta.draftText;}results.append(el('div',{class:`ta-upload-file ${meta.accepted?'ok':'bad'}`},el('strong',{},meta.name),el('small',{},`${(meta.size/1024).toFixed(1)} KB · ${meta.accepted?'accepted + retained in account-scoped local draft vault':'rejected'}`),meta.sha256?el('p',{class:'ta-file-hash'},`SHA-256 ${meta.sha256}`):null,...meta.errors.map(x=>el('p',{class:'neg'},x)),...meta.warnings.map(x=>el('p',{class:'warn'},x))));}
    if(accepted){try{await navigator.storage?.persist?.();}catch{}portalState(app).projects.unshift(p);portalState(app).activeProjectId=p.id;app.save?.();try{await draftDb.put({id:draftKey(app,p.id),projectId:p.id,ownerUid:portalOwnerKey(app),sourceText,files:p.files,fileBlobs,updatedAt:p.updatedAt});}catch(err){console.warn('[Indicator Portal draft vault]',err);}await persistProjectCloud(app,p);results.append(el('button',{class:'primary',onclick:()=>app.openIndicatorPortal('build',p.id)},'Open accepted project in Builder'));}
  });
  body.append(el('div',{class:'ta-security-note'},el('strong',{},'Security rule'),el('p',{},'Accepted means “safe to send to the sandbox pipeline”, not “trusted”. Static browser checks cannot approve arbitrary third-party code.')));
}

async function renderPortalBuilder(app,body,projectId){
  const ps=portalState(app);let p=portalProject(app,projectId)||portalProject(app,ps.activeProjectId);
  if(!p){p=newProject(app);ps.projects.unshift(p);ps.activeProjectId=p.id;app.save?.();}
  ps.activeProjectId=p.id;const draft=await draftDb.get(draftKey(app,p.id)).catch(()=>null),source=el('textarea',{class:'field ta-source-editor',spellcheck:'false',placeholder:'Source/project text is stored as a draft only. It is never executed by the browser.'});source.value=draft?.sourceText||'';
  const name=el('input',{class:'field',value:p.name}),platform=el('select',{class:'field'});for(const x of ['Trade Avata','cTrader','MT5','MT4','TradingView / Pine metadata'])platform.append(el('option',{value:x},x));platform.value=p.targetPlatform||'Trade Avata';
  const version=el('input',{class:'field',value:p.version||'1.0'}),desc=el('textarea',{class:'field ta-description-editor',placeholder:'What does this indicator do?'});desc.value=p.description||'';
  const param=el('textarea',{class:'field',placeholder:'Parameters, one per line. Example: Period:number=20'});param.value=(p.parameters||[]).join('\n');
  body.append(el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},'Indicator Builder'),el('p',{},'Create, save and reopen projects. Source stays a draft until the secure build service scans/compiles it.'))),
    el('div',{class:'ta-builder-grid'},field('Project name',name),field('Target platform',platform),field('Version',version),field('Description',desc),field('Parameters',param)),
    field('Source / project draft',source,'This editor does not run code. Uploaded package bytes stay in the local draft vault until a secure backend stages them.'));
  const save=async()=>{p.name=name.value.trim()||'Untitled Indicator';p.targetPlatform=platform.value;p.version=version.value.trim()||'1.0';p.description=desc.value.trim();p.parameters=param.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);p.updatedAt=nowIso();const prior=await draftDb.get(draftKey(app,p.id)).catch(()=>null);await draftDb.put({id:draftKey(app,p.id),projectId:p.id,ownerUid:portalOwnerKey(app),sourceText:source.value.slice(0,800000),files:p.files||[],fileBlobs:prior?.fileBlobs||[],updatedAt:p.updatedAt});app.save?.();await persistProjectCloud(app,p);toast('Indicator draft saved','success');};
  const build=async()=>{await save();app.openIndicatorPortal('test',p.id,{startBuild:true});};
  body.append(el('div',{class:'ta-builder-actions'},el('button',{class:'secondary',onclick:save},'Save draft'),el('button',{class:'primary',onclick:build},'Security scan & Build')));
}

function field(label,control,help=''){return el('label',{class:'ta-portal-field'},el('span',{},label),control,help?el('small',{},help):null);}

async function runBuild(app,p,out){
  p.buildLog=[];const push=(stage,text,kind='info')=>{const row={at:nowIso(),stage,text,kind};p.buildLog.push(row);out?.append(el('div',{class:`ta-build-log ${kind}`},el('b',{},stage),el('span',{},text)));app.save?.();};
  p.buildState='scanning';push('SCANNING','Running frontend metadata/static checks.');
  const draft=await draftDb.get(draftKey(app,p.id)).catch(()=>null),flags=staticScanText(draft?.sourceText||'');
  if(flags.length)push('SCAN WARNING',`Potential restricted capability references: ${flags.join(', ')}. The backend sandbox must inspect these before approval.`,'warn');
  const adapter=window.TRADE_AVATA_INDICATOR_BUILD_ADAPTER;
  if(typeof adapter?.build!=='function'){
    p.buildState='backend-required';push('BACKEND REQUIRED','Frontend validation is complete. Secure sandbox compiler is not connected, so Trade Avata will NOT report a fake successful compilation.','warn');app.save?.();return;
  }
  p.buildState='compiling';push('COMPILING','Sending sanitized project metadata/source to the secure isolated build service.');
  try{
    const token=await window.TRADE_AVATA_AUTH_ADAPTER?.getIdToken?.();
    const sourceFiles=Array.isArray(draft?.fileBlobs)?draft.fileBlobs:[];push('STAGING',`${sourceFiles.length} retained project file(s) ready for secure sandbox upload.`);const result=await adapter.build({project:clone(p),sourceText:draft?.sourceText||'',files:sourceFiles,authToken:token,onProgress:x=>push(String(x.stage||'BUILD'),String(x.message||''),x.kind||'info')});
    if(result?.ok){p.buildState='succeeded';p.lastBuild={id:result.buildId||uid('build'),at:nowIso(),warnings:result.warnings||[],artifact:result.artifact||null};push('BUILD SUCCEEDED','Secure compiler returned a successful build.','ok');}
    else{p.buildState='failed';push('BUILD FAILED',result?.error||'The secure compiler reported failure.','bad');for(const e of result?.errors||[])push('COMPILER',String(e),'bad');}
  }catch(err){p.buildState='failed';push('BUILD FAILED',err?.message||'Build request failed.','bad');}
  p.updatedAt=nowIso();app.save?.();
}

async function renderPortalTest(app,body,projectId,options={}){
  const ps=portalState(app),p=portalProject(app,projectId)||portalProject(app,ps.activeProjectId);if(!p){body.append(el('div',{class:'empty-state'},'Create or select an indicator project first.'));return;}
  ps.activeProjectId=p.id;
  const head=el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},`Build & Test · ${p.name}`),el('p',{},'Real compilation must return from the secure sandbox. Trade Avata does not fake compiler success.')));body.append(head);
  const pipeline=el('div',{class:'ta-pipeline'});for(const x of ['Upload','Validate','Static scan','Sandbox build','Compile','Test','Approval','Install / Publish / License'])pipeline.append(el('span',{},x));body.append(pipeline);
  const log=el('div',{class:'ta-build-console'});for(const row of p.buildLog||[])log.append(el('div',{class:`ta-build-log ${row.kind||''}`},el('b',{},row.stage),el('span',{},row.text)));body.append(log);
  const pane=app.activePane?.(),testSymbol=el('input',{class:'field',value:pane?.symbol||app.activeConfig?.().symbol||'XAUUSD'}),barCount=el('input',{class:'field',type:'number',min:'100',max:'5000',step:'100',value:'1000'}),testParams=el('textarea',{class:'field',placeholder:'Optional parameter overrides for this test'});testParams.value=(p.parameters||[]).join('\n');
  body.append(el('div',{class:'ta-builder-grid'},field('Test symbol',testSymbol),field('Historical bars',barCount),field('Parameter test set',testParams,'The secure test runner receives these values and approved Trade Avata chart data.')));
  const actions=el('div',{class:'ta-builder-actions'},el('button',{class:'primary',onclick:()=>runBuild(app,p,log)},'Start secure build'),el('button',{class:'secondary',onclick:async()=>{
    if(p.buildState!=='succeeded'){toast('A verified successful secure build is required before testing.','error');return;}
    const adapter=window.TRADE_AVATA_INDICATOR_TEST_ADAPTER;if(typeof adapter?.test!=='function'){toast('Secure indicator test service is not connected. No test result will be faked.','error');return;}
    try{
      p.testState='testing';app.save?.();const token=await window.TRADE_AVATA_AUTH_ADAPTER?.getIdToken?.();const active=app.activePane?.(),count=clamp(Number(barCount.value)||1000,100,5000);
      const historical=(active?.displayBars||[]).slice(-count).map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume||0}));
      const r=await adapter.test({project:clone(p),build:p.lastBuild,authToken:token,marketContext:{symbol:testSymbol.value.trim().toUpperCase(),period:app.activeConfig?.().period,bars:historical,parameters:testParams.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}});
      p.testState=r?.ok?'passed':'failed';p.testResult=r||null;app.save?.();app.openIndicatorPortal('test',p.id);
    }catch(err){p.testState='failed';p.testResult={error:err?.message||'Test failed'};app.save?.();app.openIndicatorPortal('test',p.id);}
  }},'Test / Preview on Trade Avata data'));
  body.append(actions,el('div',{class:'ta-test-result'},el('strong',{},`Build: ${p.buildState}`),el('span',{},`Test: ${p.testState||'not-tested'}`),p.testResult?el('pre',{},JSON.stringify(p.testResult,null,2)):null));
  if(options.startBuild)queueMicrotask(()=>runBuild(app,p,log));
}

function renderPortalVersions(app,body,projectId){
  const ps=portalState(app),p=portalProject(app,projectId)||portalProject(app,ps.activeProjectId);if(!p){body.append(el('div',{class:'empty-state'},'Select an indicator project first.'));return;}
  ps.activeProjectId=p.id;body.append(el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},`Versions · ${p.name}`),el('p',{},'New versions do not delete previous entitlement records. A licence may stay pinned or follow the approved latest release.'))));
  const input=el('input',{class:'field',value:p.version||'1.0'});body.append(field('New version',input));body.append(el('button',{class:'primary',onclick:async()=>{const v=input.value.trim();if(!/^\d+(?:\.\d+){1,2}$/.test(v)){toast('Use a version like 1.0, 1.1 or 2.0','error');return;}if(!p.versions.some(x=>x.version===p.version))p.versions.push({version:p.version,createdAt:p.createdAt,buildState:p.buildState,build:p.lastBuild||null});const next={version:v,createdAt:nowIso(),buildState:'not-built',build:null};p.versions.push(next);p.version=v;p.buildState='not-built';p.updatedAt=nowIso();app.save?.();await persistProjectCloud(app,p);try{await cloudAdapter()?.saveDraftVersion?.(p,next);}catch(err){console.warn('[Indicator Portal version cloud save]',err);}app.openIndicatorPortal('versions',p.id);}},'Create version'));
  const versions=[...p.versions,{version:p.version,createdAt:p.updatedAt,buildState:p.buildState,current:true}];for(const v of versions)body.append(el('div',{class:'ta-version-row'},el('strong',{},`v${v.version}${v.current?' · Current':''}`),el('span',{},v.buildState||'not-built'),el('small',{},new Date(v.createdAt||Date.now()).toLocaleString())));
}

function renderPortalLicensing(app,body,projectId){
  const ps=portalState(app),p=portalProject(app,projectId)||portalProject(app,ps.activeProjectId);if(!p){body.append(el('div',{class:'empty-state'},'Select an indicator project first.'));return;}ps.activeProjectId=p.id;
  const l=p.licensing||(p.licensing={mode:'until-revoked',deviceAllowance:2}),vis=el('select',{class:'field'});for(const x of ['Draft','Private','Shared with selected TA IDs','Published'])vis.append(el('option',{value:x},x));vis.value=p.visibility||'Draft';
  const mode=el('select',{class:'field'});for(const [v,t] of [['trial','Free trial'],['7d','7 days'],['30d','30 days'],['3m','3 months'],['6m','6 months'],['1y','1 year'],['subscription','Subscription'],['lifetime','Lifetime'],['until-revoked','Until revoked']])mode.append(el('option',{value:v},t));mode.value=l.mode||'until-revoked';
  const start=el('input',{class:'field',type:'date',value:l.startDate?.slice?.(0,10)||''}),expiry=el('input',{class:'field',type:'date',value:l.expiry?.slice?.(0,10)||''}),devices=el('input',{class:'field',type:'number',min:'1',max:'20',value:String(l.deviceAllowance||2)}),ids=el('textarea',{class:'field',placeholder:'TA-12345678, TA-87654321'});ids.value=(p.sharedTaIds||[]).join(', ');
  body.append(el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},`TA ID Licensing · ${p.name}`),el('p',{},'TA ID is a public lookup identity only. Real entitlement decisions must use authenticated UID + backend licence records.'))),field('Visibility',vis),field('Default licence',mode),field('Start date',start),field('Expiry / renewal date',expiry),field('Device allowance',devices),field('Selected TA IDs',ids));
  body.append(el('div',{class:'ta-builder-actions'},el('button',{class:'primary',onclick:async()=>{p.visibility=vis.value;l.mode=mode.value;l.startDate=start.value?new Date(`${start.value}T00:00:00Z`).toISOString():null;l.expiry=expiry.value?new Date(`${expiry.value}T23:59:59Z`).toISOString():null;l.deviceAllowance=clamp(Number(devices.value)||1,1,20);p.sharedTaIds=ids.value.split(/[\s,]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);p.updatedAt=nowIso();app.save?.();await persistProjectCloud(app,p);toast('Indicator access settings saved','success');}},'Save access settings'),el('button',{class:'secondary',onclick:()=>app.openLicenseAdmin?.()},'Open entitlement grants')));
}

function renderPortalSecurity(body){
  body.append(el('div',{class:'ta-portal-section-head'},el('div',{},el('h3',{},'Indicator Security / Sandbox'),el('p',{},'Built-in Trade Avata indicators remain trusted first-party code. Uploaded third-party code is a separate untrusted zone.'))));
  const grid=el('div',{class:'ta-security-grid'});for(const [k,v] of [['Browser execution','Blocked for arbitrary uploaded code'],['Network','No unrestricted network access'],['Filesystem','No unrestricted filesystem access'],['DOM / eval','No DOM access or eval'],['CPU / memory','Sandbox limits required'],['Timeouts','Execution and build timeouts required'],['Isolation','Per-build process/container isolation'],['Cleanup','Temporary build files removed after completion']])grid.append(el('div',{},el('strong',{},k),el('span',{},v)));body.append(grid,el('div',{class:'ta-security-note'},el('strong',{},'Current production-conscious status'),el('p',{},'Frontend validation and API contracts are installed. The secure compiler/sandbox must be deployed behind the adapter before arbitrary uploaded source can compile. Until then, Trade Avata reports “backend required” instead of pretending a build succeeded.')));
}

function patchIndicatorPortal(app){
  portalState(app);syncPortalCloud(app).catch(()=>{});
  window.addEventListener('tradeavata:auth-state',()=>{const ps=portalState(app);if(ps.activeProjectId&&!portalProject(app,ps.activeProjectId))ps.activeProjectId=null;syncPortalCloud(app,{force:true}).catch(()=>{});});
  app.openIndicatorPortal=function(tab='mine',projectId=null,options={}){
    this.closeMenu?.();const m=this.makeModal('Trade Avata · Indicator Portal','ta-indicator-portal-modal');m.ok.style.display='none';m.cancel.textContent='Close';
    const shell=el('div',{class:'ta-indicator-portal-shell'}),body=el('main',{class:'ta-indicator-portal-body'});m.main.replaceChildren(shell);
    const change=id=>this.openIndicatorPortal(id,projectId);shell.append(portalNav(this,tab,change),body);
    if(tab==='mine')renderPortalMine(this,body);else if(tab==='upload')renderPortalUpload(this,body);else if(tab==='build')renderPortalBuilder(this,body,projectId);else if(tab==='test')renderPortalTest(this,body,projectId,options);else if(tab==='versions')renderPortalVersions(this,body,projectId);else if(tab==='licensing')renderPortalLicensing(this,body,projectId);else renderPortalSecurity(body);
  };

  if(!app.__taPortalTopbar){
    app.__taPortalTopbar=app.renderTopbar.bind(app);app.renderTopbar=function(){this.__taPortalTopbar();const row=$('.topbar-scroll');if(!row||row.querySelector('.ta-portal-launch'))return;const fx=[...row.querySelectorAll('button')].find(x=>x.textContent.includes('Indicators'));const b=el('button',{class:'tb-btn ta-portal-launch',onclick:()=>this.openIndicatorPortal('mine')},viewSize().w<=780?'▦ Portal':'▦ Indicator Portal');fx?.after(b);if(!fx)row.append(b);patchMarketStatusButton(this);};
  }
}

/* -------------------------------------------------------------------------- */
/* Market feed + cTrader integration hooks.                                    */
/* -------------------------------------------------------------------------- */
function statusLabel(status){return({live:'LIVE',connecting:'CONNECTING',reconnecting:'RECONNECTING',offline:'OFFLINE','not-configured':'FEED NOT CONFIGURED',error:'FEED ERROR'})[status]||String(status||'OFFLINE').toUpperCase();}
function patchMarketStatusButton(app){
  const b=$('.live-pill');if(!b)return;const st=app.state.marketFeed?.status||marketFeed.status||'not-configured';b.classList.toggle('ta-feed-live',st==='live');b.classList.toggle('ta-feed-wait',st!=='live');b.innerHTML='';b.append(el('span',{class:'live-dot'}),document.createTextNode(statusLabel(st)));b.title=app.state.marketFeed?.detail||marketFeed.statusDetail||'Market feed status';b.onclick=()=>app.openMarketConnectionStatus?.();
}
function normalizeBar(b){
  if(!b)return null;let time=Number(b.time??b.timestamp??b.openTime);if(time>1e12)time=Math.floor(time/1000);if(time>1e10)time=Math.floor(time/1000);
  const out={time,open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume??b.tickVolume??0)};
  return Number.isFinite(out.time)&&['open','high','low','close'].every(k=>Number.isFinite(out[k]))?out:null;
}
function panePoint(pane,b){return pane.chartType==='Line'||pane.chartType==='Area'?{time:b.time,value:b.close}:b;}

function recalcIndicators(pane){
  if(!pane.indicatorSeries?.length)return;
  const grouped=new Map();for(const meta of pane.indicatorSeries){if(!grouped.has(meta.cfg.id))grouped.set(meta.cfg.id,computeIndicator(meta.cfg,pane.displayBars));}
  for(const meta of pane.indicatorSeries){const computed=grouped.get(meta.cfg.id),part=computed?.series?.find(x=>x.name===meta.part?.name)||computed?.series?.[0];if(!part)continue;meta.part=part;meta.values=part.values;try{meta.series.setData(valuesToData(pane.displayBars,part.values,pane.replayIndex));}catch{}}
}
function scheduleIndicatorRefresh(pane,immediate=false){
  clearTimeout(pane.__taIndicatorLiveTimer);const delay=immediate?0:300;pane.__taIndicatorLiveTimer=setTimeout(()=>{recalcIndicators(pane);pane.refreshHeader?.();},delay);
}

function applyLiveHistory(pane,payload){
  const bars=(payload.bars||payload.data||[]).map(normalizeBar).filter(Boolean).sort((a,b)=>a.time-b.time);if(!bars.length)return;
  pane.periodBars=bars;pane.rawBars=bars;pane.displayBars=pane.chartType==='Heikin-Ashi'?heikinAshi(bars):bars.slice();pane.barIndex=new Map(pane.displayBars.map((b,i)=>[Number(b.time),i]));
  pane.rebuildSeries({preserveVisibleRange:false});pane.setAutoMode?.(false);pane.refreshHeader?.();pane.renderOverlays?.(true);
  if(!pane.__taLiveHistoryLoaded){pane.__taLiveHistoryLoaded=true;pane.homeView?.();}
}
function liveHeikinBar(raw,previous=null){
  const close=(raw.open+raw.high+raw.low+raw.close)/4;
  const open=previous?(previous.open+previous.close)/2:(raw.open+raw.close)/2;
  return {...raw,open,high:Math.max(raw.high,open,close),low:Math.min(raw.low,open,close),close};
}
function applyLiveBar(pane,payload){
  const bar=normalizeBar(payload.bar||payload);if(!bar)return;const arr=pane.periodBars||[];const last=arr.at(-1);let mutation='append';
  if(last&&Number(last.time)===bar.time){arr[arr.length-1]=bar;mutation='replace-last';}
  else if(!last||bar.time>Number(last.time)){arr.push(bar);mutation='append';}
  else{const i=arr.findIndex(x=>Number(x.time)===bar.time);if(i>=0){arr[i]=bar;mutation=i===arr.length-1?'replace-last':'out-of-order';}else{arr.push(bar);arr.sort((a,b)=>a.time-b.time);mutation='out-of-order';}}
  const max=20000;let shifted=false;if(arr.length>max){arr.splice(0,arr.length-max);shifted=true;}
  pane.rawBars=arr;
  if(pane.chartType==='Heikin-Ashi'){
    const display=pane.displayBars||[];
    if(!display.length||mutation==='out-of-order'||shifted){pane.displayBars=heikinAshi(arr);try{pane.series?.setData?.(pane.mainSeriesData?.()||pane.displayBars);}catch{pane.applyMainSeriesData?.();}}
    else if(mutation==='replace-last'){const prev=display.length>1?display[display.length-2]:null;const ha=liveHeikinBar(bar,prev);display[display.length-1]=ha;try{pane.series?.update?.(panePoint(pane,ha));}catch{pane.applyMainSeriesData?.();}}
    else{const prev=display.at(-1)||null;const ha=liveHeikinBar(bar,prev);display.push(ha);try{pane.series?.update?.(panePoint(pane,ha));}catch{pane.applyMainSeriesData?.();}}
  }else{pane.displayBars=arr;try{pane.series?.update?.(panePoint(pane,bar));}catch{pane.applyMainSeriesData?.();}}
  if(mutation==='out-of-order'||shifted){pane.barIndex=new Map(pane.displayBars.map((b,i)=>[Number(b.time),i]));}
  else pane.barIndex.set(Number(pane.displayBars.at(-1)?.time),pane.displayBars.length-1);
  pane.refreshHeader?.();scheduleIndicatorRefresh(pane,!!payload.closed);
}

function bindPaneFeed(pane){
  if(pane.__taFeedUnsub){pane.__taFeedUnsub();pane.__taFeedUnsub=null;}
  const period=clone(pane.period||{mode:'time',value:pane.timeframe});
  pane.__taFeedUnsub=marketFeed.subscribe({symbol:pane.symbol,period,onHistory:x=>applyLiveHistory(pane,x),onBar:x=>applyLiveBar(pane,x),onQuote:x=>{pane.__taQuote=x;}});
}

function patchFeedIntoCharts(app){
  if(!ChartPane.prototype.__taFeedLoad){
    ChartPane.prototype.__taFeedLoad=ChartPane.prototype.loadData;ChartPane.prototype.loadData=function(...args){const r=this.__taFeedLoad(...args);queueMicrotask(()=>bindPaneFeed(this));return r;};
  }
  for(const p of app.panes||[])bindPaneFeed(p);

  app.state.marketFeed=app.state.marketFeed||{provider:'ctrader',status:marketFeed.status,detail:marketFeed.statusDetail};
  marketFeed.addEventListener('status',e=>{app.state.marketFeed={provider:e.detail.provider||'ctrader',status:e.detail.status,detail:e.detail.detail,lastChangedAt:nowIso()};if(e.detail.status==='live')document.documentElement.dataset.marketLive='true';else document.documentElement.dataset.marketLive='false';app.renderTopbar?.();});
  marketFeed.addEventListener('account',e=>{const x=e.detail||{};app.state.connection.broker='cTrader';app.state.connection.account=x.account||x;app.state.connection.status=x.connected===false?'offline':'live';app.state.connection.feed='CTRADER';app.save?.();app.renderTopbar?.();app.renderRightPanel?.();});
  marketFeed.addEventListener('positions',e=>{app.positions=Array.isArray(e.detail?.positions)?e.detail.positions:Array.isArray(e.detail)?e.detail:[];app.renderBottom?.();});
  marketFeed.addEventListener('orders',e=>{app.orders=Array.isArray(e.detail?.orders)?e.detail.orders:Array.isArray(e.detail)?e.detail:[];app.renderBottom?.();});
  marketFeed.addEventListener('trade-history',e=>{app.liveHistory=Array.isArray(e.detail?.trades)?e.detail.trades:Array.isArray(e.detail)?e.detail:[];app.renderBottom?.();});
  marketFeed.addEventListener('trade-event',e=>{const event=e.detail||{};app.liveJournalEntries=app.liveJournalEntries||[];app.liveJournalEntries.unshift({...event,receivedAt:nowIso()});app.liveJournalEntries=app.liveJournalEntries.slice(0,1000);try{window.TRADE_AVATA_JOURNAL_ADAPTER?.ingest?.(event);}catch(err){console.warn('[Trade Avata Journal Adapter]',err);}});

  if(!app.__taAnalyticsLive){app.__taAnalyticsLive=app.renderAnalytics.bind(app);app.renderAnalytics=function(c){const old=this.demoHistory;if(this.liveHistory?.length)this.demoHistory=this.liveHistory;try{return this.__taAnalyticsLive(c);}finally{this.demoHistory=old;}};}
  if(!app.__taHistoryLive){app.__taHistoryLive=app.renderHistory.bind(app);app.renderHistory=function(c){if(!this.liveHistory?.length)return this.__taHistoryLive(c);const table=el('table',{class:'data-table'});table.innerHTML='<thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Size</th><th>P&L</th><th>Closed</th></tr></thead>';const tb=el('tbody');for(const t of this.liveHistory.slice().reverse().slice(0,300)){const tr=el('tr');[t.symbol||'—',t.side||t.direction||'—',fmt(t.symbol,t.entryPrice??t.entry),fmt(t.symbol,t.exitPrice??t.exit),t.size??t.volume??'—',t.pnl??t.profit??'—',t.closeTime?new Date(t.closeTime).toLocaleString():'—'].forEach(v=>tr.append(el('td',{},String(v))));tb.append(tr);}table.append(tb);c.append(table);};}

  app.openMarketConnectionStatus=function(){const m=this.makeModal('Market connection','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const st=this.state.marketFeed||{};b.append(el('div',{class:'ta-feed-status-card'},el('strong',{},statusLabel(st.status)),el('p',{},st.detail||'No status detail.'),el('small',{},'The public chart feed is separate from your personal cTrader account connection. Trade Avata never labels demo/mock data as live.')),el('button',{class:'secondary',onclick:()=>marketFeed.connect()},'Reconnect market feed'));};

  const originalConnect=app.startBrokerConnect?.bind(app);app.startBrokerConnect=async function(){if(!authed(this)){toast('Sign in to Trade Avata before connecting your personal cTrader account.','error');this.openLogin?.();return;}try{await cTraderProvider.connectTradingAccount({scope:'accounts'});}catch(err){if(String(err?.message||'').includes('not configured')){const m=this.makeModal('Connect cTrader','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';m.main.replaceChildren(el('div',{class:'settings-body'},el('div',{class:'ta-reference-card'},el('strong',{},'cTrader connection socket is ready'),el('p',{},'The secure cTrader gateway address has not been added yet. No broker password or Client Secret is stored in this public website. Once the gateway endpoint is configured, this same button starts official cTrader authorization.'))));return;}console.error(err);toast(err?.message||'Could not start cTrader authorization','error');return originalConnect?.();}};
  app.disconnectBroker=async function(){try{await cTraderProvider.disconnectTradingAccount();}catch{}this.state.connection={...this.state.connection,broker:null,status:'offline',account:null};this.positions=[];this.orders=[];this.save?.();this.renderTopbar?.();this.renderBottom?.();};
}
function fmt(symbol,v){const n=Number(v);if(!Number.isFinite(n))return v??'—';try{return formatPrice(symbol||'XAUUSD',n);}catch{return String(n);}}

/* -------------------------------------------------------------------------- */
/* Authentication restoration and secure-role posture.                         */
/* -------------------------------------------------------------------------- */
function applyAuthUser(app,user){
  app.state.connection=app.state.connection||{};app.state.identity=app.state.identity||{};app.state.connection.tradeAvataUser=user||null;
  if(user){app.state.identity.taId=user.taId||'TA-PENDING';app.state.identity.role=user.role||'free';app.state.identity.plan=user.plan||'FREE';app.state.identity.memberSince=app.state.identity.memberSince||nowIso();}
  else{app.state.identity.role='guest';app.state.identity.plan='FREE';}
  app.save?.();app.renderTopbar?.();app.renderRightPanel?.();app.renderRightRail?.();if(user)syncPortalCloud(app,{force:true}).catch(()=>{});
}
function patchAuthRestoration(app){
  window.addEventListener('tradeavata:auth-state',e=>applyAuthUser(app,e.detail?.user||null));
  window.TRADE_AVATA_AUTH_ADAPTER?.restoreSession?.().then(user=>applyAuthUser(app,user)).catch(()=>{});

  // The Owner UI can be displayed client-side, but production owner authority is accepted only
  // when Firebase supplied a verified custom claim. Backend services must independently verify the ID token.
  if(typeof app.openOwnerTradingLab==='function'&&!app.__taVerifiedOwnerLab){
    app.__taVerifiedOwnerLab=app.openOwnerTradingLab.bind(app);
    app.openOwnerTradingLab=function(){
      const u=currentUser(this),local=['localhost','127.0.0.1',''].includes(location.hostname);
      if(!local&&String(u?.role||'').toLowerCase()==='owner'&&u?.roleVerified!==true){toast('Verified Owner authority is required. Sign in with an account carrying the server-issued Owner claim.','error');return;}
      return this.__taVerifiedOwnerLab();
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Final boot / self-audit.                                                     */
/* -------------------------------------------------------------------------- */
function selfCheck(app){
  const checks={
    baselineV111:!!window.__tradeAvataV111,
    nativeChartPreserved:typeof ChartPane==='function',
    indicatorSecurityPreserved:typeof validateIndicatorSpec==='function'&&validateIndicatorSpec({kind:'ema',length:20}).ok&&validateIndicatorSpec({kind:'ema',code:'x'}).ok===false,
    portraitStates:['collapsed','half','full'].includes(app.state.mobilePanelState),
    landscapeOverlay:typeof app.renderBottom==='function',
    indicatorPortal:typeof app.openIndicatorPortal==='function',
    firebaseAdapter:!!window.TRADE_AVATA_AUTH_ADAPTER,
    marketFeed:!!window.TRADE_AVATA_MARKET_FEED,
    cTraderProvider:!!window.TRADE_AVATA_CTRADER_PROVIDER,
    secureSecretPosture:!('clientSecret'in(window.TRADE_AVATA_CTRADER_CONFIG||{})),
    performancePatch:!!ChartPane.prototype.__taLiveReadyOverlay
  };
  return{ok:Object.values(checks).every(Boolean),checks,build:BUILD};
}

function install(app){
  if(app.__taLiveReadyFinal)return;app.__taLiveReadyFinal=true;
  patchDenseChartPerformance(app);patchMobileBottomPanel(app);patchIndicatorPortal(app);patchFeedIntoCharts(app);patchAuthRestoration(app);
  app.renderTopbar?.();app.renderBottom?.();resizeCharts(app);
  window.__tradeAvataLiveReady={build:BUILD,app,selfCheck:()=>selfCheck(app),marketFeed,cTraderProvider};
  console.info(`[${BUILD}] installed`,selfCheck(app));
}
async function boot(){for(let i=0;i<320;i++){const app=window.__tradeAvataV111?.app||window.__tradeAvataFinalUpgrade?.app||window.__tradeAvata;if(app&&window.__tradeAvataV111){install(app);return;}await new Promise(r=>setTimeout(r,25));}console.error(`[${BUILD}] bootstrap timed out`);}boot();
