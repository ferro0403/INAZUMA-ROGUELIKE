(function () {
  "use strict";

  // The quick-bench strip survives picker hydration while the normal results
  // are replaced. The controller therefore reaches bindResults more than once.
  // Deduplicate only those quick-bench click bindings so one tap performs one
  // swap instead of swapping and immediately swapping back.
  const eventProto=globalThis.EventTarget?.prototype;
  if(eventProto&&!eventProto.__rtgQuickBenchDedup){
    const nativeAddEventListener=eventProto.addEventListener;
    Object.defineProperty(eventProto,"__rtgQuickBenchDedup",{value:true});
    eventProto.addEventListener=function(type,listener,options){
      if(type==="click"&&this?.matches?.("[data-rtg-picker-player]")&&this?.closest?.(".rtg-picker-quick-bench")){
        if(this.__rtgQuickBenchClickBound)return;
        Object.defineProperty(this,"__rtgQuickBenchClickBound",{value:true,configurable:true});
      }
      return nativeAddEventListener.call(this,type,listener,options);
    };
  }

  // Load the visual restoration after the RTG theme so the approved Legacy
  // and multi-version banners win without touching identity/grouping logic.
  if(!document.querySelector('link[data-rtg-version-banners]')){
    const style=document.createElement('link');
    style.rel='stylesheet';
    style.href='css/rtg-version-banners.css?v=20260926-restore-1';
    style.dataset.rtgVersionBanners='1';
    document.head.appendChild(style);
  }

  // Parser-ordered RTG extensions. The match engine already exists when this
  // loader runs, so the halftime correction can safely wrap it before the
  // match view/controller start using it.
  document.write('<script src="js/road-to-glory/rtg-match-halftime-fix.js?v=20260920-halftime-restart-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-base.js?v=20260925-role-switch-detail-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-picker-order-runtime.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-order.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-catalog-canonical.js?v=20260920-canonical-card-1"><\/script>');
})();
