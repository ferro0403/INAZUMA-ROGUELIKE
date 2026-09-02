(function (global) {
  "use strict";
  function create({ app }) {
    function mount(markup) { app.innerHTML = markup; return app.innerHTML; }
    return { mount };
  }
  global.RunMapViewRuntime = { create };
})(globalThis);
