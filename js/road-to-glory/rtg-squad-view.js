(function () {
  "use strict";

  // These two scripts must execute in parser order: first the established squad
  // view, then the small overall-order extension. Keeping them as two external
  // scripts avoids reading RoadToGlorySquadView before the base file has run.
  document.write('<script src="js/road-to-glory/rtg-squad-view-base.js?v=20260920-overall-order-2"><\/script>');
  document.write('<script src="js/road-to-glory/rtg-squad-view-order.js?v=20260920-overall-order-2"><\/script>');
})();
