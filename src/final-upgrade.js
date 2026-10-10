import { el, toast, clamp, uid } from './utils.js';
import { SYMBOLS, formatPrice, periodLabel } from './data.js';
import { BUILTIN_INDICATORS, indicatorDefinition, indicatorLabel } from './indicators.js';
import { ChartPane } from './chart-pane.js';

const BUILD='Trade Avata Final Upgrade v11.0.0';
const GUEST_KEY='tradeAvataGuestWindowV11';
const ID_KEY='tradeAvataPublicIdentityV11';
const CLOUD_CACHE_KEY='tradeAvataCloudSettingsCacheV11';

const THEMES={
  default:{label:'Trade Avata',mode:'dark',surface:'#07111c',background:'#111820',text:'#9db4cc',grid:'rgba(76,103,130,.18)',up:'#00c7b1',down:'#ff4d57',wickUp:'#00aa99',wickDown:'#ef5861',cross:'#7f93a8'},
  midnight:{label:'Midnight',mode:'dark',surface:'#020509',background:'#070b10',text:'#9eb4c8',grid:'rgba(90,112,132,.15)',up:'#00d2b8',down:'#ff5361',wickUp:'#00baa4',wickDown:'#ec5b66',cross:'#73879a'},
  graphite:{label:'Graphite',mode:'dark',surface:'#16181b',background:'#1d2024',text:'#b8c2cc',grid:'rgba(145,155,165,.13)',up:'#47c7a5',down:'#ef6570',wickUp:'#3aae91',wickDown:'#db5b66',cross:'#87939e'},
  navy:{label:'Navy',mode:'dark',surface:'#07162b',background:'#091b31',text:'#a9c8e4',grid:'rgba(74,128,176,.16)',up:'#20d0b7',down:'#ff6070',wickUp:'#0bb69f',wickDown:'#ea5a66',cross:'#76a9d2'},
  slate:{label:'Slate',mode:'dark',surface:'#17212a',background:'#1c2730',text:'#b4c3cf',grid:'rgba(139,160,176,.15)',up:'#3cc2aa',down:'#f16c75',wickUp:'#2dad98',wickDown:'#d96069',cross:'#8ea0ae'},
  dusk:{label:'Dusk',mode:'dark',surface:'#1c1326',background:'#20162b',text:'#c8b9d8',grid:'rgba(158,123,188,.14)',up:'#2ec9ad',down:'#ff6f86',wickUp:'#27ad98',wickDown:'#e65d72',cross:'#aa87c7'},
  forest:{label:'Forest',mode:'dark',surface:'#0b1d19',background:'#10241f',text:'#b8d2ca',grid:'rgba(86,145,126,.14)',up:'#27d1a2',down:'#ff6d73',wickUp:'#1eb28c',wickDown:'#e65f66',cross:'#70a899'},
  wine:{label:'Wine',mode:'dark',surface:'#231018',background:'#28141c',text:'#d3b9c1',grid:'rgba(165,105,124,.14)',up:'#40c7a8',down:'#ff6c8a',wickUp:'#31ac91',wickDown:'#e65b76',cross:'#ac7e8f'},
  ice:{label:'Ice',mode:'dark',surface:'#0c1c26',background:'#102631',text:'#c2dce7',grid:'rgba(94,169,197,.13)',up:'#27d0bd',down:'#ff6478',wickUp:'#1db49f',wickDown:'#e6586b',cross:'#76bfd7'},
  amoled:{label:'AMOLED',mode:'dark',surface:'#000000',background:'#020202',text:'#aebcca',grid:'rgba(116,132,146,.11)',up:'#00d8b8',down:'#ff5262',wickUp:'#00bfa3',wickDown:'#e84c58',cross:'#74818e'},
  sepia:{label:'Sepia',mode:'dark',surface:'#302a22',background:'#352f27',text:'#d4c7b4',grid:'rgba(183,156,118,.13)',up:'#56b99b',down:'#df756d',wickUp:'#49a286',wickDown:'#ca665f',cross:'#b29c7d'},
  light:{label:'Soft Light',mode:'light',surface:'#f4f6f8',background:'#f2f4f6',text:'#526575',grid:'rgba(70,95,115,.12)',up:'#079f8d',down:'#e34b55',wickUp:'#078d7e',wickDown:'#cd4650',cross:'#75899a'}
};

const THEME_PREVIEWS={
  default:'linear-gradient(135deg,#07111c 0 54%,#0d2234 54%)', midnight:'linear-gradient(135deg,#020509 0 54%,#0a1119 54%)',
  graphite:'linear-gradient(135deg,#17191c 0 54%,#2c3035 54%)', navy:'linear-gradient(135deg,#07162b 0 54%,#0e2a4d 54%)',
  slate:'linear-gradient(135deg,#17212a 0 54%,#34424e 54%)', dusk:'linear-gradient(135deg,#1c1326 0 54%,#432d58 54%)',
  forest:'linear-gradient(135deg,#0b1d19 0 54%,#1a473b 54%)', wine:'linear-gradient(135deg,#231018 0 54%,#572435 54%)',
  ice:'linear-gradient(135deg,#0c1c26 0 54%,#1d4a5f 54%)', amoled:'linear-gradient(135deg,#000 0 54%,#111 54%)',
  sepia:'linear-gradient(135deg,#302a22 0 54%,#675a48 54%)', light:'linear-gradient(135deg,#eef2f5 0 54%,#f8fafb 54%)'
};

const SWATCHES=['#f4f6f8','#dfe5ea','#aebbc6','#697a88','#273644','#101820','#000000','#168cff','#62d6ff','#00c7b1','#22c55e','#84cc16','#facc15','#f59e0b','#ff7a45','#ff4d57','#ef4444','#fb7185','#d946ef','#a76dff','#7c3aed','#6366f1','#2563eb','#0ea5e9','#14b8a6','#059669','#16a34a','#65a30d','#ca8a04','#ea580c','#dc2626','#be123c'];

function deepClone(v){try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}}
function currentUser(app){return app.state.connection?.tradeAvataUser||null;}
function isLocal(){return ['localhost','127.0.0.1',''].includes(location.hostname);}
function isOwner(app){const u=currentUser(app);return u?.role==='owner'||(isLocal()&&app.state.ownerMode===true);}
function role(app){return isOwner(app)?'OWNER':currentUser(app)?String(currentUser(app).role||'FREE').toUpperCase():'GUEST';}
function plan(app){return isOwner(app)?'OWNER':String(app.state.identity?.plan||currentUser(app)?.plan||'FREE').toUpperCase();}
function isAuthenticated(app){return !!currentUser(app);}
function hash32(text){let h=2166136261>>>0;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function makeTaId(seed){const n=String(hash32(seed)||Math.floor(Math.random()*1e8)).padStart(8,'0').slice(-8);return `TA-${n}`;}
function round2(n){return Math.round(Number(n||0)*100)/100;}
function safePct(n){return Number.isFinite(Number(n))?Number(n):0;}
function setCssFromState(app){
  const u=app.state.uiStyle||{};const root=document.documentElement;
  root.style.setProperty('--ta-panel-opacity',String(clamp(Number(u.panelOpacity??.86),.35,1)));
  root.style.setProperty('--ta-menu-opacity',String(clamp(Number(u.menuOpacity??.9),.35,1)));
  root.style.setProperty('--ta-modal-opacity',String(clamp(Number(u.modalOpacity??.94),.45,1)));
  root.style.setProperty('--ta-glass-blur',`${clamp(Number(u.glassBlur??14),0,28)}px`);
  root.dataset.taDensity=u.density||'compact';
}
function updateIdentity(app){
  app.state.identity=app.state.identity||{};const u=currentUser(app);
  if(u){
    if(!u.taId)u.taId=app.state.identity.taId||makeTaId(u.uid||u.email||localStorage.getItem(ID_KEY)||Date.now());
    app.state.identity.taId=u.taId;app.state.identity.memberSince=app.state.identity.memberSince||new Date().toISOString();
    app.state.identity.role=isOwner(app)?'owner':(u.role||'free');app.state.identity.plan=isOwner(app)?'OWNER':(u.plan||app.state.identity.plan||'FREE');
    try{localStorage.setItem(ID_KEY,u.taId);}catch{}
  }else{
    app.state.identity.role='guest';app.state.identity.plan='FREE';
  }
}
function migrateState(app){
  const s=app.state;
  s.uiStyle={panelOpacity:.86,menuOpacity:.90,modalOpacity:.94,glassBlur:14,density:'compact',...(s.uiStyle||{})};
  s.roundNumbers={enabled:true,preset:'major-500',step:500,minorStep:100,showMinor:false,lineWidth:1.15,opacity:.55,...(s.roundNumbers||{})};
  s.favoriteSymbols=Array.isArray(s.favoriteSymbols)?s.favoriteSymbols.filter(Boolean):['XAUUSD','NAS100','EURUSD'];
  s.panelVisibility={watchlist:true,analysis:true,news:true,events:true,details:true,...(s.panelVisibility||{})};
  s.guestAccess={enabled:false,softPromptEnabled:true,hardLockEnabled:false,softMinutes:10,hardMinutes:40,resetHours:24,previewBehindGate:true,allowViewingWhenLocked:true,...(s.guestAccess||{})};
  s.subscription={paymentsEnabled:false,proVisible:false,advancedVisible:false,...(s.subscription||{})};
  s.featureFlags={projects:true,strategyVault:true,advancedVoice:false,deepResearch:false,chartAI:false,journalAI:false,analyticsAI:false,customAgents:false,...(s.featureFlags||{})};
  s.providerQuotas=s.providerQuotas||{};s.indicatorEntitlements=Array.isArray(s.indicatorEntitlements)?s.indicatorEntitlements:[];s.licenseGrants=Array.isArray(s.licenseGrants)?s.licenseGrants:[];
  s.performanceMode=s.performanceMode||'auto';s.themeSyncChart=s.themeSyncChart!==false;s.workspaceAutosave=s.workspaceAutosave!==false;s.ui=s.ui||{};
  for(const ind of s.indicators||[]){
    if(ind.kind==='stochastic'){ind.kSlowing=Number(ind.kSlowing||3);ind.d=Number(ind.d||3);ind.maType=ind.maType||'sma';ind.calculation=ind.calculation||'lowhigh';ind.levels=Array.isArray(ind.levels)?ind.levels:[20,50,80];}
    if(!ind.customName)ind.name=indicatorLabel(ind);
    ind.lineStyle=ind.lineStyle||'solid';if(ind.opacity==null)ind.opacity=1;
  }
  if(!isLocal()&&!currentUser(app)?.role?.toLowerCase?.().includes('owner'))s.ownerMode=false;
  updateIdentity(app);setCssFromState(app);
}
function applyThemePalette(app,id,{record=false}={}){
  const t=THEMES[id]||THEMES.default,s=app.state;
  if(record){s.ui=s.ui||{};s.ui.themeUndo={platformTheme:s.platformTheme,themeSyncChart:s.themeSyncChart,background:s.background,textColor:s.textColor,gridColor:s.gridColor,candleStyle:deepClone(s.candleStyle),crosshairColor:s.crosshairColor};s.ui.lastActionType='theme';}
  s.platformTheme=id;s.theme=t.mode;
  if(s.themeSyncChart!==false){
    s.background=t.background;s.textColor=t.text;s.gridColor=t.grid;s.crosshairColor=t.cross;
    s.candleStyle={...(s.candleStyle||{}),upBody:t.up,downBody:t.down,upBorder:t.up,downBorder:t.down,upWick:t.wickUp,downWick:t.wickDown,borderVisible:s.candleStyle?.borderVisible!==false,wickVisible:s.candleStyle?.wickVisible!==false};
    s.upColor=t.up;s.downColor=t.down;s.wickUp=t.wickUp;s.wickDown=t.wickDown;
  }
  document.documentElement.dataset.taTheme=id;document.body.classList.toggle('theme-light',t.mode==='light');setCssFromState(app);
  app.panes?.forEach(p=>{try{p.chart?.applyOptions?.({layout:{background:{type:'solid',color:s.background},textColor:s.textColor},grid:{vertLines:{visible:s.gridV,color:s.gridColor},horzLines:{visible:s.gridH,color:s.gridColor}},roundNumbers:s.roundNumbers,majorRoundGrid:!!s.majorRoundGrid,roundNumberColor:s.textColor});p.refreshAppearance?.({preserveView:true});}catch{}});
}

function setting(label,control,help=''){return el('div',{class:'setting-row'},el('div',{},el('label',{},label),help?el('small',{},help):null),control);}
function selectControl(options,value,onchange){const s=el('select',{class:'field'});for(const opt of options){const [v,l]=Array.isArray(opt)?opt:[opt,opt];const o=el('option',{value:v},l);if(String(v)===String(value))o.selected=true;s.append(o);}s.addEventListener('change',()=>onchange(s.value));return s;}
function numberControl(value,onchange,{min=null,max=null,step='any'}={}){const n=el('input',{class:'field',type:'number',value:value??'',step});if(min!=null)n.min=min;if(max!=null)n.max=max;n.addEventListener('input',()=>onchange(n.value));return n;}
function textControl(value,onchange,placeholder=''){const n=el('input',{class:'field',type:'text',value:value??'',placeholder});n.addEventListener('input',()=>onchange(n.value));return n;}
function toggleControl(value,onchange){const l=el('label',{class:'check'}),i=el('input',{type:'checkbox'}),sp=el('span',{},value?'On':'Off');i.checked=!!value;i.addEventListener('change',()=>{sp.textContent=i.checked?'On':'Off';onchange(i.checked);});l.append(i,sp);return l;}
function rangeControl(value,min,max,step,onchange,format=v=>v){const wrap=el('div',{class:'ta-range-control'}),i=el('input',{type:'range',min,max,step,value}),o=el('output',{},format(value));i.addEventListener('input',()=>{o.textContent=format(i.value);onchange(Number(i.value));});wrap.append(i,o);return wrap;}
function colorSwatches(value,onchange){const g=el('div',{class:'ta-swatch-grid'});for(const c of SWATCHES){const b=el('button',{class:`ta-swatch ${String(value).toLowerCase()===c.toLowerCase()?'selected':''}`,title:c,style:`background:${c}`,onclick:()=>{g.querySelectorAll('.ta-swatch').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');onchange(c);}});g.append(b);}return g;}
function section(title,...children){const x=el('div',{class:'ta-upgrade-section'},el('h4',{},title));x.append(...children);return x;}

function patchThemesAndSettings(app){
  const originalApply=app.applyPlatformTheme.bind(app);
  app.applyPlatformTheme=function(){
    try{originalApply();}catch{}
    let id=this.state.platformTheme||'default';if(id==='dark'||id==='system')id=id==='system'&&(matchMedia?.('(prefers-color-scheme: light)')?.matches)?'light':'default';
    if(!THEMES[id])id='default';applyThemePalette(this,id,{record:false});
  };
  app.setTradeAvataTheme=function(id){if(!THEMES[id])return;applyThemePalette(this,id,{record:true});this.save();this.renderTopbar();this.renderRightPanel();};
  const oldUndo=app.undo.bind(app);
  app.undo=function(){const u=this.state.ui?.themeUndo;if(this.state.ui?.lastActionType==='theme'&&u){this.state.platformTheme=u.platformTheme||'default';this.state.themeSyncChart=u.themeSyncChart!==false;this.state.background=u.background;this.state.textColor=u.textColor;this.state.gridColor=u.gridColor;this.state.candleStyle=deepClone(u.candleStyle);this.state.crosshairColor=u.crosshairColor;this.state.ui.themeUndo=null;this.state.ui.lastActionType=null;this.applyPlatformTheme();this.refreshAllCharts();toast('Theme change undone');return;}return oldUndo();};
  const oldFill=app.fillSettings.bind(app);
  app.fillSettings=function(tab,nav,body){
    oldFill(tab,nav,body);
    if(tab==='platform'){
      body.append(section('V11 · Unified themes',el('p',{class:'settings-note'},'Themes update the Trade Avata interface and chart together. Use Undo immediately after a theme change to restore the previous appearance.')));
      const grid=el('div',{class:'ta-theme-grid'});for(const [id,t] of Object.entries(THEMES)){const b=el('button',{class:`ta-theme-card ${this.state.platformTheme===id?'active':''}`,onclick:()=>{this.setTradeAvataTheme(id);this.fillSettings('platform',nav,body);}},el('span',{class:'ta-theme-preview',style:`background:${THEME_PREVIEWS[id]}`}),el('strong',{},t.label));grid.append(b);}body.append(grid);
      body.append(setting('Theme also controls chart',toggleControl(this.state.themeSyncChart!==false,v=>{this.state.themeSyncChart=v;this.applyPlatformTheme();this.save();}),'When enabled, the chart background, labels, grid and candle palette follow the selected theme immediately.'));
      body.append(section('Glass interface',
        setting('Panels opacity',rangeControl((this.state.uiStyle.panelOpacity??.86)*100,35,100,1,v=>{this.state.uiStyle.panelOpacity=v/100;setCssFromState(this);this.save();},v=>`${v}%`)),
        setting('Dropdown opacity',rangeControl((this.state.uiStyle.menuOpacity??.9)*100,35,100,1,v=>{this.state.uiStyle.menuOpacity=v/100;setCssFromState(this);this.save();},v=>`${v}%`)),
        setting('Modal opacity',rangeControl((this.state.uiStyle.modalOpacity??.94)*100,45,100,1,v=>{this.state.uiStyle.modalOpacity=v/100;setCssFromState(this);this.save();},v=>`${v}%`)),
        setting('Glass blur',rangeControl(this.state.uiStyle.glassBlur??14,0,28,1,v=>{this.state.uiStyle.glassBlur=v;setCssFromState(this);this.save();},v=>`${v}px`)),
        setting('UI density',selectControl([['compact','Compact'],['comfortable','Comfortable']],this.state.uiStyle.density||'compact',v=>{this.state.uiStyle.density=v;setCssFromState(this);this.save();}))
      ));
      body.append(section('Performance',setting('Rendering mode',selectControl([['auto','Auto'],['quality','High Quality'],['performance','Performance']],this.state.performanceMode||'auto',v=>{this.state.performanceMode=v;applyPerformanceMode(this);this.save();}),'Auto keeps the current crisp candles but reduces unnecessary effects on slower phones.')));
    }
    if(tab==='canvas'){
      const rn=this.state.roundNumbers;
      body.append(section('Round-number price levels',
        el('p',{class:'settings-note'},'Round-number levels are independent from the normal chart grid. “Major 500” emphasizes prices such as 2,000 / 2,500 / 3,000. “Hundreds” also exposes levels such as 2,600 / 2,700 / 2,800.'),
        setting('Show round-number levels',toggleControl(rn.enabled!==false,v=>{rn.enabled=v;this.state.majorRoundGrid=v;this.refreshAllCharts();})),
        setting('Preset',selectControl([['major-500','Major 500 / 000'],['thousands','Thousands'],['hundreds','Every 100'],['fifties','Every 50'],['custom','Custom step']],rn.preset||'major-500',v=>{rn.preset=v;this.refreshAllCharts();})),
        setting('Custom step',numberControl(rn.step||500,v=>{rn.step=Math.max(.00001,Number(v)||500);this.refreshAllCharts();},{min:.00001})),
        setting('Show minor levels',toggleControl(!!rn.showMinor,v=>{rn.showMinor=v;this.refreshAllCharts();})),
        setting('Minor step',numberControl(rn.minorStep||100,v=>{rn.minorStep=Math.max(.00001,Number(v)||100);this.refreshAllCharts();},{min:.00001})),
        setting('Round-level strength',rangeControl((rn.opacity??.55)*100,10,100,1,v=>{rn.opacity=v/100;this.refreshAllCharts();},v=>`${v}%`))
      ));
      body.append(section('Professional colour palette',el('p',{class:'settings-note'},'Square shade cells are reusable across chart, drawing and indicator controls.'),colorSwatches(this.state.background,c=>{this.state.background=c;this.refreshAllCharts();this.save();})));
    }
    if(tab==='ai'){
      const voices=typeof speechSynthesis!=='undefined'?(speechSynthesis.getVoices?.()||[]):[];const voiceOptions=[['','System default'],...voices.map(v=>[v.name,`${v.name}${v.lang?` · ${v.lang}`:''}`])];
      body.append(section('Free browser voice',el('p',{class:'settings-note'},'This voice uses the device/browser speech engine and does not consume Trade Avata cloud voice minutes. Naturalness depends on the voices installed on the device.'),setting('Voice',selectControl(voiceOptions,this.state.aiAccess?.browserVoice||'',v=>{this.state.aiAccess.browserVoice=v;this.save();})),setting('Rate',rangeControl((this.state.aiAccess?.speechRate||1)*100,60,150,5,v=>{this.state.aiAccess.speechRate=v/100;this.save();},v=>`${v}%`)),setting('Pitch',rangeControl((this.state.aiAccess?.speechPitch||1)*100,70,130,5,v=>{this.state.aiAccess.speechPitch=v/100;this.save();},v=>`${v}%`)),setting('Preview',el('button',{class:'secondary',onclick:()=>this.speakAI?.('Trade Avata voice preview. Trading made simpler.')},'Play voice'))));
      if(isOwner(this))body.append(section('Advanced natural voice',el('p',{class:'settings-note'},this.state.featureFlags.advancedVoice?'Advanced voice is enabled for OWNER. Provider execution must still pass the recurring-free quota guard before any request is sent.':'Advanced natural voice is owner-only and remains off until a recurring free/resetting provider is connected. One-time non-resetting credits are not accepted as the core provider.')));
    }
    if(tab==='events'){
      body.append(section('Context panel visibility',
        setting('Symbol details',toggleControl(this.state.panelVisibility.details!==false,v=>{this.state.panelVisibility.details=v;this.renderRightPanel();this.save();})),
        setting('Analytics',toggleControl(this.state.panelVisibility.analysis!==false,v=>{this.state.panelVisibility.analysis=v;this.renderRightPanel();this.save();})),
        setting('News',toggleControl(this.state.panelVisibility.news!==false,v=>{this.state.panelVisibility.news=v;this.renderRightPanel();this.save();})),
        setting('Events',toggleControl(this.state.panelVisibility.events!==false,v=>{this.state.panelVisibility.events=v;this.renderRightPanel();this.save();}))
      ));
    }
    if(tab==='trading'){
      body.append(section('Chart trading',
        setting('Prepare trade first',el('button',{class:'secondary',onclick:()=>{this.closeModal();this.startPrepareTrade('Buy');}},'Prepare Buy setup')),
        setting('Prepare sell setup',el('button',{class:'secondary',onclick:()=>{this.closeModal();this.startPrepareTrade('Sell');}},'Prepare Sell setup')),
        setting('Default confirmation',toggleControl(this.state.oneClickTrading!==true,v=>{this.state.oneClickTrading=!v;this.save();}),'When confirmation is on, live orders require confirmation before the broker gateway receives them.')
      ));
    }
  };
}

function applyPerformanceMode(app){
  const m=app.state.performanceMode||'auto',root=document.documentElement;root.dataset.taPerformance=m;
  const perf=m==='performance'||(m==='auto'&&(navigator.hardwareConcurrency||8)<=4);
  root.style.setProperty('--ta-glass-blur',perf?`${Math.min(7,Number(app.state.uiStyle?.glassBlur||14))}px`:`${Number(app.state.uiStyle?.glassBlur||14)}px`);
  document.body.classList.toggle('ta-performance-mode',perf);
}

function patchWatchlistAndAnalysis(app){
  app.renderWatchlist=function(body){
    const s=this.state,q=String(s.watchlistQuery||'').trim().toUpperCase();
    const tools=el('div',{class:'ta-watch-tools'}),search=el('input',{class:'field',placeholder:'Search watchlist…',value:s.watchlistQuery||''}),add=el('button',{class:'secondary ta-watch-add',title:'Add symbol'},'+');
    search.addEventListener('input',()=>{s.watchlistQuery=search.value;this.renderRightPanel();});
    add.addEventListener('click',()=>{const sym=prompt('Add symbol to watchlist:','')?.trim().toUpperCase();if(!sym)return;if(!s.watchlist.includes(sym))s.watchlist.push(sym);if(!s.favoriteSymbols.includes(sym)&&s.watchlist.length<=3)s.favoriteSymbols.push(sym);this.save();this.renderRightPanel();});tools.append(search,add);body.append(tools);
    const rows=s.watchlist.filter(sym=>!q||sym.includes(q)||String(SYMBOLS[sym]?.name||'').toUpperCase().includes(q));
    const frag=document.createDocumentFragment();for(const sym of rows){const cfg=SYMBOLS[sym]||{name:'Feed symbol',base:0,precision:2,minMove:.01},active=this.activeConfig().symbol===sym,pane=active?this.activePane():null,lastBar=pane?.displayBars?.at(-1),firstBar=pane?.displayBars?.at(-Math.min(80,pane?.displayBars?.length||1));let last=lastBar?.close;const realChange=Number.isFinite(last)&&Number.isFinite(firstBar?.open)&&firstBar.open!==0?((last-firstBar.open)/firstBar.open*100):null;if(!Number.isFinite(last))last=this.state.connection?.status==='live'?null:(cfg.base||0);const fav=s.favoriteSymbols.includes(sym),changeText=Number.isFinite(realChange)?`${realChange>=0?'+':''}${realChange.toFixed(2)}%`:'—';const row=el('div',{class:`watch-row ta-watch-row ${active?'active':''}`},el('button',{class:`ta-watch-star ${fav?'on':''}`,title:fav?'Remove favorite':'Favorite',onclick:e=>{e.stopPropagation();s.favoriteSymbols=fav?s.favoriteSymbols.filter(x=>x!==sym):[...s.favoriteSymbols,sym];this.save();this.renderRightPanel();}},fav?'★':'☆'),el('div',{onclick:()=>this.setSymbol(sym)},el('strong',{},sym),el('small',{},cfg.name||'Feed symbol')),el('span',{class:'watch-price',onclick:()=>this.setSymbol(sym)},Number.isFinite(last)?formatPrice(sym,last):'—'),el('span',{class:`watch-change ${realChange>=0?'pos':realChange<0?'neg':''}`,onclick:()=>this.setSymbol(sym)},changeText));frag.append(row);}body.append(frag);
    if(!rows.length)body.append(el('div',{class:'empty-state'},'No watchlist symbols match this search.'));
    renderSymbolDetail(this,body,this.activeConfig().symbol);
  };
  app.openSymbolMenu=function(anchor){
    const favs=(this.state.favoriteSymbols||[]).filter(Boolean);const items=(favs.length?favs:this.state.watchlist.slice(0,8)).map(sym=>({label:`${sym}  ·  ${SYMBOLS[sym]?.name||'Feed symbol'}`,active:this.activeConfig().symbol===sym,action:()=>this.setSymbol(sym)}));
    items.push({label:'Manage full watchlist…',action:()=>this.toggleRightPanel('watchlist')});this.openMenu(anchor,items,260);
  };
  const oldMarket=app.renderMarketCenter.bind(app);
  app.renderMarketCenter=function(body){oldMarket(body);body.prepend(el('div',{class:'side-card'},el('strong',{},`${this.marketState().symbol} · symbol analytics`),el('p',{},'Overview, performance, screener, sentiment and AI-alert views can be switched in and out. Live-data-only fields activate when the configured feed supplies them.')));};
}
function renderSymbolDetail(app,body,sym){
  if(app.state.panelVisibility?.details===false)return;const p=app.panes.find(x=>x.symbol===sym)||app.activePane(),bars=p?.displayBars||[],last=bars.at(-1),slice=bars.slice(-Math.min(160,bars.length));if(!last)return;
  const hi=slice.length?Math.max(...slice.map(x=>x.high)):last.high,lo=slice.length?Math.min(...slice.map(x=>x.low)):last.low,first=slice[0]?.open||last.open,chg=first?((last.close-first)/first*100):0,pos=hi>lo?((last.close-lo)/(hi-lo))*100:50;
  const wrap=el('div',{class:'ta-symbol-detail'});wrap.append(el('div',{class:'ta-symbol-detail-price'},formatPrice(sym,last.close)),el('div',{class:chg>=0?'pos':'neg'},`${chg>=0?'+':''}${chg.toFixed(2)}% · visible range`));const r=el('div',{class:'ta-range'},el('i',{style:`left:${clamp(pos,0,100)}%`}));wrap.append(r,el('small',{},`${formatPrice(sym,lo)}  —  ${formatPrice(sym,hi)}`));
  if(app.state.panelVisibility?.analysis!==false){const g=el('div',{class:'ta-analysis-grid'});const avg=(arr,fn)=>arr.length?arr.reduce((a,x)=>a+fn(x),0)/arr.length:0;const atr=avg(slice.slice(-14),b=>b.high-b.low),vol=avg(slice.slice(-20),b=>b.volume||0);for(const [k,v] of [['Trend',chg>0?'Bullish':chg<0?'Bearish':'Flat'],['Range',formatPrice(sym,hi-lo)],['Avg move',formatPrice(sym,atr)],['Bars',slice.length],['Volume',Math.round(vol)],['Period',periodLabel(p?.period||{mode:'time',value:'15s'})]])g.append(el('div',{},el('small',{},k),el('b',{},v)));wrap.append(el('div',{class:'ta-analysis-card'},el('h4',{},'Selected-symbol analytics'),g));}
  if(app.state.panelVisibility?.news!==false)wrap.append(el('div',{class:'ta-analysis-card'},el('h4',{},'News'),el('p',{class:'settings-note'},app.state.connection?.status==='live'?'Live news appears here when the configured market-news provider supplies this symbol.':'No live news provider is configured in this package; Trade Avata does not manufacture headlines.')));
  if(app.state.panelVisibility?.events!==false)wrap.append(el('div',{class:'ta-analysis-card'},el('h4',{},'Events'),el('p',{class:'settings-note'},app.state.showEconomicEvents!==false?'Economic/event markers are enabled. Real events appear when the backend calendar feed is connected.':'Event markers are disabled in Settings.')));
  body.append(wrap);
}

function patchIndicatorUX(app){
  const origRefresh=ChartPane.prototype.refreshHeader;
  if(!ChartPane.prototype.__taV11HeaderPatched){
    ChartPane.prototype.refreshHeader=function(...args){const out=origRefresh.apply(this,args);try{enhanceLegend(this);}catch(err){console.warn('Trade Avata legend enhancement',err);}return out;};ChartPane.prototype.__taV11HeaderPatched=true;
  }
  app.openIndicatorManager=function(){
    const m=this.makeModal('Indicators on chart','indicator-manager-modal'),body=el('div',{class:'settings-body ta-indicator-manager'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';const inds=this.state.indicators||[];
    if(!inds.length){body.append(el('div',{class:'empty-state'},'No indicators attached.'));return;}
    const groups=new Map();for(const ind of inds){const key=(indicatorDefinition(ind.kind)?.pane||ind.pane)==='oscillator'?'Oscillators':'Main chart';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ind);}for(const [name,list] of groups){body.append(el('h4',{},`${name} · ${list.length}`));for(const ind of list){const row=el('div',{class:'ta-ind-row'},el('button',{class:'icon-btn',title:ind.visible===false?'Show':'Hide',onclick:()=>{this.toggleIndicatorVisibility(ind.id);this.openIndicatorManager();}},ind.visible===false?'○':'◉'),el('div',{},el('strong',{},ind.name),el('small',{},`${indicatorDefinition(ind.kind)?.name||ind.kind} · ${ind.source||'close'}`)),el('button',{class:'secondary',onclick:()=>this.openIndicatorSettings(ind.id)},'Edit'),el('button',{class:'secondary',onclick:()=>{const c=deepClone(ind);c.id=uid(ind.kind);c.customName=false;c.name=indicatorLabel(c);this.state.indicators.push(c);this.refreshAllCharts();this.save();this.openIndicatorManager();}},'Copy'),el('button',{class:'danger',onclick:()=>{this.removeIndicator(ind.id);this.openIndicatorManager();}},'×'));body.append(row);}}
  };
  app.openIndicatorSettings=function(id){
    this.closeMenu?.();const ind=this.state.indicators.find(x=>x.id===id);if(!ind)return;const def=indicatorDefinition(ind.kind);const m=this.makeModal(`Edit · ${indicatorLabel(ind)}`,'indicator-modal master-indicator-settings'),wrap=el('div',{class:'settings-body'});m.main.replaceChildren(wrap);m.ok.textContent='Close';m.cancel.style.display='none';m.ok.onclick=()=>{this.closeModal();this.save();};
    const live=()=>{if(!ind.customName)ind.name=indicatorLabel(ind);this.refreshAllCharts();this.save();};
    const inputs=el('div',{class:'ta-upgrade-section'},el('h4',{},'Parameters / Inputs'));
    if(['ema','sma','wma','moving-average','rsi','atr','adx','cci','momentum','roc','bollinger'].includes(ind.kind))inputs.append(setting('Period',numberControl(ind.length??def?.defaults?.length??20,v=>{ind.length=Math.max(1,Math.round(Number(v)||1));live();},{min:1,step:1})));
    if(['ema','sma','wma','moving-average','rsi','cci','momentum','roc','bollinger'].includes(ind.kind))inputs.append(setting('Source',selectControl([['close','Close'],['open','Open'],['high','High'],['low','Low'],['hl2','HL2'],['hlc3','HLC3'],['ohlc4','OHLC4']],ind.source||'close',v=>{ind.source=v;live();})));
    if(ind.kind==='bollinger')inputs.append(setting('Deviation',numberControl(ind.multiplier??2,v=>{ind.multiplier=Math.max(.1,Number(v)||2);live();},{min:.1,step:.1})));
    if(ind.kind==='moving-average')inputs.append(setting('MA Type',selectControl([['ema','Exponential'],['sma','Simple'],['wma','Weighted / linear weights'],['wilder','Wilder smoothing'],['hull','Hull'],['triangular','Triangular'],['dema','Double Exponential'],['tema','Triple Exponential'],['linreg','Linear Regression']],ind.maType||'ema',v=>{ind.maType=v;live();})));
    if(ind.kind==='macd'){
      inputs.append(setting('Fast period',numberControl(ind.fast??12,v=>{ind.fast=Math.max(1,+v||12);live();},{min:1,step:1})),setting('Slow period',numberControl(ind.slow??26,v=>{ind.slow=Math.max(2,+v||26);live();},{min:2,step:1})),setting('Signal period',numberControl(ind.signal??9,v=>{ind.signal=Math.max(1,+v||9);live();},{min:1,step:1})));
    }
    if(ind.kind==='stochastic'){
      inputs.append(setting('K Periods',numberControl(ind.k??14,v=>{ind.k=Math.max(1,+v||14);live();},{min:1,step:1})),setting('K Slowing',numberControl(ind.kSlowing??3,v=>{ind.kSlowing=Math.max(1,+v||3);live();},{min:1,step:1})),setting('D Periods',numberControl(ind.d??3,v=>{ind.d=Math.max(1,+v||3);live();},{min:1,step:1})),setting('MA Type',selectControl([['sma','Simple'],['ema','Exponential'],['wma','Weighted / linear weights'],['wilder','Wilder smoothing'],['hull','Hull'],['triangular','Triangular'],['dema','Double Exponential'],['tema','Triple Exponential'],['linreg','Linear Regression']],ind.maType||'sma',v=>{ind.maType=v;live();})),setting('Calculation',selectControl([['lowhigh','Low / High'],['closeclose','Close / Close']],ind.calculation||'lowhigh',v=>{ind.calculation=v;live();})));
    }
    wrap.append(inputs);
    const style=section('Lines / Style',setting('Visible',toggleControl(ind.visible!==false,v=>{ind.visible=v;live();})),setting('Line width',rangeControl(ind.lineWidth??1.5,.5,5,.5,v=>{ind.lineWidth=v;live();},v=>`${v}px`)),setting('Line style',selectControl([['solid','Solid'],['dashed','Dashed'],['dotted','Dotted']],ind.lineStyle||'solid',v=>{ind.lineStyle=v;live();})),setting('Opacity',rangeControl((ind.opacity??1)*100,20,100,1,v=>{ind.opacity=v/100;live();},v=>`${v}%`)),el('div',{},el('small',{class:'settings-note'},'Colour'),colorSwatches(ind.color||'#178eff',c=>{ind.color=c;live();})));
    if(ind.kind==='stochastic'||ind.kind==='macd')style.append(setting('Signal / %D colour',el('div',{},colorSwatches(ind.signalColor||'#f3a000',c=>{ind.signalColor=c;live();}))));wrap.append(style);
    if(['rsi','stochastic','adx','cci','momentum','roc'].includes(ind.kind)){
      const lv=Array.isArray(ind.levels)?ind.levels:(ind.kind==='stochastic'?[20,50,80]:ind.kind==='rsi'?[30,50,70]:[0]);wrap.append(section('Levels', setting('Levels', textControl(lv.join(', '), v=>{ const a=v.split(',').map(x=>Number(x.trim())).filter(Number.isFinite); if(a.length){ ind.levels=a; live(); } }, '20, 50, 80'), 'Comma-separated horizontal levels.')));
    }
    wrap.append(section('Visibility / Advanced',setting('Pane',el('span',{},(def?.pane||ind.pane)==='oscillator'?'Oscillator pane':'Main chart')),setting('Auto label',el('span',{},indicatorLabel(ind)),'Names are generated from parameters; ordinary users do not need to type indicator names.'),setting('Reset to defaults',el('button',{class:'secondary',onclick:()=>{Object.assign(ind,deepClone(def?.defaults||{}));ind.customName=false;ind.name=indicatorLabel(ind);live();this.openIndicatorSettings(id);}},'Reset'))));
  };
}
function enhanceLegend(pane){
  const legend=pane.root.querySelector('.indicator-legend');if(!legend)return;const items=[...legend.querySelectorAll('.legend-item')],limit=window.innerWidth<=780?2:4;items.forEach((item,i)=>{const id=item.dataset.indicator;if(!id)return;if(!item.querySelector('.ta-legend-edit')){item.append(el('button',{class:'ta-legend-edit',title:'Edit indicator',onclick:e=>{e.stopPropagation();pane.app.openIndicatorSettings(id);}},'✎'),el('button',{class:'ta-legend-remove',title:'Remove indicator',onclick:e=>{e.stopPropagation();pane.app.removeIndicator(id);}},'×'));}item.style.display=i<limit?'flex':'none';});legend.querySelector('.ta-indicator-more')?.remove();if(items.length>limit)legend.append(el('button',{class:'ta-indicator-more',onclick:e=>{e.stopPropagation();pane.app.openIndicatorManager();}},`+${items.length-limit} more`));
}

function patchLayouts(app){
  app.exportActiveChartData=function(){const p=this.activePane();if(!p)return;const bars=p.displayBars||[];if(!bars.length){toast('No chart data to export','error');return;}const esc=v=>`"${String(v??'').replaceAll('\"','\"\"')}"`;const rows=[['time','open','high','low','close','volume'],...bars.map(b=>[new Date(Number(b.time)*1000).toISOString(),b.open,b.high,b.low,b.close,b.volume??''])];const csv=rows.map(r=>r.map(esc).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Trade-Avata-${p.symbol}-${String(p.timeframe||'chart').replaceAll('/','-')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Chart data exported','success');};
  const old=app.openLayoutMenu.bind(app);
  app.openLayoutMenu=function(anchor){
    old(anchor);const menu=this.menu||document.querySelector('.layout-picker');if(!menu)return;
    const div=el('div',{class:'menu-divider'}),title=el('div',{class:'menu-title'},'Layout workspace');menu.append(div,title,
      el('button',{class:'menu-item',onclick:()=>this.saveWorkspacePrompt()},'Save layout'),
      el('button',{class:'menu-item',onclick:()=>{this.state.workspaceAutosave=!this.state.workspaceAutosave;this.save();this.closeMenu();toast(`Layout autosave ${this.state.workspaceAutosave?'on':'off'}`);}},`Autosave · ${this.state.workspaceAutosave?'On':'Off'}`),
      el('button',{class:'menu-item',onclick:()=>this.openWorkspaceManager()},'Open / rename / copy layouts…'),
      el('button',{class:'menu-item',onclick:()=>this.openShareCenter?.()},'Share current layout…'),
      el('button',{class:'menu-item',onclick:()=>this.exportActiveChartData()},'Export active chart data (.csv)')
    );
  };
  const oldSave=app.save.bind(app),cloudDebounce={t:null};
  app.save=function(){if(this.state.workspaceAutosave&&!this.detachedInfo?.detached){this.state.lastWorkspaceAutosave=new Date().toISOString();}oldSave();clearTimeout(cloudDebounce.t);cloudDebounce.t=setTimeout(()=>syncAccountSettingsOut(this),900);};
}
async function syncAccountSettingsOut(app){
  if(!isAuthenticated(app))return;const adapter=window.TRADE_AVATA_CLOUD_SETTINGS;if(!adapter?.save)return;try{const payload={version:11,identity:deepClone(app.state.identity),preferences:pickCloudState(app.state)};await adapter.save(payload);localStorage.setItem(CLOUD_CACHE_KEY,JSON.stringify(payload));app.state.cloudSyncStatus='synced';}catch{app.state.cloudSyncStatus='offline-cache';}
}
function pickCloudState(s){return deepClone({platformTheme:s.platformTheme,themeSyncChart:s.themeSyncChart,uiStyle:s.uiStyle,performanceMode:s.performanceMode,gridH:s.gridH,gridV:s.gridV,majorRoundGrid:s.majorRoundGrid,roundNumbers:s.roundNumbers,background:s.background,textColor:s.textColor,gridColor:s.gridColor,candleStyle:s.candleStyle,crosshairColor:s.crosshairColor,marketLineStyles:s.marketLineStyles,showBidLine:s.showBidLine,showAskLine:s.showAskLine,showLastPriceLine:s.showLastPriceLine,showCountdown:s.showCountdown,timezone:s.timezone,favoritePeriods:s.favoritePeriods,favoriteSymbols:s.favoriteSymbols,watchlist:s.watchlist,indicators:s.indicators,indicatorProfiles:s.indicatorProfiles,chartSettings:s.chartSettings,workspaces:s.workspaces,chartTemplates:s.chartTemplates,panelVisibility:s.panelVisibility,drawingFavorites:s.drawingFavorites});}
async function syncAccountSettingsIn(app){
  if(!isAuthenticated(app))return;const adapter=window.TRADE_AVATA_CLOUD_SETTINGS;if(!adapter?.load)return;try{const remote=await adapter.load();const prefs=remote?.preferences;if(prefs&&typeof prefs==='object'){for(const [k,v] of Object.entries(prefs))app.state[k]=deepClone(v);migrateState(app);app.applyPlatformTheme();app.applyLayout(app.state.layout||'1',false);app.renderRightPanel();app.renderBottom();toast('Account settings restored on this device','success');}}catch{}
}

function patchLoginProfile(app){
  app.openProfile=function(){this.openLogin('profile');};
  app.openLogin=function(mode='login'){
    this.closeMenu?.();const m=this.makeModal(isAuthenticated(this)?'Trade Avata Profile':'Sign in to Trade Avata','login-modal'),body=el('div',{class:'ta-login-shell'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';const user=currentUser(this);
    body.append(el('div',{class:'ta-login-logo'},el('img',{src:this.state.brand?.logoDataUrl||'./public/brand/trade-avata-logo.svg',alt:'Trade Avata'}),el('div',{},el('h3',{},user?'Your Trade Avata account':'Trade Avata'),el('small',{},user?'Identity, saved layouts and connected trading services':'Sign in first; connect a trading account after.'))));
    if(!user){
      const fields=el('div',{class:'ta-login-fields'}),email=el('input',{type:'email',class:'field',placeholder:'Email address',autocomplete:'email'}),pass=el('input',{type:'password',class:'field',placeholder:'Password',autocomplete:'current-password'});fields.append(email,pass);body.append(fields);
      const actions=el('div',{class:'ta-login-actions'}),btn=el('button',{class:'primary'},'Sign in'),create=el('button',{class:'secondary'},'Create account');actions.append(btn,create);body.append(actions,el('p',{class:'settings-note'},'This standalone chart package uses the configured Trade Avata authentication adapter when present. Broker login remains a separate step and broker passwords are never stored here.'));
      const sign=async(createMode=false)=>{const em=email.value.trim();if(!em){toast('Enter your email','error');return;}const adapter=window.TRADE_AVATA_AUTH_ADAPTER;try{let u;if(adapter?.[createMode?'createAccount':'signIn'])u=await adapter[createMode?'createAccount':'signIn']({email:em,password:pass.value});else if(isLocal())u={email:em,uid:`preview-${hash32(em)}`,role:this.state.ownerMode?'owner':'free',preview:true};else throw new Error('Trade Avata authentication is not connected to this deployment yet. Connect the production auth adapter before enabling public sign-in.');if(!u)throw new Error('No user returned');u.taId=u.taId||makeTaId(u.uid||u.email);this.state.connection.tradeAvataUser=u;updateIdentity(this);this.save();await syncAccountSettingsIn(this);this.closeModal();removeGuestGate();this.renderTopbar();this.renderRightPanel();toast(createMode?'Trade Avata account created':'Signed in','success');}catch(e){toast(e?.message||'Sign in failed','error');}};
      btn.onclick=()=>sign(false);create.onclick=()=>sign(true);return;
    }
    updateIdentity(this);const card=el('div',{class:'ta-profile-card'},el('div',{style:'display:flex;justify-content:space-between;gap:8px;align-items:center'},el('div',{},el('small',{},user.email||'Trade Avata user'),el('div',{class:'ta-profile-id'},this.state.identity.taId||user.taId)),el('div',{},el('span',{class:`ta-role-badge ${isOwner(this)?'owner':''}`},role(this)),document.createTextNode(' '),el('span',{class:'ta-plan-badge'},plan(this)))));const pg=el('div',{class:'ta-profile-grid'});for(const [a,b] of [['Email',user.email||'—'],['Member since',new Date(this.state.identity.memberSince||Date.now()).toLocaleDateString()],['Broker',this.state.connection.broker||'Not connected'],['Trading account',this.state.connection.account?.name||this.state.connection.account?.number||'Not connected'],['Cloud settings',this.state.cloudSyncStatus||'Local cache'],['Indicators',String(this.state.indicators?.length||0)]])pg.append(el('span',{},a),el('span',{},b));card.append(pg);body.append(card);
    const actions=el('div',{class:'ta-login-actions'},el('button',{class:'secondary',onclick:()=>{navigator.clipboard?.writeText(this.state.identity.taId||'');toast('TA ID copied','success');}},'Copy TA ID'),el('button',{class:'secondary',onclick:()=>this.openIndicatorLicenses()},'Licences'));body.append(actions);
    const broker=el('div',{class:'ta-upgrade-section'},el('h4',{},'Trading account'),el('p',{class:'settings-note'},this.state.connection.status==='live'?'Your broker authorization is connected. Secure reconnect should use server-held tokens where the broker permits it.':'Connect a broker only after the Trade Avata account is signed in.'));broker.append(el('button',{class:'primary',onclick:()=>this.startBrokerConnect()},this.state.connection.status==='live'?'Manage cTrader connection':'Connect cTrader securely'));if(this.state.connection.status==='live')broker.append(el('button',{class:'danger',style:'margin-left:6px',onclick:()=>this.disconnectBroker()},'Disconnect'));body.append(broker);
    if(isOwner(this))body.append(el('div',{class:'ta-upgrade-section'},el('h4',{},'Owner workspace'),el('div',{class:'ta-login-actions'},el('button',{class:'secondary',onclick:()=>this.openOwnerResourceCenter()},'Advanced tools & quotas'),el('button',{class:'secondary',onclick:()=>this.openLicenseAdmin()},'TA ID licensing'))));
    body.append(el('button',{class:'danger',style:'width:100%;margin-top:12px',onclick:async()=>{try{await window.TRADE_AVATA_AUTH_ADAPTER?.signOut?.();}catch{}this.state.connection.tradeAvataUser=null;updateIdentity(this);this.save();this.closeModal();this.renderTopbar();startGuestEnforcement(this);}},'Sign out'));
  };
  const oldTop=app.renderTopbar.bind(app);app.renderTopbar=function(){oldTop();const btn=document.querySelector('.account-btn');if(btn&&isAuthenticated(this)){btn.textContent='';btn.append(el('span',{class:`account-dot ${this.state.connection.status==='live'?'live':''}`}),document.createTextNode(` ${this.state.identity.taId||'Profile'} ▾`));btn.onclick=()=>this.openProfile();}}
  const oldBroker=app.startBrokerConnect?.bind(app);app.startBrokerConnect=function(){if(!isAuthenticated(this)){toast('Sign in to Trade Avata before connecting a trading account.','error');this.openLogin();return;}return oldBroker?.();};
}

function entitlementStatus(e){if(!e)return'none';if(e.status==='revoked')return'revoked';if(e.expiresAt&&Date.now()>new Date(e.expiresAt).getTime())return'expired';return e.status||'active';}
function patchLicensing(app){
  app.openIndicatorBrowser=function(anchor){
    this.closeMenu?.();const m=this.makeModal('Indicators','indicator-browser-modal');m.main.className='modal-main single';const body=el('div',{class:'indicator-browser'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';
    const head=el('div',{class:'indicator-browser-head'}),search=el('input',{class:'field indicator-search',placeholder:'Search indicators…'});head.append(search);body.append(head);const tabs=el('div',{class:'indicator-browser-tabs'}),list=el('div',{class:'indicator-browser-list'});body.append(tabs,list);
    const cats=['All','Favorites','Licensed',...new Set(BUILTIN_INDICATORS.map(x=>x.category))];let cat='All';
    const render=()=>{list.innerHTML='';const q=(search.value||'').trim().toLowerCase();
      if(cat==='Licensed'){
        const rows=(this.state.indicatorEntitlements||[]).filter(e=>!q||`${e.name||''} ${e.indicatorId||''} ${e.publisher||''}`.toLowerCase().includes(q));
        if(!rows.length){list.append(el('div',{class:'empty-state'},'No licensed indicators are attached to this TA ID yet.'));return;}
        for(const e of rows){const st=entitlementStatus(e),kind=e.builtinKind||e.kind,canAdd=st==='active'&&!!indicatorDefinition(kind);const main=el('button',{class:'indicator-main',disabled:!canAdd,onclick:()=>{if(canAdd){this.addBuiltInIndicator(kind);this.openIndicatorBrowser();}}},el('strong',{},`${st==='expired'||st==='revoked'?'🔒 ':''}${e.name||e.indicatorId||'Licensed indicator'}`),el('small',{},`${st.toUpperCase()}${e.expiresAt?` · ${new Date(e.expiresAt).toLocaleDateString()}`:''}${e.publisher?` · ${e.publisher}`:''}`));
          const info=el('button',{class:'indicator-star',title:'Licence details',onclick:()=>this.openIndicatorLicenses()},'ⓘ');list.append(el('div',{class:`indicator-browser-row ${st!=='active'?'ta-licensed-locked':''}`},main,info));
        }return;
      }
      const rows=BUILTIN_INDICATORS.filter(d=>(cat==='All'||(cat==='Favorites'&&this.state.indicatorFavorites.includes(d.kind))||d.category===cat)&&(!q||`${d.name} ${d.short} ${d.category}`.toLowerCase().includes(q)));for(const d of rows){const fav=this.state.indicatorFavorites.includes(d.kind);list.append(el('div',{class:'indicator-browser-row'},el('button',{class:'indicator-main',onclick:()=>{this.addBuiltInIndicator(d.kind);this.openIndicatorBrowser();}},el('strong',{},d.name),el('small',{},`${d.short} · ${d.category}`)),el('button',{class:`indicator-star ${fav?'on':''}`,title:'Favorite',onclick:()=>{this.toggleIndicatorFavorite(d.kind);render();}},fav?'★':'☆')));}if(!rows.length)list.append(el('div',{class:'empty-state'},'No indicators found.'));
    };
    cats.forEach(c=>tabs.append(el('button',{class:c===cat?'active':'',onclick:e=>{cat=c;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===e.currentTarget));render();}},c)));search.addEventListener('input',render);render();
  };
  app.openIndicatorLicenses=function(){const m=this.makeModal('Indicator licences','license-center-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';body.append(el('p',{class:'settings-note'},`TA ID ${this.state.identity.taId||'—'} is the public lookup identity. It is not a password, login credential or broker account number.`));const ents=this.state.indicatorEntitlements||[];if(!ents.length)body.append(el('div',{class:'empty-state'},'No licensed indicators are attached to this account yet.'));else{const g=el('div',{class:'ta-license-grid'});for(const e of ents){const st=entitlementStatus(e);g.append(el('div',{class:`ta-license-card ${st==='expired'?'expired':''}`},el('strong',{},`${st==='expired'?'🔒 ':''}${e.name||e.indicatorId}`),el('small',{},`${st.toUpperCase()} · ${e.expiresAt?`until ${new Date(e.expiresAt).toLocaleDateString()}`:'no expiry'}`),el('small',{},e.publisher?`Publisher: ${e.publisher}`:'Trade Avata licence')));}body.append(g);}};
  app.openLicenseAdmin=function(){if(!isOwner(this)){toast('Owner access required','error');return;}const m=this.makeModal('TA ID · Indicator Access','license-admin-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';let target=this.state.identity.taId||'',name='Gold Hunter',duration='7d';body.append(el('p',{class:'settings-note'},'Granting by TA ID is only the lookup step. Production entitlement enforcement must remain server-side using authenticated UID + indicator ID + status + expiry + device allowance.'));body.append(setting('TA ID',textControl(target,v=>target=v,'TA-12345678')),setting('Indicator',textControl(name,v=>name=v,'Indicator name')),setting('Duration',selectControl([['7d','7 days'],['30d','30 days'],['3m','3 months'],['6m','6 months'],['1y','1 year'],['lifetime','Lifetime'],['revoked','Until revoked']],duration,v=>duration=v)));
    body.append(el('button',{class:'primary',onclick:()=>{if(!/^TA-[A-Z0-9-]{4,}$/i.test(target)){toast('Enter a valid TA ID','error');return;}const ms={['7d']:7, '30d':30,'3m':90,'6m':180,'1y':365}[duration];const grant={id:uid('grant'),taId:target.toUpperCase(),indicatorId:`pub-${hash32(name)}`,name,status:'active',createdAt:new Date().toISOString(),expiresAt:ms?new Date(Date.now()+ms*86400000).toISOString():null,publisher:'Trade Avata Owner',deviceAllowance:2};this.state.licenseGrants.push(grant);if(target.toUpperCase()===String(this.state.identity.taId||'').toUpperCase())this.state.indicatorEntitlements.push(deepClone(grant));this.save();toast('Access grant saved. Connect the production entitlement backend to enforce across accounts.','success');this.openLicenseAdmin();}},'Grant access'));
    const list=el('div',{class:'ta-upgrade-section'},el('h4',{},`Grants · ${this.state.licenseGrants.length}`));for(const g of this.state.licenseGrants.slice().reverse().slice(0,50))list.append(el('div',{class:'ta-license-card'},el('strong',{},`${g.name} → ${g.taId}`),el('small',{},g.expiresAt?`Expires ${new Date(g.expiresAt).toLocaleString()}`:'Until revoked'),el('button',{class:'danger',style:'margin-top:6px',onclick:()=>{g.status='revoked';g.expiresAt=new Date().toISOString();this.save();this.openLicenseAdmin();}},'Revoke')));body.append(list);
  };
}

const PLAN_FEATURES={
  FREE:new Set(['chart','drawings','indicators','watchlist','layouts','replay','market-intelligence','basic-voice','basic-analytics']),
  PRO:new Set(['chart','drawings','indicators','watchlist','layouts','replay','market-intelligence','basic-voice','basic-analytics','projects','strategy-vault','journal-coach','analytics-ai','chart-ai']),
  ADVANCED:new Set(['chart','drawings','indicators','watchlist','layouts','replay','market-intelligence','basic-voice','basic-analytics','projects','strategy-vault','journal-coach','analytics-ai','chart-ai','advanced-voice','deep-research','custom-agents','large-file-analysis'])
};

function patchAccessControl(app){
  app.canUseFeature=function(feature){if(isOwner(this))return true;const p=plan(this);return (PLAN_FEATURES[p]||PLAN_FEATURES.FREE).has(String(feature));};
  app.guardProviderQuota=function(provider,amount=1){if(!isOwner(this)){toast('Owner access required','error');return false;}const q=this.state.providerQuotas?.[provider];if(!q?.configured){toast(`${provider} is not connected to a verified recurring-free provider.`,'error');return false;}const now=Date.now(),resetAt=q.resetAt?new Date(q.resetAt).getTime():0;if(resetAt&&now>=resetAt){q.used=0;if(Number(q.resetDays)>0)q.resetAt=new Date(now+Number(q.resetDays)*86400000).toISOString();}
    const next=Number(q.used||0)+Number(amount||0);if(q.autoStop!==false&&Number.isFinite(Number(q.limit))&&next>Number(q.limit)){toast(`${provider} free allowance is exhausted. Trade Avata stopped before paid usage.`,'error');return false;}q.used=next;this.save();return true;};
  app.subscriptionPlans=PLAN_FEATURES;
}

function patchOwnerCenter(app){
  app.openOwnerResourceCenter=function(){if(!isOwner(this)){toast('Owner access required','error');return;}const m=this.makeModal('Owner · Advanced Trading Lab','owner-resource-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';body.append(el('div',{class:'side-card'},el('h4',{},'Owner access'),el('p',{},'OWNER receives all advanced systems for personal trading/testing. Public FREE users keep the current free platform. PRO and ADVANCED remain hidden until monetization is switched on.')));
    const q=this.state.providerQuotas||{};
    body.append(el('h4',{},'Recurring free allowances'));if(!Object.keys(q).length)body.append(el('div',{class:'empty-state'},'No recurring-free advanced provider is connected yet. Trade Avata will not invent a free quota or consume one-time credits.'));for(const [name,x] of Object.entries(q)){const pct=x.limit?clamp((x.used/x.limit)*100,0,100):0;body.append(el('div',{class:'ta-quota'},el('span',{},name),el('div',{class:'ta-quota-bar'},el('i',{style:`width:${pct}%`})),el('small',{},`${x.used}/${x.limit} ${x.unit||''} · ${x.reset||'Reset'}`)));}
    const flags=el('div',{class:'ta-upgrade-section'},el('h4',{},'Advanced feature switches'));for(const [k,label] of Object.entries({advancedVoice:'Natural AI voice',deepResearch:'Deep research',chartAI:'Chart AI',journalAI:'Journal Coach',analyticsAI:'Analytics AI',customAgents:'Avata Agents'}))flags.append(setting(label,toggleControl(!!this.state.featureFlags[k],v=>{this.state.featureFlags[k]=v;this.save();})));body.append(flags,el('p',{class:'settings-note'},'Trade Avata should auto-stop or fall back when a recurring free allowance is exhausted. It should never silently cross into paid provider usage without owner approval.'));
  };
}

function patchOrderTicket(app){
  app.openDom=function(pane=this.activePane()){
    if(!pane)return;const m=this.makeModal(`${pane.symbol} · Depth of Market`,'dom-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';
    const depth=this.state.marketDepth?.[pane.symbol];
    body.append(el('div',{class:'ta-order-mode-tabs'},el('button',{onclick:()=>{this.closeModal();this.openOrderTicket({pane});}},'Order'),el('button',{class:'active'},'DOM')));
    if(!depth?.bids?.length&&!depth?.asks?.length){body.append(el('div',{class:'empty-state'},'Depth-of-Market data is not supplied by the current feed. Trade Avata will activate this panel automatically for connected brokers/data providers that expose Level II / DOM data.'));return;}
    const table=el('table',{class:'data-table compact-table'});table.innerHTML='<thead><tr><th>Bid size</th><th>Price</th><th>Ask size</th></tr></thead>';const tb=el('tbody');const n=Math.max(depth.bids?.length||0,depth.asks?.length||0);for(let i=0;i<n;i++){const b=depth.bids?.[i],a=depth.asks?.[i],tr=el('tr');tr.append(el('td',{class:'pos'},b?.size??'—'),el('td',{},formatPrice(pane.symbol,b?.price??a?.price??0)),el('td',{class:'neg'},a?.size??'—'));tb.append(tr);}table.append(tb);body.append(table);
  };
  app.startPrepareTrade=function(side='Buy'){
    const pane=this.activePane();if(!pane)return;const last=pane.displayBars?.at(-1);if(!last)return;const cfg=SYMBOLS[pane.symbol]||SYMBOLS.XAUUSD,dist=Math.max(cfg.pipSize*20,last.close*.002),logical=Math.max(0,pane.displayBars.length-1),time=last.time,targetPrice=side==='Buy'?last.close+dist:last.close-dist,stopPrice=side==='Buy'?last.close-dist:last.close+dist;const layer=pane.drawingLayer;if(!layer){toast('Drawing layer unavailable','error');return;}const d=layer.makeDrawing(side==='Buy'?'long':'short',[{time,logical,price:last.close},{time,logical:logical+10,price:targetPrice},{time,logical:logical+10,price:stopPrice}]);d.name=`Prepared ${side}`;d.preparedTrade=true;d.riskPercent=this.state.riskPercent||1;this.pushDrawingHistory?.('prepare trade');this.state.drawings.push(d);this.state.selectedDrawingId=d.id;this.state.selectedDrawingIds=[d.id];this.setTool('cursor',{preserveSelection:true});this.syncDrawingLayers();this.save();pane.root.querySelector('.ta-prepare-chip')?.remove();const chip=el('button',{class:'ta-prepare-chip',onclick:()=>this.openPreparedOrder(d.id)},`${side} setup · Edit / Execute`);pane.root.append(chip);toast('Prepared trade added. Drag Entry, Target and Stop before execution.','success');
  };
  app.openPreparedOrder=function(id){const d=this.state.drawings.find(x=>x.id===id);if(!d||!['long','short'].includes(d.type))return;const [entry,target,stop]=d.points;this.openOrderTicket({side:d.type==='long'?'Buy':'Sell',pane:this.activePane(),price:entry.price,prepared:{id,entry:entry.price,tp:target.price,sl:stop.price}});};
  app.openOrderTicket=function({side='Buy',pane=this.activePane(),price=null,prepared=null}={}){
    if(!pane)return;const last=pane.displayBars?.at(-1)?.close||0,isReplay=this.state.replay.active,isLive=this.state.connection.status==='live';const inferred=prepared?'Limit':price==null?'Market':side==='Buy'?(price<last?'Limit':'Stop'):(price>last?'Limit':'Stop');const model={side,type:inferred,price:prepared?.entry??price??last,stopPrice:price??last,limitPrice:price??last,size:Number(this.state.fixedLots||.1),riskPercent:Number(this.state.riskPercent||1),sl:prepared?.sl??null,tp:prepared?.tp??null,useSL:prepared?.sl!=null,useTP:prepared?.tp!=null,timeInForce:'GTC'};
    const m=this.makeModal(`${isReplay?'Replay ':isLive?'':'Demo '}${pane.symbol} · Order`,'order-ticket-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.style.display='none';m.cancel.textContent='Close';
    body.append(el('div',{class:'ta-order-mode-tabs'},el('button',{class:'active'},'Order'),el('button',{onclick:()=>{this.closeModal();this.openDom(pane);}},'DOM')));
    const sideBox=el('div',{class:'ta-order-side'}),sell=el('button',{class:`secondary sell ${model.side==='Sell'?'active':''}`},`SELL\n${formatPrice(pane.symbol,last)}`),buy=el('button',{class:`secondary buy ${model.side==='Buy'?'active':''}`},`BUY\n${formatPrice(pane.symbol,last)}`);sideBox.append(sell,buy);body.append(sideBox);const tabs=el('div',{class:'ta-order-tabs'}),types=['Market','Limit','Stop','Stop Limit'];for(const t of types)tabs.append(el('button',{class:model.type===t?'active':'',onclick:()=>{model.type=t;render();}},t));body.append(tabs);const host=el('div');body.append(host);
    const render=()=>{tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.textContent===model.type));sell.classList.toggle('active',model.side==='Sell');buy.classList.toggle('active',model.side==='Buy');host.innerHTML='';const grid=el('div',{class:'ta-order-grid'});const fld=(label,ctrl)=>grid.append(el('label',{class:'ta-order-field'},el('span',{},label),ctrl));if(model.type==='Limit'||model.type==='Stop')fld(model.type==='Limit'?'Limit price':'Stop price',numberControl(model.price,v=>{model.price=+v||last;updateSummary();}));if(model.type==='Stop Limit'){fld('Stop price',numberControl(model.stopPrice,v=>{model.stopPrice=+v||last;updateSummary();}));fld('Limit price',numberControl(model.limitPrice,v=>{model.limitPrice=+v||last;updateSummary();}));}fld('Units / lots',numberControl(model.size,v=>{model.size=Math.max(.01,+v||.01);updateSummary();},{min:.01,step:.01}));fld('Risk %',numberControl(model.riskPercent,v=>{model.riskPercent=Math.max(0,+v||0);updateSummary();},{min:0,step:.1}));fld('Time in force',selectControl([['GTC','GTC'],['DAY','Day'],['IOC','IOC']],model.timeInForce,v=>model.timeInForce=v));host.append(grid);
      const exits=el('div',{class:'ta-order-exits'});const slToggle=toggleControl(model.useSL,v=>{model.useSL=v;render();}),tpToggle=toggleControl(model.useTP,v=>{model.useTP=v;render();});exits.append(setting('Stop loss',slToggle));if(model.useSL)exits.append(setting('SL price',numberControl(model.sl??suggestExit(model,'sl',last),v=>{model.sl=+v||null;updateSummary();})));exits.append(setting('Take profit',tpToggle));if(model.useTP)exits.append(setting('TP price',numberControl(model.tp??suggestExit(model,'tp',last),v=>{model.tp=+v||null;updateSummary();})));host.append(exits);
      const summary=el('div',{class:'ta-order-summary'}),risk=el('b'),reward=el('b'),rr=el('b');summary.append(el('div',{},el('small',{},'Risk'),risk),el('div',{},el('small',{},'Reward'),reward),el('div',{},el('small',{},'R:R'),rr));host.append(summary);const status=el('div',{class:'settings-note'},isReplay?'REPLAY / SIMULATION':isLive?'LIVE broker gateway':'DEMO — no broker order is sent');host.append(status);const submit=el('button',{class:`primary ta-order-submit ${model.side==='Sell'?'sell':''}`},isLive?(this.state.oneClickTrading?'Send live order':'Review & send'):'Place simulated order');host.append(submit);
      function entryPrice(){return model.type==='Market'?last:model.type==='Stop Limit'?model.limitPrice:model.price;}function updateSummary(){const e=entryPrice(),sl=model.useSL?Number(model.sl):NaN,tp=model.useTP?Number(model.tp):NaN,r=Number.isFinite(sl)?Math.abs(e-sl):0,w=Number.isFinite(tp)?Math.abs(tp-e):0,account=Number(app.state.accountSize||10000),cash=account*Number(model.riskPercent||0)/100;risk.textContent=r?`${formatPrice(pane.symbol,r)} · $${cash.toFixed(2)}`:'—';reward.textContent=w&&r?`${formatPrice(pane.symbol,w)} · $${(cash*w/r).toFixed(2)}`:'—';rr.textContent=r&&w?(w/r).toFixed(2):'—';}updateSummary();
      submit.onclick=async()=>{const request={symbol:pane.symbol,side:model.side,type:model.type,size:model.size,price:model.type==='Market'?null:(model.type==='Stop Limit'?model.limitPrice:model.price),stopPrice:model.type==='Stop Limit'?model.stopPrice:null,sl:model.useSL?Number(model.sl):null,tp:model.useTP?Number(model.tp):null,riskPercent:model.riskPercent,timeInForce:model.timeInForce,source:isReplay?'replay':isLive?'live':'demo',clientTime:new Date().toISOString()};if(isLive&&!this.state.oneClickTrading&&!confirm(`Send ${request.side} ${request.type} order for ${request.symbol}?`))return;if(isLive){const ok=await this.sendBrokerCommand('orders',request);if(!ok)return;toast('Order accepted by broker gateway','success');}else{this.orders.unshift({id:`O-${Date.now()}`,status:isReplay?'REPLAY':'DEMO',...request,price:request.price??last});toast(`${isReplay?'Replay':'Demo'} order added`,'success');}if(prepared?.id){const d=this.state.drawings.find(x=>x.id===prepared.id);if(d)d.executedAt=new Date().toISOString();}this.closeModal();this.openBottom('orders');};
    };
    sell.onclick=()=>{model.side='Sell';render();};buy.onclick=()=>{model.side='Buy';render();};render();
  };
}
function suggestExit(model,which,last){const d=Math.max(Math.abs(last)*.002,.0001),entry=model.type==='Market'?last:model.price||last;if(which==='sl')return model.side==='Buy'?entry-d:entry+d;return model.side==='Buy'?entry+d*2:entry-d*2;}

function startGuestEnforcement(app){
  clearInterval(app.__guestTimer);removeGuestGate();const cfg=app.state.guestAccess||{};if(isAuthenticated(app)||isOwner(app)||cfg.enabled!==true)return;let g;try{g=JSON.parse(localStorage.getItem(GUEST_KEY)||'null');}catch{}const now=Date.now(),resetMs=(Number(cfg.resetHours)||24)*3600000;if(!g||now-Number(g.windowStart||0)>=resetMs)g={windowStart:now,softShown:false,hardShown:false};localStorage.setItem(GUEST_KEY,JSON.stringify(g));
  const check=()=>{const c=app.state.guestAccess||{};if(isAuthenticated(app)||isOwner(app)||c.enabled!==true){removeGuestGate();clearInterval(app.__guestTimer);return;}let x;try{x=JSON.parse(localStorage.getItem(GUEST_KEY)||'{}');}catch{x=g;}const elapsed=(Date.now()-Number(x.windowStart||Date.now()))/60000,soft=Number(c.softMinutes)||10,hard=Number(c.hardMinutes)||40;if(c.hardLockEnabled===true&&elapsed>=hard){x.hardShown=true;localStorage.setItem(GUEST_KEY,JSON.stringify(x));showHardGuestGate(app);return;}if(c.softPromptEnabled!==false&&elapsed>=soft&&!x.softShown&&!app.modal){x.softShown=true;localStorage.setItem(GUEST_KEY,JSON.stringify(x));showSoftGuestPrompt(app);}};check();app.__guestTimer=setInterval(check,15000);
}
function showSoftGuestPrompt(app){const m=app.makeModal('Save your Trade Avata workspace','guest-soft-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.textContent='Sign in';m.cancel.textContent='Continue as guest';body.append(el('div',{class:'side-card'},el('h4',{},'Keep your charts'),el('p',{},'You can keep testing Trade Avata as a guest for now. Sign in to preserve drawings, layouts and account settings across devices. Guest work is not permanently cloud-saved.')));m.ok.onclick=()=>{app.closeModal();app.openLogin();};}
function showHardGuestGate(app){if(document.querySelector('.ta-guest-gate'))return;const gate=el('div',{class:'ta-guest-gate'},el('div',{class:'ta-guest-gate-card'},el('h2',{},'Sign in to continue'),el('p',{},'Your current guest session has reached its daily trial window. Sign in or create a Trade Avata account to continue using the chart. The guest window resets after 24 hours.'),el('button',{class:'primary',onclick:()=>app.openLogin()},'Sign in / Create account')));document.body.append(gate);}
function removeGuestGate(){document.querySelector('.ta-guest-gate')?.remove();}

function patchDrawingPalette(app){
  app.openQuickDrawingColor=function(){
    const d=this.state.drawings.find(x=>x.id===this.state.selectedDrawingId);if(!d)return;
    const m=this.makeModal('Drawing colour','drawing-colour-modal'),body=el('div',{class:'settings-body'});m.main.replaceChildren(body);m.ok.textContent='Close';m.cancel.style.display='none';
    const apply=c=>{this.pushDrawingHistory?.('drawing colour');d.style=d.style||{};d.style.color=c;this.refreshDrawingLayers?.();this.save();};
    body.append(el('p',{class:'settings-note'},'Choose from the same square professional palette used across Trade Avata. Changes preview immediately.'),colorSwatches(d.style?.color||'#7cc8ff',apply));
    const custom=textControl(d.style?.color||'#7cc8ff',v=>{if(/^#[0-9a-f]{6}$/i.test(v))apply(v);},'#168cff');body.append(setting('Custom HEX',custom));
  };
}

function patchGlobalPanelBehaviour(app){
  document.addEventListener('pointerdown',e=>{if(!app.menu)return;const menu=app.menu;if(menu.contains?.(e.target))return;if(e.target.closest?.('.tb-btn,.tf-btn,.toolbar-select,.left-tool,.rail-btn,.icon-btn'))return;app.closeMenu?.();},{capture:true});
  const resize=()=>requestAnimationFrame(()=>app.panes?.forEach(p=>p.resize?.()));window.addEventListener('resize',resize);window.visualViewport?.addEventListener?.('resize',resize);
  document.addEventListener('pointerdown',e=>{if(window.innerWidth>780)return;const head=e.target.closest?.('#right-panel .panel-head');if(!head)return;const panel=head.closest('#right-panel');if(!panel)return;const startY=e.clientY;let dy=0;const move=ev=>{dy=Math.max(0,ev.clientY-startY);panel.style.transform=`translateY(${dy}px)`;panel.style.transition='none';};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);panel.style.transition='';if(dy>90){app.state.rightSidebarOpen=false;app.renderRightPanel?.();}else panel.style.transform='';};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});},{capture:true});
}

function patchDemoHandling(app){
  const oldTop=app.renderTopbar.bind(app);app.renderTopbar=function(){if(this.state.connection?.status==='live'){this.positions=(this.positions||[]).filter(p=>p.status!=='DEMO'&&!String(p.id||'').startsWith('P-1001'));this.demoHistory=[];}oldTop();};
}

function patchTopbarExtras(app){
  const old=app.renderTopbar.bind(app);app.renderTopbar=function(){old();const scroll=document.querySelector('.topbar-scroll');if(!scroll)return;const layout=[...scroll.querySelectorAll('button')].find(b=>b.textContent.includes('Layout'));if(layout&&!scroll.querySelector('.ta-prepare-btn')){const b=el('button',{class:'tb-btn ta-prepare-btn',title:'Place draggable Entry / Stop / Target before execution',onclick:e=>this.openMenu(e.currentTarget,[{label:'Prepare Buy setup',action:()=>this.startPrepareTrade('Buy')},{label:'Prepare Sell setup',action:()=>this.startPrepareTrade('Sell')},{label:'Open Order Ticket',action:()=>this.openOrderTicket({side:'Buy'})}],220)},'⌁ Prepare');layout.before(b);}};
}

function addProfilePanelToRightRail(app){
  const old=app.renderRightRail.bind(app);app.renderRightRail=function(){old();const rail=document.querySelector('#right-rail');if(!rail||rail.querySelector('.ta-profile-rail'))return;const spacer=rail.querySelector('.rail-spacer');const b=el('button',{class:'rail-btn ta-profile-rail',onclick:()=>this.openProfile()},el('b',{},'◎'),isAuthenticated(this)?'Profile':'Sign in');spacer?.before(b);};
}

function patchChartRoundOptions(app){for(const p of app.panes||[]){try{p.chart?.applyOptions?.({majorRoundGrid:!!app.state.majorRoundGrid,roundNumbers:app.state.roundNumbers,roundGridColor:'rgba(126,157,185,.48)',roundNumberColor:app.state.textColor});}catch{}}}

function installUpgrade(app){
  if(app.__tradeAvataFinalUpgrade)return;app.__tradeAvataFinalUpgrade=true;migrateState(app);if(!isAuthenticated(app)){app.state.drawings=[];app.state.selectedDrawingId=null;app.state.selectedDrawingIds=[];}
  patchThemesAndSettings(app);patchWatchlistAndAnalysis(app);patchIndicatorUX(app);patchLayouts(app);patchLoginProfile(app);patchLicensing(app);patchAccessControl(app);patchOwnerCenter(app);patchOrderTicket(app);patchDrawingPalette(app);patchGlobalPanelBehaviour(app);patchDemoHandling(app);patchTopbarExtras(app);addProfilePanelToRightRail(app);
  applyPerformanceMode(app);app.applyPlatformTheme();patchChartRoundOptions(app);app.renderTopbar();app.renderRightRail();app.renderRightPanel();app.refreshAllCharts();startGuestEnforcement(app);
  window.__tradeAvataFinalUpgrade={build:BUILD,app,runSelfCheck:()=>runSelfCheck(app)};console.info(`[${BUILD}] installed`);
}

function runSelfCheck(app){const checks={baselineApp:!!app,protectedLayout:['1','2h','2v','3a','3b','4','6','8'].includes(app.state.layout),glassStyle:!!app.state.uiStyle,roundNumbers:!!app.state.roundNumbers?.enabled,taIdentity:'taId'in(app.state.identity||{}),guestPolicy:Number(app.state.guestAccess?.softMinutes)===10&&Number(app.state.guestAccess?.hardMinutes)===40,themeCount:Object.keys(THEMES).length>=10,orderStopLimit:String(app.openOrderTicket).includes('Stop Limit'),indicatorManager:typeof app.openIndicatorManager==='function',profile:typeof app.openProfile==='function',prepareTrade:typeof app.startPrepareTrade==='function',watchFavorites:Array.isArray(app.state.favoriteSymbols)};return{ok:Object.values(checks).every(Boolean),checks};}

async function boot(){for(let i=0;i<200;i++){const app=window.__tradeAvataMasterRecovery?.app||window.__tradeAvata;if(app&&window.__tradeAvataMasterRecovery){installUpgrade(app);return;}await new Promise(r=>setTimeout(r,25));}console.error(`[${BUILD}] app bootstrap timed out`);}
boot();
