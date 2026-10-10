/* Trade Avata V11.2 R3.1 — dense zoomed-out pan correction.
 * Additive only. Keeps the approved native chart and V11.2 feature set intact.
 *
 * Fixes:
 * - activates interaction performance mode during chart dragging
 * - stops synchronous full-canvas painting when many candles are visible
 * - pauses unnecessary crosshair calculations during dense dragging
 * - temporarily reduces excessive DPR rendering load during very dense movement
 * - restores full crisp rendering immediately after release
 */

import {TradeAvataNativeChart} from './native-chart.js';

const BUILD='Trade Avata V11.2 R3.1 Dense Pan Fix';

const DENSE_SPAN=420;
const DPR_REDUCE_SPAN=900;

const spanOf=chart=>{
  const r=chart?.visibleRange;

  return r &&
    Number.isFinite(r.from) &&
    Number.isFinite(r.to)
      ? Math.max(0,r.to-r.from)
      : 0;
};

const densePan=chart=>
  chart?.drag?.kind==='pan' &&
  spanOf(chart)>=DENSE_SPAN;


function patchNativeRenderer(){

  const proto=TradeAvataNativeChart?.prototype;

  if(!proto || proto.__taDensePanR31)return;

  proto.__taDensePanR31=true;


  /*
   * ------------------------------------------------------------
   * DENSE DRAG RENDERING
   * ------------------------------------------------------------
   *
   * The normal chart performs an immediate full canvas render
   * while dragging.
   *
   * That feels excellent with 50–200 candles.
   *
   * But with hundreds or thousands of visible candles it can
   * block pointer movement.
   *
   * Dense charts are therefore rendered once per browser frame.
   */

  const originalRequestRender=proto.requestRender;

  proto.requestRender=function(){

    if(this.destroyed)return;

    if(densePan(this)){

      if(this.raf)return;

      this.raf=requestAnimationFrame(()=>{

        this.raf=0;

        if(!this.destroyed){
          this.render();
        }

      });

      return;
    }

    return originalRequestRender.call(this);
  };


  /*
   * ------------------------------------------------------------
   * CROSSHAIR PERFORMANCE
   * ------------------------------------------------------------
   *
   * While somebody is actively dragging thousands of candles,
   * crosshair calculations and data-window updates are not needed.
   *
   * They return immediately when the mouse is released.
   */

  const originalEmitCrosshair=proto._emitCrosshair;

  proto._emitCrosshair=function(x,y){

    if(densePan(this)){
      return;
    }

    return originalEmitCrosshair.call(this,x,y);
  };
}


function currentApp(){

  return (
    window.__tradeAvataV111?.app ||
    window.__tradeAvataFinalUpgrade?.app ||
    window.__tradeAvata ||
    null
  );
}


function chartFromCanvas(canvas){

  const app=currentApp();

  if(!app || !canvas)return null;

  for(const pane of app.panes || []){

    if(
      pane?.chart?.canvas===canvas ||
      pane?.chartHost?.contains?.(canvas)
    ){
      return pane.chart;
    }
  }

  return null;
}


function installInteractionMarkers(){

  if(window.__taDensePanInteractionMarkers)return;

  window.__taDensePanInteractionMarkers=true;

  const activePointers=new Set();
  const reducedCharts=new Set();


  const begin=e=>{

    const canvas=
      e.target?.closest?.('.ta-native-v3-chart');

    if(!canvas)return;

    activePointers.add(e.pointerId);

    /*
     * This activates the performance logic that already exists
     * in Trade Avata V11.2.
     */
    document.body?.classList.add(
      'ta-chart-interacting'
    );

    const chart=chartFromCanvas(canvas);


    /*
     * A 4x DPR canvas contains roughly 16 times as many pixels
     * as its CSS dimensions.
     *
     * When the chart is extremely zoomed out we temporarily use
     * Trade Avata's existing performance DPR cap.
     */

    if(
      chart &&
      spanOf(chart)>=DPR_REDUCE_SPAN &&
      (window.devicePixelRatio || 1)>2
    ){

      document.body?.classList.add(
        'ta-performance-mode'
      );

      if(!reducedCharts.has(chart)){

        reducedCharts.add(chart);

        try{
          chart.resize?.();
        }catch{}
      }
    }
  };


  const finish=e=>{

    activePointers.delete(e.pointerId);

    if(activePointers.size)return;

    document.body?.classList.remove(
      'ta-chart-interacting'
    );


    /*
     * Restore full-resolution rendering immediately.
     */

    if(
      document.body?.classList.contains(
        'ta-performance-mode'
      )
    ){

      document.body.classList.remove(
        'ta-performance-mode'
      );

      requestAnimationFrame(()=>{

        for(const chart of reducedCharts){

          try{
            chart.resize?.();
          }catch{}
        }

        reducedCharts.clear();
      });
    }
  };


  document.addEventListener(
    'pointerdown',
    begin,
    true
  );

  document.addEventListener(
    'pointerup',
    finish,
    true
  );

  document.addEventListener(
    'pointercancel',
    finish,
    true
  );


  window.addEventListener('blur',()=>{

    activePointers.clear();

    document.body?.classList.remove(
      'ta-chart-interacting',
      'ta-performance-mode'
    );

    requestAnimationFrame(()=>{

      for(const chart of reducedCharts){

        try{
          chart.resize?.();
        }catch{}
      }

      reducedCharts.clear();
    });
  });
}


function install(){

  patchNativeRenderer();

  installInteractionMarkers();


  window.__TRADE_AVATA_DENSE_PAN_FIX={

    build:BUILD,

    denseSpan:DENSE_SPAN,

    dprReduceSpan:DPR_REDUCE_SPAN,

    status(){

      const app=currentApp();

      return (app?.panes || []).map(p=>({

        pane:p.id,

        visibleCandles:
          Math.round(
            spanOf(p.chart)
          ),

        dense:
          spanOf(p.chart)>=DENSE_SPAN

      }));
    }
  };


  console.info(
    `[${BUILD}] installed`
  );
}


install();
