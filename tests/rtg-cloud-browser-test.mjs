// Optional real Chromium persistence test. No Firebase SDK, auth or remote calls.
// Run from the repository: node tests/rtg-cloud-browser-test.mjs
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : ['chromium', 'google-chrome', 'google-chrome-stable', 'chromium-browser'];
const chromePath = candidates.map(name => { const value = spawnSync('which', [name], { encoding: 'utf8' }); return value.status === 0 ? value.stdout.trim() : null; }).find(Boolean);
if (!chromePath) throw Error('Chrome/Chromium unavailable: real browser checks NOT executed');
const profile = mkdtempSync(join(tmpdir(), 'rtg-cloud-verification-'));
const server = createServer((request, response) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
try {
  const activePort = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(activePort); i++) await delay(100);
  if (!existsSync(activePort)) throw Error('Chromium failed to start');
  const port = readFileSync(activePort, 'utf8').split('\n')[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data); const request = pending.get(message.id);
    if (!request) return; pending.delete(message.id);
    message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/tests/fixtures/rtg-cloud-browser.html` });
  let result;
  for (let i = 0; i < 100; i++) {
    const evaluation = await send('Runtime.evaluate', { expression: 'window.testResult || null', awaitPromise: true, returnByValue: true });
    result = evaluation.result?.value; if (result) break; await delay(100);
  }
  console.log(JSON.stringify(result, null, 2));
  if (result?.status !== 'PASS') throw Error(result?.message || 'Browser result timeout');
} finally {
  socket?.close(); browser.kill('SIGTERM'); server.close(); await delay(200);
  rmSync(profile, { recursive: true, force: true });
}
