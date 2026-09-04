(function (global) {
  "use strict";
  function create({ enterMatch, openPull, openItem, openTrade }) {
    function dispatch(node, eventType, context = {}) {
      if (["five_v_five", "special_match", "boss"].includes(eventType)) return enterMatch(node, eventType, context);
      if (eventType.startsWith("pull_")) return openPull(node, eventType);
      if (eventType === "item") return openItem(node);
      if (eventType === "trade") return openTrade(node);
    }
    return { dispatch };
  }
  global.MapNodeRouterRuntime = { create };
})(globalThis);
