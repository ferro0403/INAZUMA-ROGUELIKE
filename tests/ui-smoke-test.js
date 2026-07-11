"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM, VirtualConsole } = require("/tmp/inazuma-jsdom/node_modules/jsdom");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
assert(/@media \(max-width: 780px\)[\s\S]*?\.route-map[\s\S]*?min-width:\s*0/.test(css), "mobile route map must not keep the desktop 620px min width");
assert(/@media \(max-width: 780px\)[\s\S]*?\.map-wrap[\s\S]*?overflow-x:\s*hidden/.test(css), "mobile map wrapper must hide horizontal overflow");
assert(/@media \(max-width: 780px\)[\s\S]*?\.pitch-row\s*\{[^}]*--pitch-card-size:[^}]*display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(var\(--players-in-row, 1\), minmax\(0, var\(--pitch-card-size\)\)\)/.test(css), "mobile pitch rows must keep a constant card width while changing only player distribution");
assert(/@media \(max-width: 780px\)[\s\S]*?\.player-detail-modal\s*\{[\s\S]*?justify-self:\s*center[\s\S]*?width:\s*min\(100%, calc\(100vw - 24px\)\)/.test(css), "mobile player detail modal must be centered without lateral overflow");
assert(css.includes("grid-template-columns: repeat(4, minmax(0, 1fr))"), "mobile bottom nav must show four uniform items");
assert(css.includes("align-items: center"), "desktop fullbody visual should not be pinned to the bottom");
assert(css.includes("width: min(100%, 560px)"), "desktop fullbody art should be larger");
assert(css.includes("object-fit: contain"), "fullbody art should not deform");
assert(css.includes("width: min(90%, 340px)"), "mobile fullbody art should be larger without overflow");
const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

const server = http.createServer((request, response) => {
  const requested = new URL(request.url, "http://localhost").pathname;
  const relative = requested === "/" ? "index.html" : requested.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root) || !fs.existsSync(target)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
  fs.createReadStream(target).pipe(response);
});

function waitFor(window, selector, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const element = window.document.querySelector(selector);
      if (element) return resolve(element);
      if (Date.now() - started > timeout) return reject(new Error(`Timed out waiting for ${selector}`));
      setTimeout(check, 25);
    };
    check();
  });
}

server.listen(0, "127.0.0.1", async () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  virtualConsole.on("error", (error) => errors.push(error));

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/`;
    const dom = await JSDOM.fromURL(url, {
      resources: "usable",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        window.fetch = (input, options) => global.fetch(new URL(input, window.location.href), options);
        window.confirm = () => true;
        window.matchMedia = (query) => ({ matches: /max-width:\s*780px/.test(query), media: query, addEventListener() {}, removeEventListener() {} });
      },
    });

    const { window } = dom;
    (await waitFor(window, "#new-run")).click();
    (await waitFor(window, '[data-formation="4-2-4"]')).click();
    for (let choice = 0; choice < 11; choice += 1) {
      (await waitFor(window, "[data-player-id]")).click();
    }
    await waitFor(window, "#go-map");
    assert(window.document.body.textContent.includes("Gestione squadra"));
    const rowCounts = [...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length);
    assert.deepEqual(rowCounts, [4, 2, 4, 1], "4-2-4 must keep 4 / 2 / 4 / 1 visual rows");
    assert([...window.document.querySelectorAll(".pitch-row")].every((row) => row.getAttribute("style").includes(`--players-in-row:${row.children.length || 1}`)));
    assert(css.includes("var(--pitch-card-size)"), "card width must stay constant for one- and two-player rows");
    assert.equal(window.document.querySelectorAll(".bottom-nav [data-nav]").length, 4, "bottom nav must expose four destinations");
    const squadSignature = [...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length).join("/");
    window.document.querySelector('[data-nav="inventory"]').click();
    await waitFor(window, ".item-grid");
    assert(window.document.querySelector('[data-nav="inventory"]').classList.contains("active"));
    window.document.querySelector('[data-nav="five"]').click();
    await waitFor(window, ".five-screen");
    assert(window.document.body.textContent.includes("Formazione 5v5"));
    assert(window.document.body.textContent.includes("1-2-1"));
    assert(window.document.body.textContent.includes("1-1-2"));
    assert(window.document.querySelector('[data-nav="five"]').classList.contains("active"), "5v5 nav item must be active");
    assert.equal(window.document.querySelectorAll(".five-slot").length, 5, "5v5 pitch must render exactly five slots");
    assert(window.document.querySelector(".five-validation.valid"), "auto-created 1-2-1 must be valid after draft");
    window.document.querySelector('[data-five-formation="1-1-2"]').click();
    await waitFor(window, ".five-formation-card.selected");
    assert(window.document.querySelector('[data-five-formation="1-1-2"]').classList.contains("selected"));
    window.document.querySelector("#clear-five-slot").click();
    await waitFor(window, ".five-validation.invalid");
    assert(window.document.querySelector("#save-five").disabled, "incomplete 5v5 formation cannot be saved");
    window.document.querySelector('[data-nav="squad"]').click();
    await waitFor(window, ".pitch-row");
    assert.equal([...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length).join("/"), squadSignature, "5v5 editing must not alter 11v11 rows");
    window.document.querySelector("[data-squad-player]").click();
    await waitFor(window, ".player-detail-modal");
    assert(window.document.querySelector(".player-fullbody").src.includes("_fullbody.webp"));
    assert.equal(window.document.querySelectorAll(".detail-stat").length, 8);
    assert(window.document.body.textContent.includes("Potenziale"));
    window.document.querySelector("[data-close-modal]").click();
    window.document.querySelector("#go-map").click();
    await waitFor(window, ".route-map");
    assert(window.document.querySelectorAll(".map-node").length > 8);
    assert(window.document.querySelectorAll(".map-node.reachable").length > 0);
    assert(css.includes(".trade-squad-layout"), "trade modal should use tactical pitch layout styles");
    assert(window.document.documentElement.innerHTML.includes("bottom-nav"));
    const mapScroll = window.document.querySelector("#map-scroll");
    mapScroll.scrollLeft = 99;
    window.document.querySelector(".map-node.reachable").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(mapScroll.scrollLeft, 99, "node click must not alter horizontal map scroll");
    assert.equal(errors.length, 0, errors.map((error) => error.message).join("\n"));
    console.log("UI smoke test passed: menu, 4-2-4 draft, squad and route map.");
    dom.window.close();
  } finally {
    server.close();
  }
});
