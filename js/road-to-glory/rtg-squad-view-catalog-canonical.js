(function (global) {
  "use strict";

  const previousFactory = global.RoadToGlorySquadView;
  if (!previousFactory?.create) return;

  const catalogOnlyClasses = /\s+(?:rtg-prematch-player-card|rtg-picker-player-card|rtg-catalog-player-card)\b/g;
  const canonicalizeCatalogCards = (markup) => String(markup || "").replace(catalogOnlyClasses, "");
  const canonicalizeVersionCards = (markup) => String(markup || "")
    .replace(/\s+rtg-version-player-card\b/g, "");

  global.RoadToGlorySquadView = Object.freeze({
    create(deps = {}) {
      const view = previousFactory.create(deps);
      const originalCatalogResultsMarkup = view.catalogResultsMarkup;
      const originalCatalogMarkup = view.catalogMarkup;
      const originalVersionPickerMarkup = view.versionPickerMarkup;

      function catalogResultsMarkup(options = {}) {
        return canonicalizeCatalogCards(originalCatalogResultsMarkup(options));
      }

      function catalogMarkup(options = {}) {
        return canonicalizeCatalogCards(originalCatalogMarkup(options));
      }

      function versionPickerMarkup(options = {}) {
        return canonicalizeVersionCards(originalVersionPickerMarkup(options));
      }

      return Object.freeze({
        ...view,
        catalogResultsMarkup,
        catalogMarkup,
        versionPickerMarkup,
      });
    },
  });
})(globalThis);
