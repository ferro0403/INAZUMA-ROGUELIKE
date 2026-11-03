#!/usr/bin/env node
// Esegue tutti i test Node in tests/*.js (uno per processo) e riporta i falliti.
// Uso: node scripts/run-all-tests.mjs [--timeout=180] [--jobs=4] [--json=percorso] [filtro...]
// Un test e' "lento" se passa ma impiega piu' di SLOW_MS; "timeout" se supera il limite.
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cpus } from "node:os";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const TIMEOUT_MS = Number(opt("timeout", "180")) * 1000;
const JOBS = Number(opt("jobs", String(Math.max(1, Math.min(4, cpus().length)))));
const JSON_OUT = opt("json", "");
const SLOW_MS = 20000;
const filters = args.filter((a) => !a.startsWith("--"));

const all = readdirSync("tests")
  .filter((f) => f.endsWith(".js"))
  .sort()
  .filter((f) => filters.length === 0 || filters.some((p) => f.includes(p)));

const results = [];
const tail = (s, n = 1500) => (s.length > n ? s.slice(-n) : s);

function runOne(file) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, [join("tests", file)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; if (out.length > 200000) out = out.slice(-100000); });
    child.stderr.on("data", (d) => { out += d; if (out.length > 200000) out = out.slice(-100000); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      const ms = Date.now() - start;
      let status = code === 0 ? "pass" : "fail";
      if (timedOut) status = "timeout";
      resolve({ file, status, ms, slow: status === "pass" && ms > SLOW_MS, output: status === "pass" ? "" : tail(out) });
    });
  });
}

let next = 0;
async function worker() {
  while (next < all.length) {
    const file = all[next++];
    const r = await runOne(file);
    results.push(r);
    const mark = r.status === "pass" ? (r.slow ? "SLOW" : " ok ") : r.status === "timeout" ? "TIME" : "FAIL";
    process.stdout.write(`[${mark}] ${file} (${(r.ms / 1000).toFixed(1)}s)\n`);
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));

results.sort((a, b) => a.file.localeCompare(b.file));
const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\nTotale ${results.length}: ${count("pass")} passati, ${count("fail")} falliti, ${count("timeout")} in timeout`);
const slow = results.filter((r) => r.slow);
if (slow.length) console.log(`Lenti (passano ma > ${SLOW_MS / 1000}s): ${slow.map((r) => r.file).join(", ")}`);
for (const r of results.filter((x) => x.status !== "pass")) console.log(` - ${r.status.toUpperCase()} ${r.file}`);

if (JSON_OUT) {
  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
}
process.exit(count("fail") + count("timeout") > 0 ? 1 : 0);
