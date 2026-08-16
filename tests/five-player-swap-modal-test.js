const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/five-player-swap-modal.css", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

function expect(value, message) {
  if (!value) throw new Error(message);
}

expect(index.includes("five-player-swap-modal.css"), "swap modal stylesheet must be loaded");
expect(!index.includes("five-formation-floating-picker"), "floating picker assets must not be loaded");
expect(!app.includes("five-selector-floating"), "floating selector state must be absent");
expect(!app.includes("data-five-filter"), "role filters are redundant in a role-specific swap");
expect(app.includes("const openFivePlayerSwap"), "pitch taps must use the dedicated swap flow");
expect(app.includes("openFivePlayerSwap(event.currentTarget.dataset.fiveSlot"), "slot click must directly open the dialog");
expect(app.includes("FiveVFive.assign(run, slotKey"), "FiveVFive.assign must remain the assignment source of truth");
expect(app.includes("String(entry.playerId) !== String(currentId)"), "current starter must be excluded from candidates");
expect(app.includes("fiveRoleForPlayerId(entry.playerId) === slot.role"), "only role-compatible candidates must be rendered");
expect(app.includes("fiveOverallForPlayerId(b.playerId) - fiveOverallForPlayerId(a.playerId)"), "candidates must use resolved effective overall ordering");
expect(css.includes(".five-player-swap-modal.modal"), "a full dedicated modal must be styled");
expect(css.includes("100dvh"), "mobile modal must occupy the available viewport");

console.log("five-player swap modal regression guard OK");
