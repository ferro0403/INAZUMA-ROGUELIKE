const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/five-formation-floating-picker.css", "utf8");
const js = fs.readFileSync("js/five-formation-floating-picker.js", "utf8");

function expect(value, message) {
  if (!value) throw new Error(message);
}

expect(index.includes("five-formation-floating-picker.css"), "floating picker stylesheet must be loaded");
expect(index.includes("five-formation-floating-picker.js"), "floating picker bridge must be loaded");
expect(css.includes(".five-layout > .five-selector"), "legacy in-flow selector must be hidden");
expect(css.includes(".five-selector.five-selector-floating.is-open"), "picker must expose an explicit floating open state");
expect(css.includes("#clear-five-slot"), "clear-slot control must be hidden in contextual picker");
expect(js.includes("fieldPanel.appendChild(picker)"), "existing selector must be moved over the pitch rather than duplicated");
expect(js.includes("roleFilters.hidden = true"), "role filters must not be shown in contextual picker");
expect(js.includes("clearButton.hidden = true"), "slot removal must not be shown in contextual picker");
expect(js.includes("[data-five-player]"), "existing player assignment buttons must drive the picker");
expect(js.includes("[data-five-slot]"), "pitch slot taps must open the contextual picker");

console.log("five-formation floating picker regression guard OK");
