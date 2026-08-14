(function (global) {
  "use strict";

  function displayRows(formation) {
    if (Array.isArray(formation?.rows) && formation.rows.length) {
      return formation.rows.map((slots) => {
        const displayRole = String(slots[0] || "");
        const role = String(formation.displayRoleMap?.[displayRole] || displayRole);
        return { role, ...(displayRole !== role ? { displayRole } : {}), count: slots.length };
      });
    }
    return ["FW", "MF", "DF", "GK"].map((role) => ({ role, count: Number(formation?.requirements?.[role] || 0) })).filter((row) => row.count);
  }

  global.FormationLayout = { displayRows };
})(globalThis);
