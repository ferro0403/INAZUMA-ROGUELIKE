(function () {
  "use strict";

  // Parser-ordered RTG extensions. The match engine already exists when this
  // loader runs, so the halftime correction can safely wrap it before the
  // match view/controller start using it.
  document.write('<script src="js/road-to-glory/rtg-match-halftime-fix.js?v=20260920-halftime-restart-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-base.js?v=20260923-legacy-tab-detail-3"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-picker-order-runtime.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-order.js?v=20260920-full-pool-order-1"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-catalog-canonical.js?v=20260920-canonical-card-1"><\/script>');
})();
