#!/usr/bin/env node
// Misura il CSS morto: visita tutte le schermate (screenshot + prove nel browser) registrando i selettori usati,
// poi scrive docs/CSS_MORTO.md e test-results/css-usage/report.json.
// Uso: npm run css:usage      (circa 11 minuti)
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const OUT = "test-results/css-usage/raw";
rmSync(OUT, { recursive: true, force: true });
const env = { ...process.env, CSS_USAGE_OUT: OUT };
const run = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env });

run(["scripts/screenshots/capture.mjs", "--out=test-results/css-usage/screenshots", "--allow-incomplete"]);
const browser = run(["tests/browser/run-browser-tests.mjs"]);
if (browser.status !== 0) console.warn("ATTENZIONE: alcune prove nel browser sono fallite, la misura puo' essere incompleta.");
const report = run(["scripts/css/css-usage-report.mjs", OUT, "--md=docs/CSS_MORTO.md", "--json=test-results/css-usage/report.json"]);
process.exit(report.status ?? 1);
