(function (global) {
  "use strict";
  function create(deps) {
    return Object.freeze({ escapeHtml: deps.escapeHtml, sectionRootButton: deps.sectionRootButton, playerCard: deps.playerCard });
  }
  global.AlbumView = Object.freeze({ create });
})(globalThis);
