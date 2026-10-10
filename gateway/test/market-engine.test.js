import test from 'node:test';import assert from 'node:assert/strict';
import {planForPeriod,ticksToTimeBars,ticksToCountBars,ticksToRenko,ticksToRange,decodeTickData,normalizeDeals} from '../market-engine.js';
test('period planner uses ticks below one minute and trendbars for normal periods',()=>{assert.equal(planForPeriod({mode:'time',value:'15s'}).kind,'ticks');assert.equal(planForPeriod({mode:'time',value:'1m'}).kind,'trend');assert.equal(planForPeriod({mode:'time',value:'2h'}).aggregate,2);});
test('historical tick delta decoding and aggregation are deterministic',()=>{const t=decodeTickData([{timestamp:2000,tick:10000000},{timestamp:500,tick:10010000},{timestamp:500,tick:10020000}]);assert.equal(t.length,3);assert.deepEqual(t.map(x=>x.time),[1000,1500,2000]);assert.equal(ticksToTimeBars(t,'1s').length,2);assert.equal(ticksToCountBars(t,2).length,2);});
test('renko and range builders produce bounded real-price bars',()=>{const ticks=[100,101,102,103,104].map((p,i)=>({time:1000+i*1000,price:p}));assert.ok(ticksToRenko(ticks,1).length>=3);assert.ok(ticksToRange(ticks,1).length>=3);});

test('closed deals use cTrader entry price and moneyDigits instead of raw integer money',()=>{
  const symbols=new Map([['1',{symbolName:'XAUUSD'}]]);
  const [d]=normalizeDeals([{dealId:'9',orderId:'8',positionId:'7',symbolId:'1',tradeSide:1,filledVolume:1000,executionPrice:4201.5,executionTimestamp:1700000000000,closePositionDetail:{entryPrice:4199.25,grossProfit:125000000,swap:-5000000,commission:-10000000,pnlConversionFee:-1000000,moneyDigits:8}}],symbols);
  assert.equal(d.entryPrice,4199.25);assert.equal(d.exitPrice,4201.5);assert.equal(d.grossProfit,1.25);assert.ok(Math.abs(d.pnl-1.09)<1e-9);assert.equal(d.volume,10);
});
