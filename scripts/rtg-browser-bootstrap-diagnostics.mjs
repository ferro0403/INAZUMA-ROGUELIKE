import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const which = (name) => {
  const r = spawnSync("bash", ["-lc", "command -v " + name], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
};

const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].map(which).find(Boolean);
if (!chrome) throw new Error("Chrome/Chromium not found");

const profile = mkdtempSync(join(tmpdir(), "rtg-chrome-"));
const server = spawn("python3", ["-m", "http.server", "4173"], { stdio: ["ignore", "pipe", "pipe"] });
const browser = spawn(chrome, [
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--remote-debugging-port=9222","--remote-debugging-address=127.0.0.1",
  "--user-data-dir=" + profile,"about:blank"
], { stdio: ["ignore", "pipe", "pipe"] });

const cleanup = () => {
  try { server.kill("SIGTERM"); } catch {}
  try { browser.kill("SIGTERM"); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};

try {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json/list");
      if (res.ok) {
        targets = await res.json();
        if (targets?.[0]?.webSocketDebuggerUrl) break;
      }
    } catch {}
    await sleep(250);
  }
  if (!targets?.[0]?.webSocketDebuggerUrl) throw new Error("DevTools endpoint did not start");

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP websocket timeout")), 5000);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP websocket error")); }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const exceptions = [];
  const consoleErrors = [];
  const networkFailures = [];
  const responses = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails || {};
      exceptions.push({
        text: d.text, url: d.url, line: d.lineNumber, column: d.columnNumber,
        exception: d.exception?.description || d.exception?.value || "",
        stack: d.stackTrace?.callFrames?.slice(0, 8) || []
      });
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
      consoleErrors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (msg.method === "Log.entryAdded" && ["error","warning"].includes(msg.params?.entry?.level)) {
      consoleErrors.push(msg.params.entry.text);
    }
    if (msg.method === "Network.loadingFailed") {
      networkFailures.push({ requestId: msg.params.requestId, errorText: msg.params.errorText, type: msg.params.type, blockedReason: msg.params.blockedReason || "" });
    }
    if (msg.method === "Network.responseReceived") {
      const response = msg.params?.response;
      if (response && response.status >= 400) responses.push({ status: response.status, url: response.url });
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:4173/" });
  await sleep(15000);

  const expression = '(() => ({readyState:document.readyState,title:document.title,bodyText:document.body?.innerText||"",loading:!!document.querySelector(".loading-screen"),appHtml:document.getElementById("app")?.innerHTML||"",globals:{AppUiShell:!!globalThis.AppUiShell,AppBootstrapRuntime:!!globalThis.AppBootstrapRuntime,HomeController:!!globalThis.HomeController,RunRosterRuntime:!!globalThis.RunRosterRuntime,PlayerView:!!globalThis.PlayerView,RoadToGloryController:!!globalThis.RoadToGloryController}}))()';
  const state = await send("Runtime.evaluate", { expression, returnByValue: true });
  const value = state?.result?.value || {};
  console.log("BOOT_STATE", JSON.stringify(value, null, 2));
  console.log("EXCEPTIONS", JSON.stringify(exceptions, null, 2));
  console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors.slice(-30), null, 2));
  console.log("HTTP_ERRORS", JSON.stringify(responses.slice(-30), null, 2));
  console.log("NETWORK_FAILURES", JSON.stringify(networkFailures.slice(-30), null, 2));

  if (value.loading) {
    console.error("BOOTSTRAP_STUCK_LOADING");
    process.exitCode = 1;
  } else {
    console.log("BOOTSTRAP_EXITED_LOADING_SCREEN");
  }
} finally {
  cleanup();
}
