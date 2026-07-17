"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
function loadJsdom() {
  try { return require("jsdom"); } catch (firstError) {
    try { return require("/tmp/inazuma-jsdom/node_modules/jsdom"); } catch (secondError) {
      console.error("jsdom is required. Install it with: npm install --prefix /tmp/inazuma-jsdom --cache /tmp/npm-cache jsdom");
      throw secondError;
    }
  }
}
const { JSDOM, VirtualConsole } = loadJsdom();
const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
assert(!appJs.includes("getTeamIdentity()"), "app.js must not call the missing getTeamIdentity() helper");

const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
const storage = new Map();
const server = http.createServer((request, response) => {
  const requested = new URL(request.url, "http://localhost").pathname;
  const relative = requested === "/" ? "index.html" : requested.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root) || !fs.existsSync(target)) return response.writeHead(404).end("Not found");
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
  const url = `http://127.0.0.1:${server.address().port}/`;
  async function openApp() {
    const dom = await JSDOM.fromURL(url, {
      resources: "usable", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole,
      beforeParse(window) {
        Object.defineProperty(window, "localStorage", { value: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, String(value)),
          removeItem: (key) => storage.delete(key),
          clear: () => storage.clear(),
        }});
        window.fetch = (input, options) => global.fetch(new URL(input, window.location.href), options);
        window.confirm = () => true;
        window.matchMedia = (query) => ({ matches: /max-width:\s*780px/.test(query), media: query, addEventListener() {}, removeEventListener() {} });
      },
    });
    await waitFor(dom.window, ".modern-home");
    return dom;
  }
  let dom = null;
  try {
    dom = await openApp();
    (await waitFor(dom.window, "#new-run")).click();
    const input = await waitFor(dom.window, "#team-name-input");
    input.value = "Raimon Navigation";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    dom.window.document.querySelector("#confirm-team-name").click();
    await waitFor(dom.window, '[data-formation="4-2-4"]');
    dom.window.document.querySelector('[data-formation="4-2-4"]').click();
    for (let choice = 0; choice < 11; choice += 1) (await waitFor(dom.window, "[data-player-id]")).click();
    await waitFor(dom.window, ".squad-screen");
    dom.window.run.phase = "squad";
    dom.window.RunState.save(dom.window.run);
    dom.window.close();

    for (const [selector, label] of [["#home-primary-cta", "hero Continua la run"], ["#continue-run", "card Continua la run"], ["#manage-team-home", "Gestisci squadra"]]) {
      dom = await openApp();
      const hero = dom.window.document.querySelector(".home-hero");
      assert(!dom.window.document.querySelector("#edit-team-name"), "Home must not render #edit-team-name");
      assert(!hero.textContent.includes("Modifica squadra"), "Home hero must not include Modifica squadra");
      assert(hero.textContent.includes("Continua la run"), "Home hero must keep Continua la run");
      assert(hero.textContent.includes("Apri Albo d’Oro"), "Home hero must keep Apri Albo d’Oro");
      (await waitFor(dom.window, selector)).click();
      await waitFor(dom.window, ".squad-screen");
      assert.equal(errors.length, 0, `${label} must open squad without JavaScript errors: ${errors.map((error) => error.message).join("\n")}`);
      dom.window.close();
    }
    console.log("Home navigation test passed: all Home run actions open the squad screen without errors.");
  } finally {
    if (dom) dom.window.close();
    server.close();
  }
});
