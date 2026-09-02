(function (global) {
  "use strict";
  function create({ escapeHtml, sectionRootButton }) {
    return Object.freeze({ escapeHtml, sectionRootButton });
  }
  global.HallView = Object.freeze({ create });
})(globalThis);
