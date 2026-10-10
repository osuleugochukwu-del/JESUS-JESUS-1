import { el, toast, clamp } from './utils.js';
import { ChartPane } from './chart-pane.js';

const BUILD='Trade Avata V11.1 Correction';
const GUEST_KEY='tradeAvataGuestWindowV11';
const LAB_KEY='tradeAvataOwnerLabV111';
const SETTINGS_FIELDS=[
  'platformTheme','theme','themeSyncChart','background','textColor','gridColor','crosshairColor',
  'candleStyle','upColor','downColor','wickUp','wickDown','gridH','gridV','majorRoundGrid',
  'roundNumbers','chartSettings','uiStyle','performanceMode','priceScaleMode','showBidLine','showAskLine',
  'showLastPriceLine','showCountdown','marketLineStyles','timezone','showSessionSeparators'
];

function clone(v){try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}}
function currentUser(app){return app.state.connection?.tradeAvataUser||null;}
function authenticated(app){return !!currentUser(app);}
function owner(app){return String(currentUser(app)?.role||'').toLowerCase()==='owner'||(['localhost','127.0.0.1',''].includes(location.hostname)&&app.state.ownerMode===true);}
function makeTaId(seed=''){let h=2166136261>>>0;for(const ch of String(seed||Date.now())){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `TA-${String(h>>>0).padStart(8,'0').slice(-8)}`;}
function copySettings(app){const out={};for(const k of SETTINGS_FIELDS)out[k]=clone(app.state[k]);return out;}
function restoreSettings(app,snap){for(const [k,v] of Object.entries(snap||{}))app.state[k]=clone(v);app.applyPlatformTheme?.();app.refreshAllCharts?.();app.renderTopbar?.();}
function candleChanged(a,b){return JSON.stringify(a?.candleStyle)!==JSON.stringify(b?.candleStyle);}
function syncLegacyCandleFields(s){const c=s.candleStyle||{};s.upColor=c.upBody||s.upColor;s.downColor=c.downBody||s.downColor;s.wickUp=c.upWick||s.wickUp;s.wickDown=c.downWick||s.wickDown;}
function correctionState(app){
  const s=app.state;
  s.guestAccess={enabled:false,softPromptEnabled:true,hardLockEnabled:false,softMinutes:10,hardMinutes:40,resetHours:24,previewBehindGate:true,allowViewingWhenLocked:true,...(s.guestAccess||{})};
  // V11.1 intentionally ships with forced guest lock disabled. Admin/Owner turns it on when ready.
  if(s.guestAccess.v111DefaultApplied!==true){s.guestAccess.enabled=false;s.guestAccess.hardLockEnabled=false;s.guestAccess.v111DefaultApplied=true;}
  s.chartSettings=s.chartSettings||{};
  if(!Number.isFinite(Number(s.chartSettings.candleViewScale)))s.chartSettings.candleViewScale=1;
  s.chartSettings.candleViewScale=clamp(Number(s.chartSettings.candleViewScale),.5,3);
  s.candleUserOverride=!!s.candleUserOverride;
  s.ownerLab=s.ownerLab||{strategies:[],agents:[],journalNotes:[],researchHistory:[]};
  s.ownerLab.strategies=Array.isArray(s.ownerLab.strategies)?s.ownerLab.strategies:[];
  s.ownerLab.agents=Array.isArray(s.ownerLab.agents)?s.ownerLab.agents:[];
  s.ownerLab.journalNotes=Array.isArray(s.ownerLab.journalNotes)?s.ownerLab.journalNotes:[];
  s.ownerLab.researchHistory=Array.isArray(s.ownerLab.researchHistory)?s.ownerLab.researchHistory:[];
  s.identity=s.identity||{};
  if(authenticated(app)&&!s.identity.taId)s.identity.taId=currentUser(app).taId||makeTaId(currentUser(app).uid||currentUser(app).email);
  document.documentElement.dataset.taCorrection='v11-1';
}

function patchCandleThemePriority(app){
  const oldApply=app.applyPlatformTheme?.bind(app);
  if(oldApply&&!app.__v111ThemeApply){
    app.__v111ThemeApply=oldApply;
    app.applyPlatformTheme=function(){
      const keep=this.state.candleUserOverride?clone(this.state.candleStyle):null;
      const legacy=this.state.candleUserOverride?{upColor:this.state.upColor,downColor:this.state.downColor,wickUp:this.state.wickUp,wickDown:this.state.wickDown}:null;
      const r=oldApply();
      if(keep){this.state.candleStyle=keep;Object.assign(this.state,legacy);}
      return r;
    };
  }
  const oldSet=app.setTradeAvataTheme?.bind(app);
  if(oldSet&&!app.__v111SetTheme){
    app.__v111SetTheme=oldSet;
    app.setTradeAvataTheme=function(id){
      const keep=this.state.candleUserOverride?clone(this.state.candleStyle):null;
      const legacy=this.state.candleUserOverride?{upColor:this.state.upColor,downColor:this.state.downColor,wickUp:this.state.wickUp,wickDown:this.state.wickDown}:null;
      const r=oldSet(id);
      if(keep){this.state.candleStyle=keep;Object.assign(this.state,legacy);this.refreshAllCharts?.();this.save?.();}
      return r;
    };
  }
}

function patchCandleViewScale(app){
  if(!ChartPane.prototype.__v111HomeTarget){
    ChartPane.prototype.__v111HomeTarget=ChartPane.prototype.homeBarTarget;
    ChartPane.prototype.homeBarTarget=function(){
      const base=this.__v111HomeTarget();
      const scale=clamp(Number(this.app?.state?.chartSettings?.candleViewScale||1),.5,3);
      return Math.max(24,Math.round(base*scale));
    };
  }
  app.setCandleViewScale=function(next,{save=true}={}){
    const old=clamp(Number(this.state.chartSettings?.candleViewScale||1),.5,3);
    const value=clamp(Number(next)||1,.5,3);
    if(Math.abs(value-old)<.001)return;
    this.state.chartSettings.candleViewScale=value;
    const ratio=value/old;
    for(const pane of this.panes||[]){
      try{
        const ts=pane.chart?.timeScale?.();
        const r=ts?.getVisibleLogicalRange?.();
        if(!r||!Number.isFinite(r.from)||!Number.isFinite(r.to))continue;
        const span=Math.max(12,r.to-r.from),newSpan=span*ratio;
        // Keep the right edge visually anchored so "farther" reveals more candles to the left.
        ts.setVisibleLogicalRange({from:r.to-newSpan,to:r.to});
      }catch{}
    }
    if(save)this.save?.();
  };
  app.resetCandleViewScale=function(){this.setCandleViewScale(1);toast('Candle view returned to 100%','success');};

  const oldFill=app.fillSettings.bind(app);
  app.fillSettings=function(tab,nav,body){
    oldFill(tab,nav,body);
    if(tab!=='scales'||body.querySelector('.ta-candle-view-control'))return;
    const section=el('div',{class:'ta-upgrade-section ta-candle-view-control'},el('h4',{},'Candle View Scale'));
    section.append(el('p',{class:'settings-note'},'Moves the chart candles visually farther back or closer without changing the Trade Avata interface. Home/Reset keeps this preference.'));
    const row=el('div',{class:'ta-depth-row'}),near=el('span',{},'Closer'),far=el('span',{},'Farther'),input=el('input',{type:'range',min:'0.5',max:'3',step:'0.05',value:String(this.state.chartSettings.candleViewScale||1)}),out=el('output',{},`${Math.round(Number(input.value)*100)}%`);
    input.addEventListener('input',()=>{out.textContent=`${Math.round(Number(input.value)*100)}%`;this.setCandleViewScale(Number(input.value),{save:false});});
    input.addEventListener('change',()=>this.save?.());
    row.append(near,input,far,out);section.append(row);
    const presets=el('div',{class:'ta-depth-presets'});
    for(const [label,v] of [['Closer',.75],['Normal',1],['Farther',1.5],['Wide',2],['Very Wide',2.5]])presets.append(el('button',{class:'secondary',onclick:()=>{input.value=String(v);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}},label));
    presets.append(el('button',{class:'secondary',onclick:()=>{this.resetCandleViewScale();input.value='1';out.textContent='100%';}},'Reset Candle View'));
    section.append(presets);body.append(section);
  };
}

function patchSettingsTransactions(app){
  const oldOpen=app.openSettings.bind(app);
  app.openSettings=function(tab='symbol'){
    const snap=copySettings(this);
    oldOpen(tab);
    const back=this.modal,modal=back?.querySelector?.('.settings-modal');if(!modal)return;
    let committed=false;
    const ok=modal.querySelector('.modal-foot .primary'),cancel=modal.querySelector('.modal-foot .secondary'),x=modal.querySelector('.modal-x');
    const oldOk=ok?.onclick;
    const livePreview=()=>{this.refreshAllCharts?.();this.updateQuickTrade?.();};
    modal.addEventListener('input',e=>{if(e.target.matches('input,select'))livePreview();});
    modal.addEventListener('change',e=>{if(e.target.matches('input,select'))livePreview();});
    modal.addEventListener('click',e=>{if(e.target.closest('.candle-preset')){this.state.candleUserOverride=true;syncLegacyCandleFields(this.state);livePreview();}});
    const rollback=()=>{if(committed)return;restoreSettings(this,snap);this.closeModal();};
    if(cancel)cancel.onclick=rollback;if(x)x.onclick=rollback;
    if(back)back.addEventListener('pointerdown',e=>{if(e.target===back){e.stopImmediatePropagation();rollback();}},{capture:true});
    if(ok)ok.onclick=()=>{
      if(candleChanged(snap,this.state)){this.state.candleUserOverride=true;syncLegacyCandleFields(this.state);}
      committed=true;
      oldOk?.();
      this.refreshAllCharts?.();this.save?.();
    };
  };
}

function patchMobileMenus(app){
  app.createMenu=function(anchor,width=190,extra=''){
    this.closeMenu?.();
    const mobile=window.innerWidth<=780;
    const m=el('div',{class:`floating-menu ta-premium-menu ${mobile?'ta-mobile-menu-sheet':''} ${extra}`});
    m.style.minWidth=`${Math.min(width,mobile?window.innerWidth-20:width)}px`;
    document.body.append(m);
    if(!mobile){
      requestAnimationFrame(()=>{
        const vv=window.visualViewport,r=anchor.getBoundingClientRect(),mr=m.getBoundingClientRect();
        const vw=vv?.width||window.innerWidth,vh=vv?.height||window.innerHeight,ox=vv?.offsetLeft||0,oy=vv?.offsetTop||0;
        let left=Math.min(ox+vw-mr.width-10,Math.max(ox+8,r.left));
        let top=r.bottom+6;
        if(top+mr.height>oy+vh-8)top=Math.max(oy+8,r.top-mr.height-6);
        m.style.left=`${left}px`;m.style.top=`${top}px`;
      });
    }
    this.menu=m;
    this.outsideMenuHandler=e=>{const inAnchor=typeof anchor?.contains==='function'&&anchor.contains(e.target);if(this.menu&&!this.menu.contains(e.target)&&!inAnchor)this.closeMenu?.();};
    setTimeout(()=>document.addEventListener('pointerdown',this.outsideMenuHandler,true),0);
    return m;
  };
}

function adapterMethod(adapter,names){for(const n of names)if(typeof adapter?.[n]==='function')return adapter[n].bind(adapter);return null;}
async function restoreCloudSettings(app){const a=window.TRADE_AVATA_CLOUD_SETTINGS;if(typeof a?.load!=='function')return;try{const remote=await a.load();const prefs=remote?.preferences;if(prefs&&typeof prefs==='object'){for(const [k,v] of Object.entries(prefs))app.state[k]=clone(v);correctionState(app);app.applyPlatformTheme?.();app.applyLayout?.(app.state.layout||'1',false);app.renderRightPanel?.();app.renderBottom?.();app.state.cloudSyncStatus='synced';}}catch{app.state.cloudSyncStatus='offline-cache';}}
async function finishAuth(app,u,msg){if(!u)throw new Error('No user returned by authentication provider.');u.taId=u.taId||app.state.identity?.taId||makeTaId(u.uid||u.email);app.state.connection.tradeAvataUser=u;app.state.identity=app.state.identity||{};app.state.identity.taId=u.taId;app.state.identity.role=String(u.role||'free').toLowerCase();app.state.identity.plan=String(u.plan||(u.role==='owner'?'OWNER':'FREE')).toUpperCase();app.state.identity.memberSince=app.state.identity.memberSince||new Date().toISOString();await restoreCloudSettings(app);app.save?.();app.closeModal?.();document.querySelector('.ta-guest-gate')?.remove();clearInterval(app.__guestTimer);app.renderTopbar?.();app.renderRightPanel?.();app.renderRightRail?.();toast(msg,'success');}

function patchModernAuth(app){
  app.openProfile=function(){this.openLogin('profile');};
  app.openLogin=function(mode='login'){
    this.closeMenu?.();
    const user=currentUser(this);
    if(user){return openProfileCard(this);}
    const m=this.makeModal(mode==='signup'?'Create Trade Avata account':'Welcome to Trade Avata','login-modal ta-auth-modal');
    m.ok.style.display='none';m.cancel.textContent='Close';const body=el('div',{class:'ta-auth-shell'});m.main.replaceChildren(body);
    let active=mode==='signup'?'signup':'login';
    const render=()=>{
      body.innerHTML='';
      body.append(el('div',{class:'ta-auth-brand'},el('img',{src:this.state.brand?.logoDataUrl||'./public/brand/trade-avata-logo.svg',alt:'Trade Avata'}),el('div',{},el('strong',{},active==='signup'?'Create your account':'Welcome back'),el('small',{},active==='signup'?'One Trade Avata identity across the ecosystem':'Sign in to continue your trading workspace'))));
      const tabs=el('div',{class:'ta-auth-tabs'},el('button',{class:active==='login'?'active':'',onclick:()=>{active='login';render();}},'Login'),el('button',{class:active==='signup'?'active':'',onclick:()=>{active='signup';render();}},'Sign up'));body.append(tabs);
      const form=el('div',{class:'ta-auth-form'}),email=el('input',{class:'field',type:'email',placeholder:'Email address',autocomplete:'email'}),passWrap=passwordField(active==='signup'?'Create password':'Password',active==='signup'?'new-password':'current-password'),confirmWrap=active==='signup'?passwordField('Confirm password','new-password'):null;
      form.append(email,passWrap.wrap);if(confirmWrap)form.append(confirmWrap.wrap);
      if(active==='login')form.append(el('button',{class:'ta-text-btn',onclick:async()=>{const em=email.value.trim();if(!em){toast('Enter your email first','error');return;}const a=window.TRADE_AVATA_AUTH_ADAPTER,fn=adapterMethod(a,['resetPassword','sendPasswordResetEmail','forgotPassword']);if(!fn){toast('Password reset is not connected to the production authentication adapter yet.','error');return;}try{if(fn.length>1)await fn(em);else await fn({email:em});toast('Password reset instructions sent','success');}catch(e){toast(e?.message||'Could not send reset email','error');}}},'Forgot password?'));
      const primary=el('button',{class:'primary ta-auth-primary'},active==='signup'?'Create account':'Login');form.append(primary);body.append(form);
      const divider=el('div',{class:'ta-auth-divider'},el('span',{},'or'));body.append(divider);
      const google=el('button',{class:'ta-social-btn ta-google-btn'},el('span',{class:'ta-google-mark'},'G'),active==='signup'?'Sign up with Google':'Continue with Google');body.append(google);
      body.append(el('p',{class:'ta-auth-switch'},active==='signup'?'Already have an account? ':'Don’t have an account? ',el('button',{class:'ta-text-btn',onclick:()=>{active=active==='signup'?'login':'signup';render();}},active==='signup'?'Login':'Sign up')));
      primary.onclick=async()=>{const em=email.value.trim(),pw=passWrap.input.value;if(!em||!pw){toast('Enter email and password','error');return;}if(active==='signup'&&pw!==confirmWrap.input.value){toast('Passwords do not match','error');return;}const a=window.TRADE_AVATA_AUTH_ADAPTER,fn=adapterMethod(a,active==='signup'?['createAccount','signUp']:['signIn','login']);try{let u;if(fn)u=await fn({email:em,password:pw});else if(['localhost','127.0.0.1',''].includes(location.hostname))u={email:em,uid:`preview-${Date.now()}`,role:this.state.ownerMode?'owner':'free',preview:true};else throw new Error('Trade Avata authentication is not connected to this deployment yet.');await finishAuth(this,u,active==='signup'?'Trade Avata account created':'Signed in');}catch(e){toast(e?.message||'Authentication failed','error');}};
      google.onclick=async()=>{const a=window.TRADE_AVATA_AUTH_ADAPTER,fn=adapterMethod(a,['signInWithGoogle','googleSignIn','signInGoogle','continueWithGoogle']);if(!fn){toast('Google sign-in is ready in the interface but the production Google/Firebase auth adapter is not connected yet.','error');return;}try{const u=await fn();await finishAuth(this,u,'Signed in with Google');}catch(e){toast(e?.message||'Google sign-in failed','error');}};
    };
    render();
  };
}

function passwordField(placeholder,autocomplete){const wrap=el('label',{class:'ta-password-field'}),input=el('input',{class:'field',type:'password',placeholder,autocomplete}),eye=el('button',{type:'button',title:'Show password',onclick:()=>{input.type=input.type==='password'?'text':'password';eye.textContent=input.type==='password'?'◉':'◎';}},'◉');wrap.append(input,eye);return{wrap,input};}

function openProfileCard(app){
  const u=currentUser(app);const m=app.makeModal('Trade Avata Profile','login-modal ta-profile-modal');m.ok.style.display='none';m.cancel.textContent='Close';const body=el('div',{class:'ta-profile-shell'});m.main.replaceChildren(body);
  const ta=app.state.identity?.taId||u.taId||makeTaId(u.uid||u.email);app.state.identity.taId=ta;
  body.append(el('div',{class:'ta-profile-hero'},el('div',{class:'ta-profile-avatar'},String(u.displayName||u.email||'T').trim().charAt(0).toUpperCase()),el('div',{},el('strong',{},u.displayName||u.email||'Trade Avata user'),el('span',{class:'ta-profile-id'},ta),el('small',{},`${owner(app)?'OWNER':String(u.role||'FREE').toUpperCase()} · ${String(u.plan||(owner(app)?'OWNER':'FREE')).toUpperCase()}`))));
  const grid=el('div',{class:'ta-profile-grid-v111'});for(const [a,b] of [['Email',u.email||'—'],['Member since',new Date(app.state.identity.memberSince||Date.now()).toLocaleDateString()],['Broker',app.state.connection?.broker||'Not connected'],['Trading account',app.state.connection?.account?.name||app.state.connection?.account?.number||'Not connected'],['Settings sync',app.state.cloudSyncStatus||'Local cache'],['Indicators',String(app.state.indicators?.length||0)]])grid.append(el('div',{},el('small',{},a),el('span',{},b)));body.append(grid);
  const actions=el('div',{class:'ta-profile-actions'},el('button',{class:'secondary',onclick:()=>{navigator.clipboard?.writeText?.(ta);toast('TA ID copied','success');}},'Copy TA ID'),el('button',{class:'secondary',onclick:()=>app.openIndicatorLicenses?.()},'Licences'),el('button',{class:'secondary',onclick:()=>app.startBrokerConnect?.()},app.state.connection?.status==='live'?'Broker settings':'Connect broker'));body.append(actions);
  if(owner(app)){body.append(el('div',{class:'ta-owner-entry'},el('div',{},el('strong',{},'Owner Trading Lab'),el('small',{},'Private advanced tools, TA ID control and platform administration')),el('button',{class:'primary',onclick:()=>app.openOwnerTradingLab()},'Open Lab')));}
  body.append(el('button',{class:'danger ta-signout',onclick:async()=>{try{await window.TRADE_AVATA_AUTH_ADAPTER?.signOut?.();}catch{}app.state.connection.tradeAvataUser=null;app.state.identity.role='guest';app.state.identity.plan='FREE';app.save?.();app.closeModal?.();app.renderTopbar?.();app.renderRightPanel?.();app.renderRightRail?.();app.startGuestPolicy?.();toast('Signed out');}},'Sign out'));
}

function patchOwnerLab(app){
  app.openOwnerTradingLab=function(){
    if(!owner(this)){toast('Owner access required','error');return;}
    const m=this.makeModal('Owner Trading Lab','owner-resource-modal ta-owner-lab');m.ok.style.display='none';m.cancel.textContent='Close';const body=el('div',{class:'ta-owner-lab-body'});m.main.replaceChildren(body);
    body.append(el('div',{class:'ta-owner-lab-head'},el('div',{},el('strong',{},'Private Owner Workspace'),el('small',{},'Advanced tools are only exposed to an authenticated OWNER account. Provider-backed tools clearly report when a provider is not connected.')),el('span',{class:'ta-role-badge owner'},'OWNER')));
    const tools=[
      ['Chart AI','Analyze the active chart context and indicators','◫',()=>this.openOwnerChartAI()],
      ['Journal Coach','Structured post-trade review and coaching notes','✎',()=>this.openJournalCoach()],
      ['Analytics AI','Deep statistics from the active chart and trading context','▥',()=>this.openAnalyticsAI()],
      ['Deep Research','Provider-backed research workspace with source adapter','⌕',()=>this.openDeepResearch()],
      ['Strategy Vault','Create, edit and preserve private strategy playbooks','◇',()=>this.openStrategyVault()],
      ['Projects','Saved multi-chart trading workspaces','▦',()=>{this.closeModal();this.openWorkspaceManager?.();}],
      ['Avata Agents','Create reusable private trading-agent instructions','◎',()=>this.openAvataAgents()],
      ['Advanced Voice','Voice provider and safe recurring-quota status','◖',()=>this.openAdvancedVoice()],
      ['File Analysis','Analyze text/CSV/JSON locally or pass files to a secure adapter','⇧',()=>this.openFileAnalysis()],
      ['Usage & Quotas','Recurring free provider allowances and auto-stop','◴',()=>this.openOwnerResourceCenter?.()],
      ['TA ID Licensing','Grant, extend and revoke indicator access','♙',()=>this.openLicenseAdmin?.()],
      ['Guest Access Admin','Turn guest reminders/lockout on only when you choose','⊘',()=>this.openGuestAccessAdmin()]
    ];
    const grid=el('div',{class:'ta-owner-tool-grid'});for(const [name,desc,icon,fn] of tools)grid.append(el('button',{class:'ta-owner-tool',onclick:fn},el('b',{},icon),el('span',{},el('strong',{},name),el('small',{},desc))));body.append(grid);
  };

  app.openOwnerChartAI=function(){const pane=this.activePane?.(),bars=pane?.displayBars||[],last=bars.at(-1),first=bars.at(-Math.min(100,bars.length))||bars[0],change=last&&first&&first.open?((last.close-first.open)/first.open*100):0;openToolModal(this,'Chart AI',el('div',{class:'ta-tool-report'},el('h3',{},`${pane?.symbol||'Chart'} · ${pane?.period?.value||''}`),el('p',{},`Visible-context move: ${Number(change).toFixed(2)}% · Bars loaded: ${bars.length} · Indicators: ${this.state.indicators?.length||0}`),el('p',{class:'settings-note'},'This local chart-context report works without a paid provider. Connect a secure Chart AI adapter to add model-generated analysis.')));};
  app.openAnalyticsAI=function(){const pane=this.activePane?.(),bars=pane?.displayBars||[],moves=[];for(let i=1;i<bars.length;i++)if(bars[i-1].close)moves.push(Math.abs((bars[i].close-bars[i-1].close)/bars[i-1].close*100));const avg=moves.length?moves.reduce((a,b)=>a+b,0)/moves.length:0;openToolModal(this,'Analytics AI',el('div',{class:'ta-tool-report'},el('h3',{},'Active chart statistics'),el('div',{class:'ta-mini-metrics'},metric('Bars',bars.length),metric('Avg move',`${avg.toFixed(3)}%`),metric('Indicators',this.state.indicators?.length||0),metric('Drawings',this.state.drawings?.length||0)),el('p',{class:'settings-note'},'Local statistics are active now. A secure analytics-AI adapter can extend this with model reasoning without exposing provider keys in the browser.')));};
  app.openJournalCoach=function(){const m=this.makeModal('Journal Coach','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const setup=el('textarea',{class:'field ta-big-text',placeholder:'What was your trade plan?'}),result=el('textarea',{class:'field ta-big-text',placeholder:'What happened?'}),lesson=el('textarea',{class:'field ta-big-text',placeholder:'What will you repeat or change next time?'});b.append(setup,result,lesson);b.append(el('button',{class:'primary',onclick:()=>{const entry={id:`jn-${Date.now()}`,createdAt:new Date().toISOString(),setup:setup.value,result:result.value,lesson:lesson.value};this.state.ownerLab.journalNotes.unshift(entry);this.save?.();toast('Journal coaching note saved','success');}},'Save coaching note'));if(this.state.ownerLab.journalNotes.length)b.append(el('p',{class:'settings-note'},`${this.state.ownerLab.journalNotes.length} private coaching note(s) stored in this build.`));};
  app.openStrategyVault=function(){const m=this.makeModal('Strategy Vault','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const name=el('input',{class:'field',placeholder:'Strategy name'}),rules=el('textarea',{class:'field ta-big-text',placeholder:'Entry, confirmation, stop, target, invalidation, risk rules…'});b.append(name,rules,el('button',{class:'primary',onclick:()=>{if(!name.value.trim()){toast('Enter a strategy name','error');return;}this.state.ownerLab.strategies.unshift({id:`st-${Date.now()}`,name:name.value.trim(),rules:rules.value,updatedAt:new Date().toISOString()});this.save?.();this.openStrategyVault();}},'Save strategy'));for(const s of this.state.ownerLab.strategies)b.append(el('div',{class:'ta-vault-card'},el('strong',{},s.name),el('p',{},s.rules||'No rules yet'),el('button',{class:'danger',onclick:()=>{this.state.ownerLab.strategies=this.state.ownerLab.strategies.filter(x=>x.id!==s.id);this.save?.();this.openStrategyVault();}},'Delete')));};
  app.openAvataAgents=function(){const m=this.makeModal('Avata Agents','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const name=el('input',{class:'field',placeholder:'Agent name'}),instructions=el('textarea',{class:'field ta-big-text',placeholder:'Instructions for this private trading agent…'});b.append(name,instructions,el('button',{class:'primary',onclick:()=>{if(!name.value.trim())return toast('Enter an agent name','error');this.state.ownerLab.agents.unshift({id:`ag-${Date.now()}`,name:name.value.trim(),instructions:instructions.value});this.save?.();this.openAvataAgents();}},'Save agent'));for(const a of this.state.ownerLab.agents)b.append(el('div',{class:'ta-vault-card'},el('strong',{},a.name),el('p',{},a.instructions),el('button',{class:'danger',onclick:()=>{this.state.ownerLab.agents=this.state.ownerLab.agents.filter(x=>x.id!==a.id);this.save?.();this.openAvataAgents();}},'Delete')));};
  app.openDeepResearch=function(){const m=this.makeModal('Deep Research','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const q=el('textarea',{class:'field ta-big-text',placeholder:'Research question…'}),out=el('div',{class:'ta-research-output'},'Enter a research question.');const btn=el('button',{class:'primary'},'Run research');btn.onclick=async()=>{const fn=window.TRADE_AVATA_RESEARCH_ADAPTER?.research;if(typeof fn!=='function'){out.textContent='Research provider not connected. Trade Avata will not fake citations or silently use a paid provider.';return;}try{out.textContent='Researching…';const r=await fn({query:q.value,symbol:this.activeConfig?.().symbol,taId:this.state.identity?.taId});out.textContent=typeof r==='string'?r:JSON.stringify(r,null,2);this.state.ownerLab.researchHistory.unshift({query:q.value,at:new Date().toISOString()});this.save?.();}catch(e){out.textContent=e?.message||'Research failed';}};b.append(q,btn,out);};
  app.openAdvancedVoice=function(){const configured=!!window.TRADE_AVATA_VOICE_ADAPTER;openToolModal(this,'Advanced Voice',el('div',{class:'ta-tool-report'},el('h3',{},configured?'Advanced voice provider connected':'Advanced voice provider not connected'),el('p',{},configured?'Provider calls remain protected by the Owner quota guard.':'Browser voice remains available. Connect a recurring-free or owner-approved secure provider through the backend before advanced voice is enabled.'),el('button',{class:'secondary',onclick:()=>this.openSettings?.('ai')},'Open voice settings')));};
  app.openFileAnalysis=function(){const m=this.makeModal('File Analysis','ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const input=el('input',{class:'field',type:'file',accept:'.txt,.md,.csv,.json,.pdf'}),out=el('pre',{class:'ta-file-output'},'Choose a text, Markdown, CSV or JSON file for local inspection. PDF analysis requires a secure file-analysis adapter.');input.onchange=async()=>{const f=input.files?.[0];if(!f)return;if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){const fn=window.TRADE_AVATA_FILE_ANALYSIS_ADAPTER?.analyze;if(typeof fn!=='function'){out.textContent='PDF selected. Secure PDF analysis adapter is not connected yet.';return;}try{out.textContent='Analyzing PDF…';out.textContent=String(await fn({file:f,taId:this.state.identity?.taId}));}catch(e){out.textContent=e?.message||'PDF analysis failed';}return;}if(f.size>2_500_000){out.textContent='Local preview limit is 2.5 MB. Use the secure file-analysis adapter for larger files.';return;}const text=await f.text();const lines=text.split(/\r?\n/);out.textContent=`${f.name}\n${lines.length} lines · ${text.length.toLocaleString()} characters\n\n${text.slice(0,12000)}`;};b.append(input,out);};
}
function metric(k,v){return el('div',{},el('small',{},k),el('b',{},String(v)));}
function openToolModal(app,title,node){const m=app.makeModal(title,'ta-tool-modal');m.ok.style.display='none';m.cancel.textContent='Close';m.main.replaceChildren(el('div',{class:'settings-body'},node));}

function patchGuestAdmin(app){
  app.startGuestPolicy=function(){
    clearInterval(this.__guestTimer);document.querySelector('.ta-guest-gate')?.remove();
    const cfg=this.state.guestAccess||{};if(authenticated(this)||owner(this)||cfg.enabled!==true)return;
    let g;try{g=JSON.parse(localStorage.getItem(GUEST_KEY)||'null');}catch{}const now=Date.now(),resetMs=Math.max(1,Number(cfg.resetHours||24))*3600000;if(!g||now-Number(g.windowStart||0)>=resetMs)g={windowStart:now,softShown:false,hardShown:false};localStorage.setItem(GUEST_KEY,JSON.stringify(g));
    const check=()=>{if(authenticated(this)||owner(this)||this.state.guestAccess?.enabled!==true){document.querySelector('.ta-guest-gate')?.remove();clearInterval(this.__guestTimer);return;}let x;try{x=JSON.parse(localStorage.getItem(GUEST_KEY)||'{}');}catch{x=g;}const elapsed=(Date.now()-Number(x.windowStart||Date.now()))/60000,c=this.state.guestAccess;if(c.hardLockEnabled===true&&elapsed>=Number(c.hardMinutes||40)){showGuestGate(this);return;}if(c.softPromptEnabled!==false&&elapsed>=Number(c.softMinutes||10)&&!x.softShown&&!this.modal){x.softShown=true;localStorage.setItem(GUEST_KEY,JSON.stringify(x));showGuestSoftPrompt(this);}};
    check();this.__guestTimer=setInterval(check,15000);
  };
  app.openGuestAccessAdmin=function(){if(!owner(this)){toast('Owner access required','error');return;}const m=this.makeModal('Admin · Guest Access','ta-tool-modal guest-admin-modal');m.ok.style.display='none';m.cancel.textContent='Close';const b=el('div',{class:'settings-body'});m.main.replaceChildren(b);const cfg=this.state.guestAccess;
    const toggle=(label,key)=>{const row=el('label',{class:'ta-admin-toggle'},el('span',{},label)),i=el('input',{type:'checkbox'});i.checked=!!cfg[key];i.onchange=()=>{cfg[key]=i.checked;this.save?.();this.startGuestPolicy();};row.append(i);b.append(row);};
    b.append(el('p',{class:'settings-note'},'Guest lockout is OFF by default in V11.1. Turn it on only when you are ready. OWNER sessions always bypass it.'));
    toggle('Enable guest access timer', 'enabled');toggle('Show soft sign-in reminder','softPromptEnabled');toggle('Enable hard interaction lock','hardLockEnabled');toggle('Keep platform visible behind lock','previewBehindGate');toggle('Allow view-only preview while locked','allowViewingWhenLocked');
    const num=(label,key,min,max)=>{const row=el('label',{class:'ta-admin-number'},el('span',{},label)),i=el('input',{class:'field',type:'number',min,max,value:String(cfg[key])});i.onchange=()=>{cfg[key]=clamp(Number(i.value)||min,min,max);this.save?.();this.startGuestPolicy();};row.append(i);b.append(row);};num('Soft reminder after (minutes)','softMinutes',1,240);num('Hard lock after (minutes)','hardMinutes',2,1440);num('Guest window reset (hours)','resetHours',1,168);
    b.append(el('button',{class:'secondary',onclick:()=>{localStorage.removeItem(GUEST_KEY);document.querySelector('.ta-guest-gate')?.remove();this.startGuestPolicy();toast('Guest session timer reset','success');}},'Clear guest lock / reset session'));
  };
}
function showGuestSoftPrompt(app){const m=app.makeModal('Save your Trade Avata workspace','guest-soft-modal');m.main.replaceChildren(el('div',{class:'settings-body'},el('div',{class:'ta-reference-card'},el('strong',{},'Keep your workspace'),el('p',{},'Sign in to preserve your layouts, settings and Trade Avata identity across devices. You can continue as guest while guest access remains available.'))));m.ok.textContent='Sign in';m.ok.onclick=()=>{app.closeModal();app.openLogin();};m.cancel.textContent='Continue as guest';}
function showGuestGate(app){if(document.querySelector('.ta-guest-gate'))return;const cfg=app.state.guestAccess||{};const gate=el('div',{class:`ta-guest-gate ta-preview-gate ${cfg.previewBehindGate===false?'ta-hide-preview':''}`},el('div',{class:'ta-guest-gate-card'},el('span',{class:'ta-gate-kicker'},'TRADE AVATA'),el('h2',{},'Sign in to continue'),el('p',{},'The platform remains visible so you can see the workspace, but interaction is paused until you sign in.'),el('button',{class:'primary',onclick:()=>app.openLogin()},'Sign in / Create account')));document.body.append(gate);}


function patchChartInteractionFeel(app){
  const down=e=>{if(e.target?.closest?.('.chart-host'))document.body.classList.add('ta-chart-interacting');};
  const up=()=>document.body.classList.remove('ta-chart-interacting');
  document.addEventListener('pointerdown',down,{capture:true});
  document.addEventListener('pointerup',up,{capture:true});
  document.addEventListener('pointercancel',up,{capture:true});
  window.addEventListener('blur',up);
  app.__v111InteractionCleanup=()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',up);};
}

function patchOwnerProfileVisibility(app){
  const oldTop=app.renderTopbar.bind(app);app.renderTopbar=function(){oldTop();const btn=document.querySelector('.account-btn');if(btn&&authenticated(this)){btn.textContent='';btn.append(el('span',{class:`account-dot ${this.state.connection?.status==='live'?'live':''}`}),document.createTextNode(` ${this.state.identity?.taId||'Profile'} ▾`));btn.onclick=()=>this.openProfile();}};
}

function install(app){
  if(app.__tradeAvataV111)return;app.__tradeAvataV111=true;correctionState(app);
  clearInterval(app.__guestTimer);document.querySelector('.ta-guest-gate')?.remove();
  patchCandleThemePriority(app);patchCandleViewScale(app);patchSettingsTransactions(app);patchMobileMenus(app);patchModernAuth(app);patchOwnerLab(app);patchGuestAdmin(app);patchChartInteractionFeel(app);patchOwnerProfileVisibility(app);
  app.startGuestPolicy();app.applyPlatformTheme?.();app.refreshAllCharts?.();app.renderTopbar?.();app.renderRightRail?.();app.renderRightPanel?.();
  window.__tradeAvataV111={build:BUILD,app,checks:()=>({guestDefaultOff:app.state.guestAccess?.enabled===false,hardLockDefaultOff:app.state.guestAccess?.hardLockEnabled===false,candleViewScale:Number.isFinite(Number(app.state.chartSettings?.candleViewScale)),ownerLab:typeof app.openOwnerTradingLab==='function',googleAuth:String(app.openLogin).includes('signInWithGoogle'),guestAdmin:typeof app.openGuestAccessAdmin==='function'})};
  console.info(`[${BUILD}] installed on V11 baseline`);
}
async function boot(){for(let i=0;i<240;i++){const app=window.__tradeAvataFinalUpgrade?.app||window.__tradeAvataMasterRecovery?.app||window.__tradeAvata;if(app&&app.__tradeAvataFinalUpgrade){install(app);return;}await new Promise(r=>setTimeout(r,25));}console.error(`[${BUILD}] bootstrap timed out`);}boot();
