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

  // The role switch is a sibling of the card while the S1/S2 tab lives inside
  // the card. Compensate for the 32px Change button + 4px slot gap, then hang
  // this tab below the opposite (left) card corner at the same visual level.
  const roleBadgeStyle=document.createElement("style");
  roleBadgeStyle.id="rtg-role-badge-hotfix";
  roleBadgeStyle.textContent=`
    .rtg-squad-shell .squad-bench-list > .rtg-squad-card-slot{
      position:relative!important;
    }
    .rtg-squad-shell .squad-bench-list > .rtg-squad-card-slot > .rtg-squad-role-trigger{
      position:absolute!important;
      z-index:26!important;
      left:-4px!important;
      right:auto!important;
      top:auto!important;
      /* Exact mirror of the S1/S2 badge: 32px Cambia + 4px slot gap = card bottom
         36px above the slot bottom; S2 protrudes 11px below the card. */
      bottom:25px!important;
      box-sizing:border-box!important;
      width:auto!important;
      min-width:27px!important;
      max-width:none!important;
      height:16px!important;
      min-height:16px!important;
      max-height:16px!important;
      margin:0!important;
      padding:0 5px!important;
      overflow:hidden!important;
      display:grid!important;
      place-items:center!important;
      gap:0!important;
      border:2px solid #111216!important;
      border-radius:0!important;
      background:#ffd21f!important;
      color:#111216!important;
      box-shadow:1px 2px 0 #111216!important;
      font:1000 7px/1 system-ui,sans-serif!important;
      letter-spacing:.04em!important;
      transform:none!important;
    }
    .rtg-squad-shell .squad-bench-list > .rtg-squad-card-slot > .rtg-squad-role-trigger span{
      display:grid!important;
      place-items:center!important;
      width:auto!important;
      height:auto!important;
      font:1000 10px/1 system-ui,sans-serif!important;
      line-height:1!important;
    }
    .rtg-squad-shell .squad-bench-list > .rtg-squad-card-slot > .rtg-squad-role-trigger strong{
      display:none!important;
    }
    .rtg-squad-shell .squad-bench-list > .rtg-squad-card-slot > .rtg-squad-role-trigger:active{
      transform:translate(1px,1px)!important;
      box-shadow:none!important;
    }
  `;
  document.head.appendChild(roleBadgeStyle);

  // Parser-ordered RTG extensions. The match engine already exists when this
  // loader runs, so the halftime correction can safely wrap it before the
  // match view/controller start using it.
  document.write('<script src="js/road-to-glory/rtg-match-halftime-fix.js?v=20260920-halftime-restart-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-base.js?v=20260925-role-tab-mirror-2"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-picker-order-runtime.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-order.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-catalog-canonical.js?v=20260920-canonical-card-1"><\/script>');
})();
