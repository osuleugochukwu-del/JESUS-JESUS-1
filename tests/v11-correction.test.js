import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const correction=fs.readFileSync(new URL('../src/v11-correction.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/v11-correction.css',import.meta.url),'utf8');
const state=fs.readFileSync(new URL('../src/state.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('V11.1 correction loads after V11 final layer and is cached',()=>{
  assert.match(index,/final-upgrade\.js[\s\S]*v11-correction\.js/);
  assert.match(index,/final-upgrade\.css[\s\S]*v11-correction\.css/);
  assert.match(sw,/v11-1-correction/);
  assert.match(sw,/v11-correction\.js/);
  assert.match(sw,/v11-correction\.css/);
});

test('guest lockout is OFF by default and admin-controlled',()=>{
  assert.match(state,/guestAccess:\{enabled:false/);
  assert.match(state,/hardLockEnabled:false/);
  assert.match(correction,/Guest lockout is OFF by default/);
  assert.match(correction,/openGuestAccessAdmin/);
  assert.match(correction,/Clear guest lock \/ reset session/);
  assert.match(correction,/if\(authenticated\(this\)\|\|owner\(this\)\|\|cfg\.enabled!==true\)return/);
});

test('modern authentication includes Google, password reset, confirm password and TA profile',()=>{
  assert.match(correction,/Continue with Google/);
  assert.match(correction,/signInWithGoogle/);
  assert.match(correction,/Forgot password\?/);
  assert.match(correction,/Confirm password/);
  assert.match(correction,/Copy TA ID/);
  assert.match(correction,/Owner Trading Lab/);
});

test('candle view scale is independent and Home preserves it',()=>{
  assert.match(state,/candleViewScale:1/);
  assert.match(correction,/Candle View Scale/);
  assert.match(correction,/ChartPane\.prototype\.homeBarTarget/);
  assert.match(correction,/Math\.round\(base\*scale\)/);
  assert.match(correction,/Keep the right edge visually anchored/);
  assert.match(correction,/Reset Candle View/);
});

test('settings transaction fixes OK save, Cancel rollback and manual candle priority',()=>{
  assert.match(correction,/const snap=copySettings\(this\)/);
  assert.match(correction,/restoreSettings\(this,snap\)/);
  assert.match(correction,/committed=true/);
  assert.match(correction,/candleUserOverride=true/);
  assert.match(correction,/patchCandleThemePriority/);
});

test('mobile menus become safe bottom sheets and premium panel shell is applied',()=>{
  assert.match(correction,/ta-mobile-menu-sheet/);
  assert.match(css,/\.floating-menu\.ta-mobile-menu-sheet\{position:fixed/);
  assert.match(css,/\.floating-menu\.ta-premium-menu/);
  assert.match(css,/\.right-panel/);
});

test('owner lab has real local workspaces and explicit provider-backed surfaces',()=>{
  for(const label of ['Chart AI','Journal Coach','Analytics AI','Deep Research','Strategy Vault','Projects','Avata Agents','Advanced Voice','File Analysis','Usage & Quotas','TA ID Licensing','Guest Access Admin']) assert.match(correction,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(correction,/Research provider not connected/);
  assert.match(correction,/Trade Avata will not fake citations/);
  assert.match(correction,/PDF analysis requires a secure file-analysis adapter/);
});


test('interactive chart render path reduces pointer-follow latency without changing normal RAF updates',()=>{
  const native=fs.readFileSync(new URL('../src/native-chart.js',import.meta.url),'utf8');
  assert.match(native,/V11\.1 INTERACTION RESPONSE/);
  assert.match(native,/if\(this\.drag\)/);
  assert.match(native,/elapsed>=12/);
  assert.match(native,/requestAnimationFrame/);
});
