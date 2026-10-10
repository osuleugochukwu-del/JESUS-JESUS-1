/* Trade Avata V11.2 R3.2 — dense-pan performance + crisp candle correction.
 * Additive only. No DPR reduction. Full candle sharpness is preserved at rest.
 * During very dense dragging, candle work is bucketed only while the pointer is down.
 */

import {TradeAvataNativeChart} from './native-chart.js';

const BUILD='Trade Avata V11.2 R3.2 Dense Pan Crisp Fix';

const DENSE_SPAN=300;
const VERY_DENSE_SPAN=700;

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

const veryDensePan=chart=>
  chart?.drag?.kind==='pan' &&
  spanOf(chart)>=VERY_DENSE_SPAN;


function patchNativeRenderer(){

  const proto=TradeAvataNativeChart?.prototype;

  if(!proto || proto.__taDensePanR32)return;

  proto.__taDensePanR32=true;


  /*
   * R3.1 temporarily lowered canvas resolution during dragging.
   * That made candles look softer.
   *
   * R3.2 NEVER lowers DPR.
   */
  document.body?.classList.remove(
    'ta-performance-mode'
  );


  const originalRender=
    proto.render;

  const originalPaneRects=
    proto._paneRects;

  const originalPaneRange=
    proto._paneRange;

  const originalTransform=
    proto._transform;

  const originalUntransform=
    proto._untransform;

  const originalRequestRender=
    proto.requestRender;

  const originalSnapCrosshair=
    proto._snapCrosshair;

  const originalEmitCrosshair=
    proto._emitCrosshair;

  const originalDrawCandles=
    proto._drawCandles;


  /*
   * ============================================================
   * FRAME GEOMETRY CACHE
   * ============================================================
   *
   * Before this correction every candle could repeatedly ask for:
   *
   * - pane rectangles
   * - visible price range
   * - transformation range
   *
   * Thousands of candles multiplied those calculations many times
   * during every mouse movement.
   *
   * R3.2 calculates them once for each render frame.
   */

  proto._paneRects=function(){

    if(this.__taFrameRects){
      return this.__taFrameRects;
    }

    const value=
      originalPaneRects.call(this);

    if(this.__taFrameRendering){
      this.__taFrameRects=value;
    }

    return value;
  };


  proto._paneRange=function(paneIndex){

    if(
      this.__taFrameRanges?.has(
        paneIndex
      )
    ){
      return this.__taFrameRanges.get(
        paneIndex
      );
    }

    const value=
      originalPaneRange.call(
        this,
        paneIndex
      );

    if(this.__taFrameRendering){

      this.__taFrameRanges ||=
        new Map();

      this.__taFrameRanges.set(
        paneIndex,
        value
      );
    }

    return value;
  };


  /*
   * ============================================================
   * NORMAL PRICE MODE FAST PATH
   * ============================================================
   *
   * Normal price mode does not need percentage/log calculations.
   */

  proto._transform=function(
    value,
    paneIndex
  ){

    const mode=
      paneIndex===0
        ?Number(
          this.priceScaleOptions?.mode || 0
        )
        :0;

    if(mode===0){
      return Number(value);
    }

    return originalTransform.call(
      this,
      value,
      paneIndex
    );
  };


  proto._untransform=function(
    value,
    paneIndex
  ){

    const mode=
      paneIndex===0
        ?Number(
          this.priceScaleOptions?.mode || 0
        )
        :0;

    if(mode===0){
      return Number(value);
    }

    return originalUntransform.call(
      this,
      value,
      paneIndex
    );
  };


  /*
   * Wrap one complete render with the temporary frame cache.
   */

  proto.render=function(){

    this.__taFrameRendering=true;

    this.__taFrameRects=null;

    this.__taFrameRanges=
      new Map();

    try{

      return originalRender.call(this);

    }finally{

      this.__taFrameRendering=false;

      this.__taFrameRects=null;

      this.__taFrameRanges=null;
    }
  };


  /*
   * ============================================================
   * POINTER DRAG RENDERING
   * ============================================================
   *
   * Do not perform a complete synchronous canvas paint for every
   * mouse pointer event when hundreds/thousands of candles are
   * visible.
   *
   * Dense dragging follows the browser's animation frames.
   */

  proto.requestRender=function(){

    if(this.destroyed)return;


    if(densePan(this)){

      if(this.raf)return;

      this.raf=
        requestAnimationFrame(
          ()=>{

            this.raf=0;

            if(!this.destroyed){
              this.render();
            }
          }
        );

      return;
    }


    return originalRequestRender.call(
      this
    );
  };


  /*
   * ============================================================
   * CROSSHAIR DURING DENSE DRAG
   * ============================================================
   *
   * Candle magnet calculations are unnecessary while the user
   * is actively moving the entire chart.
   */

  proto._snapCrosshair=function(
    x,
    y
  ){

    if(densePan(this)){

      return{
        x:Number(x),
        y:Number(y)
      };
    }

    return originalSnapCrosshair.call(
      this,
      x,
      y
    );
  };


  proto._emitCrosshair=function(
    x,
    y
  ){

    if(densePan(this)){
      return;
    }

    return originalEmitCrosshair.call(
      this,
      x,
      y
    );
  };


  /*
   * ============================================================
   * VERY DENSE CANDLE DRAWING
   * ============================================================
   *
   * Example:
   *
   * If 3,000 candles are squeezed into a 1,000-pixel chart,
   * several candles occupy the same physical screen pixel.
   *
   * Drawing every one separately wastes a huge amount of work.
   *
   * ONLY WHILE DRAGGING, nearby candles are grouped into a
   * pixel-sized OHLC candle.
   *
   * High and low extremes are preserved.
   *
   * The moment the mouse is released the original full-detail
   * candles are drawn again.
   */

  proto._drawCandles=function(
    ctx,
    s,
    rect,
    start,
    end
  ){

    if(!veryDensePan(this)){

      return originalDrawCandles.call(
        this,
        ctx,
        s,
        rect,
        start,
        end
      );
    }


    const r=
      this.visibleRange;

    if(!r)return;


    const spacing=
      rect.width /
      Math.max(
        1,
        r.to-r.from
      );


    /*
     * If candles already have enough screen width,
     * keep the original renderer.
     */

    if(spacing>=1.15){

      return originalDrawCandles.call(
        this,
        ctx,
        s,
        rect,
        start,
        end
      );
    }


    const data=
      s.data || [];

    const last=
      Math.min(
        end,
        data.length-1
      );

    if(start>last)return;


    /*
     * Around one visible candle representation per screen pixel.
     */

    const group=
      Math.max(
        1,
        Math.ceil(
          1.35 /
          Math.max(
            .05,
            spacing
          )
        )
      );


    const o=
      s.optionsData || {};

    const hairX=
      typeof this._hairX==='function'
        ?this._hairX()
        :1;

    const hairY=
      typeof this._hairY==='function'
        ?this._hairY()
        :1;


    for(
      let i=start;
      i<=last;
      i+=group
    ){

      const jEnd=
        Math.min(
          last,
          i+group-1
        );


      let first=null;
      let lastBar=null;

      let high=-Infinity;
      let low=Infinity;


      for(
        let j=i;
        j<=jEnd;
        j++
      ){

        const b=data[j];

        if(!b)continue;


        if(!first){
          first=b;
        }


        lastBar=b;


        const hi=
          Number(b.high);

        const lo=
          Number(b.low);


        if(Number.isFinite(hi)){

          high=
            Math.max(
              high,
              hi
            );
        }


        if(Number.isFinite(lo)){

          low=
            Math.min(
              low,
              lo
            );
        }
      }


      if(
        !first ||
        !lastBar ||
        !Number.isFinite(high) ||
        !Number.isFinite(low)
      ){
        continue;
      }


      const open=
        Number(first.open);

      const close=
        Number(lastBar.close);


      if(
        !Number.isFinite(open) ||
        !Number.isFinite(close)
      ){
        continue;
      }


      const logical=
        (
          i+
          jEnd
        )/2;


      const rawX=
        this.timeScaleApi
          .logicalToCoordinate(
            logical
          );


      if(
        !Number.isFinite(rawX) ||
        rawX<-4 ||
        rawX>rect.right+4
      ){
        continue;
      }


      const yo=
        this._priceToY(
          open,
          s.paneIndex
        );

      const yc=
        this._priceToY(
          close,
          s.paneIndex
        );

      const yh=
        this._priceToY(
          high,
          s.paneIndex
        );

      const yl=
        this._priceToY(
          low,
          s.paneIndex
        );


      if(
        ![
          yo,
          yc,
          yh,
          yl
        ].every(
          Number.isFinite
        )
      ){
        continue;
      }


      const x=
        typeof this._snapX==='function'
          ?this._snapX(rawX)
          :rawX;


      const up=
        close>=open;


      const fill=
        up
          ?(
            o.upColor ||
            '#00c7b1'
          )
          :(
            o.downColor ||
            '#ff4d57'
          );


      const wick=
        up
          ?(
            o.wickUpColor ||
            fill
          )
          :(
            o.wickDownColor ||
            fill
          );


      /*
       * Wick.
       */

      if(o.wickVisible!==false){

        ctx.strokeStyle=wick;

        ctx.lineWidth=hairX;

        ctx.beginPath();


        ctx.moveTo(
          x,
          typeof this._snapY==='function'
            ?this._snapY(yh)
            :yh
        );


        ctx.lineTo(
          x,
          typeof this._snapY==='function'
            ?this._snapY(yl)
            :yl
        );


        ctx.stroke();
      }


      /*
       * Body.
       */

      const topRaw=
        Math.min(
          yo,
          yc
        );


      const bottomRaw=
        Math.max(
          yo,
          yc
        );


      const top=
        typeof this._snapY==='function'
          ?this._snapY(topRaw)
          :topRaw;


      const height=
        typeof this._snapHeight==='function'
          ?this._snapHeight(
            Math.max(
              hairY,
              bottomRaw-topRaw
            )
          )
          :Math.max(
            hairY,
            bottomRaw-topRaw
          );


      const bucketSpacing=
        spacing*group;


      const widthRaw=
        Math.max(
          hairX,
          Math.min(
            1.5,
            bucketSpacing*.72
          )
        );


      const width=
        typeof this._snapWidth==='function'
          ?this._snapWidth(
            widthRaw
          )
          :widthRaw;


      const left=
        typeof this._snapX==='function'
          ?this._snapX(
            rawX-width/2
          )
          :rawX-width/2;


      ctx.fillStyle=fill;


      ctx.fillRect(
        left,
        top,
        width,
        height
      );
    }
  };
}


function installInteractionMarkers(){

  if(
    window.__taDensePanInteractionMarkersR32
  ){
    return;
  }


  window.__taDensePanInteractionMarkersR32=
    true;


  const activePointers=
    new Set();


  const appNow=()=>

    window.__tradeAvataV111?.app ||

    window.__tradeAvataFinalUpgrade?.app ||

    window.__tradeAvata ||

    null;


  const begin=e=>{

    const canvas=
      e.target?.closest?.(
        '.ta-native-v3-chart'
      );


    if(!canvas)return;


    activePointers.add(
      e.pointerId
    );


    document.body?.classList.add(
      'ta-chart-interacting'
    );


    /*
     * Never lower chart resolution.
     */

    document.body?.classList.remove(
      'ta-performance-mode'
    );
  };


  const finish=e=>{

    activePointers.delete(
      e.pointerId
    );


    if(activePointers.size){
      return;
    }


    document.body?.classList.remove(
      'ta-chart-interacting',
      'ta-performance-mode'
    );


    /*
     * After Native clears the drag state,
     * force one full-detail final frame.
     */

    requestAnimationFrame(
      ()=>{

        const app=
          appNow();


        for(
          const pane
          of app?.panes || []
        ){

          try{

            pane.chart
              ?.requestRender
              ?.();

          }catch{}


          try{

            pane.renderOverlays
              ?.(true);

          }catch{}
        }
      }
    );
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


  window.addEventListener(
    'blur',
    ()=>{

      activePointers.clear();


      document.body?.classList.remove(
        'ta-chart-interacting',
        'ta-performance-mode'
      );


      requestAnimationFrame(
        ()=>{

          const app=
            appNow();


          for(
            const pane
            of app?.panes || []
          ){

            try{

              pane.chart
                ?.requestRender
                ?.();

            }catch{}


            try{

              pane.renderOverlays
                ?.(true);

            }catch{}
          }
        }
      );
    }
  );
}


function install(){

  patchNativeRenderer();

  installInteractionMarkers();


  window.__TRADE_AVATA_DENSE_PAN_FIX={

    build:BUILD,

    denseSpan:
      DENSE_SPAN,

    veryDenseSpan:
      VERY_DENSE_SPAN,


    status(){

      const app=

        window.__tradeAvataV111?.app ||

        window.__tradeAvataFinalUpgrade?.app ||

        window.__tradeAvata ||

        null;


      return(
        app?.panes || []
      ).map(
        p=>({

          pane:
            p.id,

          visibleCandles:
            Math.round(
              spanOf(
                p.chart
              )
            ),

          dense:
            spanOf(
              p.chart
            )>=
            DENSE_SPAN,

          veryDense:
            spanOf(
              p.chart
            )>=
            VERY_DENSE_SPAN
        })
      );
    }
  };


  console.info(
    `[${BUILD}] installed`
  );
}


install();
