(function (global) {
  "use strict";

  const previousFactory = global.RoadToGlorySquadView;
  if (!previousFactory?.create) return;

  const catalogOnlyClasses = /\s+(?:rtg-prematch-player-card|rtg-picker-player-card|rtg-catalog-player-card)\b/g;
  const canonicalizeCatalogCards = (markup) => String(markup || "").replace(catalogOnlyClasses, "");

  global.RoadToGlorySquadView = Object.freeze({
    create(deps = {}) {
      const view = previousFactory.create(deps);
      const originalCatalogResultsMarkup = view.catalogResultsMarkup;
      const originalCatalogMarkup = view.catalogMarkup;

      function catalogResultsMarkup(options = {}) {
        return canonicalizeCatalogCards(originalCatalogResultsMarkup(options));
      }

      function catalogMarkup(options = {}) {
        return canonicalizeCatalogCards(originalCatalogMarkup(options));
      }

      return Object.freeze({
        ...view,
        catalogResultsMarkup,
        catalogMarkup,
      });
    },
  });
})(globalThis);
