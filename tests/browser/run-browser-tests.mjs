#!/usr/bin/env node
// Nucleo di prove nel browser (Playwright): i comportamenti che contano, giocati come un utente.
// Uso: npm run test:browser            (tutte)
//      npm run test:browser -- boss    (solo quelle col nome che contiene "boss")
// Ogni prova parte da un browser pulito (nessun salvataggio), con ora e casualita' fisse.
import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { startHarness } from "./harness.mjs";
import { tests } from "./core-tests.mjs";

const filters = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const selected = tests.filter((t) => filters.length === 0 || filters.some((f) => t.name.includes(f)));
mkdirSync("test-results", { recursive: true });
const harness = await startHarness();
const results = [];

for (const test of selected) {
  const start = Date.now();
  let error = null;
  const opened = [];
  const ctx = {
    harness,
    assert,
    async game(options) {
      const g = await harness.newGame(options);
      opened.push(g);
      return g;
    },
  };
  try {
    await test.run(ctx);
    const known = test.knownErrors || [];
    for (const g of opened) {
      const unexpected = g.errors.filter((m) => !known.some((re) => re.test(m)));
      assert.deepEqual(unexpected, [], `errori JavaScript nella pagina: ${unexpected.join(" | ")}`);
    }
  } catch (e) {
    error = e;
    for (const [i, g] of opened.entries()) {
      try {
        await g.page.screenshot({ path: `test-results/browser-fail-${test.name}-${i + 1}.png` });
      } catch {}
    }
  } finally {
    for (const g of opened) await g.close().catch(() => {});
  }
  const ms = Date.now() - start;
  results.push({ name: test.name, ok: !error, ms, error: error?.message });
  console.log(`[${error ? "FAIL" : " ok "}] ${test.name} (${(ms / 1000).toFixed(1)}s)${error ? `\n       ${error.message.split("\n")[0]}` : ""}`);
}
await harness.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} prove nel browser superate`);
process.exit(failed.length ? 1 : 0);
