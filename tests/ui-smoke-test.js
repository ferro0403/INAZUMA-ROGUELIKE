"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM, VirtualConsole } = require("/tmp/inazuma-jsdom/node_modules/jsdom");

const root = path.resolve(__dirname, "..");
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
    assert.equal(errors.length, 0, errors.map((error) => error.message).join("\n"));
    console.log("UI smoke test passed: menu, 4-2-4 draft, squad and route map.");
    dom.window.close();
  } finally {
    server.close();
  }
});
