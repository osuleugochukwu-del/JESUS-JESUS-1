import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeIndicator, indicatorLabel, stochastic } from '../src/indicators.js';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const upgrade=fs.readFileSync(new URL('../src/final-upgrade.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/final-upgrade.css',import.meta.url),'utf8');
const baseCss=fs.readFileSync(new URL('../assets/styles.css',import.meta.url),'utf8');
const state=fs.readFileSync(new URL('../src/state.js',import.meta.url),'utf8');
const nativeChart=fs.readFileSync(new URL('../src/native-chart.js',import.meta.url),'utf8');

test('V11 final upgrade loads after protected master recovery layer',()=>{
  assert.ok(index.includes('./assets/final-upgrade.css'));
  assert.ok(index.includes('./src/final-upgrade.js'));
  assert.ok(index.indexOf('./src/master-recovery.js')<index.indexOf('./src/final-upgrade.js'));
});

test('V11 guest access policy is 10 minute prompt, 40 minute gate, 24 hour reset',()=>{
  assert.match(state,/softMinutes:10/);
  assert.match(state,/hardMinutes:40/);
  assert.match(state,/resetHours:24/);
  assert.match(upgrade,/showHardGuestGate/);
});

test('professional glass UI, adjustable opacity and soft light theme are present',()=>{
  assert.match(css,/--ta-panel-opacity/);
  assert.match(css,/--ta-menu-opacity/);
  assert.match(css,/--ta-modal-opacity/);
  assert.match(css,/--ta-glass-blur/);
  assert.match(css,/html\[data-ta-theme="light"\]/);
  assert.doesNotMatch(css,/html\[data-ta-theme="light"\][^{]*\{[^}]*background:\s*#fff/i);
  assert.match(upgrade,/Panels opacity/);
  assert.match(upgrade,/Dropdown opacity/);
});

test('order ticket includes professional order types, prepare trade and DOM adapter surface',()=>{
  for(const term of ['Market','Limit','Stop','Stop Limit','Prepare Buy setup','Depth of Market']) assert.ok(upgrade.includes(term),term);
  assert.match(upgrade,/riskPercent/);
  assert.match(upgrade,/timeInForce/);
});

test('round-number price level presets cover 500, 100, 50 and custom levels',()=>{
  assert.match(state,/preset:'major-500'/);
  for(const term of ['major-500','thousands','hundreds','fifties','custom']) assert.ok(upgrade.includes(term));
  assert.match(nativeChart,/_roundNumberTicks/);
});

test('indicator automatic labels and full stochastic controls are present',()=>{
  const ema=makeIndicator('ema',{length:20});
  assert.equal(indicatorLabel(ema),'20 EMA');
  const st=makeIndicator('stochastic',{k:14,kSlowing:3,d:3});
  assert.equal(indicatorLabel(st),'Stochastic (14,3,3)');
  for(const term of ['K Periods','K Slowing','D Periods','MA Type','Calculation']) assert.ok(upgrade.includes(term));
});

test('stochastic smoothing exposes valid K and D series',()=>{
  const closes=Array.from({length:40},(_,i)=>100+i*.5+Math.sin(i));
  const highs=closes.map(x=>x+1), lows=closes.map(x=>x-1);
  const out=stochastic(highs,lows,closes,14,3,3,'ema','lowhigh');
  assert.equal(out.k.length,40); assert.equal(out.d.length,40);
  assert.ok(out.k.some(Number.isFinite)); assert.ok(out.d.some(Number.isFinite));
});

test('TA ID, owner/free architecture and hidden future plans are wired',()=>{
  for(const term of ['TA-','OWNER','FREE','PRO','ADVANCED','indicatorEntitlements','licenseGrants']) assert.ok(upgrade.includes(term)||state.includes(term),term);
  assert.match(state,/paymentsEnabled:false/);
  assert.match(state,/proVisible:false/);
  assert.match(state,/advancedVisible:false/);
});

test('settings sync and watchlist favorite architecture are present',()=>{
  assert.match(upgrade,/TRADE_AVATA_CLOUD_SETTINGS/);
  assert.match(state,/favoriteSymbols/);
  assert.match(upgrade,/Manage full watchlist/);
  assert.match(upgrade,/Selected-symbol analytics/);
});

test('expanded multi-chart layouts include six and eight chart grids',()=>{
  assert.match(state,/VALID_LAYOUTS[^\n]*'6'[^\n]*'8'/);
  assert.match(baseCss,/layout-6/);
  assert.match(baseCss,/layout-8/);
});
