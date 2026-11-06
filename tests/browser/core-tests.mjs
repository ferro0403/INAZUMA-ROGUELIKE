// Le 11 prove del nucleo fidato (concordate con l'utente il 3 novembre 2026).
// Ogni prova descrive in italiano cosa controlla. Se una prova fallisce, lo screenshot del momento
// viene salvato in test-results/browser-fail-<nome>.png.

const SEED_BOSS_WIN = 0x2f6b1a3d; // con questo seme la prima run vince il boss Occult
const SEED_BOSS_LOSS = 8; // con questo seme la prima run perde il boss Occult
const RTG_MAX_OVERALL = 74; // la prima partita RTG accetta una rosa con potenza massima 75

async function openFirstMap(g) {
  await g.startClassicRun();
  await g.click("#go-map");
  await g.visible(".map-node.reachable");
}

async function runLives(g) {
  return g.page.evaluate(() => globalThis.RunState.load("ie1")?.lives);
}

export const tests = [
  {
    name: "01-avvio",
    // Il gioco si avvia senza errori JavaScript e mostra la home con le sezioni del club.
    async run({ game, assert }) {
      const g = await game();
      for (const id of ["#home-primary-cta", "#open-shop-home", "#open-development-home", "#open-album-home"]) {
        assert.ok(await g.isVisible(id), `manca ${id} nella home`);
      }
    },
  },
  {
    name: "02-run-nuova-fino-alla-mappa",
    // Run classica: nome squadra -> modulo -> draft completo -> squadra valida -> mappa con il boss.
    async run({ game, assert }) {
      const g = await game();
      await g.startClassicRun();
      const lineup = await g.page.locator(".tactical-player-card").locator("visible=true").count();
      assert.ok(lineup >= 11, `in squadra ci sono ${lineup} carte, ne servono almeno 11`);
      await g.click("#go-map");
      assert.ok(await g.visible(".map-node.boss-node"), "la mappa non mostra il boss");
      assert.ok((await g.page.locator(".map-node.reachable").count()) > 0, "nessun nodo raggiungibile");
    },
  },
  {
    name: "03-run-partita-5v5",
    // Si entra in un nodo 5v5, si simula la partita, si torna alla mappa e il nodo risulta fatto.
    async run({ game, assert }) {
      const g = await game();
      await openFirstMap(g);
      await g.click(".map-node.reachable[data-node-type=five_v_five]");
      await g.playOpenMatch();
      await g.click("#continue-match-result");
      await g.visible(".map-node");
      const done = await g.page.locator(".map-node.completed[data-node-type=five_v_five]").count();
      assert.equal(done, 1, "il nodo 5v5 giocato non risulta completato");
    },
  },
  {
    name: "04-run-boss-vittoria",
    // Si attraversa la mappa, si gioca il boss e, vincendo, arriva l'offerta del giocatore premio.
    async run({ game, assert }) {
      const g = await game({ seed: SEED_BOSS_WIN });
      await openFirstMap(g);
      await g.walkToBoss();
      await g.click(".map-node.boss-node.reachable");
      await g.playOpenMatch();
      await g.click("#continue-match-result");
      assert.ok(await g.visible("#skip-offer"), "dopo la vittoria non compare l'offerta del premio");
    },
  },
  {
    name: "04b-run-boss-sconfitta",
    // Perdendo il boss si torna alla mappa con una vita in meno (e la run continua).
    async run({ game, assert }) {
      const g = await game({ seed: SEED_BOSS_LOSS });
      await openFirstMap(g);
      await g.walkToBoss();
      const before = await runLives(g);
      await g.click(".map-node.boss-node.reachable");
      await g.playOpenMatch();
      await g.click("#continue-match-result");
      await g.visible(".map-node");
      const after = await runLives(g);
      assert.ok(after < before, `vite prima ${before}, dopo ${after}: la sconfitta non ha tolto una vita`);
      assert.ok(after > 0, "la run e' finita, ci si aspettava che continuasse");
      assert.ok(!(await g.isVisible("#skip-offer")), "dopo una sconfitta non deve esserci l'offerta del premio");
    },
  },
  {
    name: "05-ogni-season-si-carica",
    // Ogni season della selezione si avvia: draft, squadra e mappa con il suo boss.
    async run({ game, assert }) {
      const probe = await game();
      await probe.click("#home-primary-cta");
      const count = await probe.page.locator("text=INIZIA NUOVA RUN").locator("visible=true").count();
      await probe.close();
      assert.ok(count >= 5, `nella selezione ci sono ${count} season, ne servono 5`);
      const bosses = [];
      for (let i = 0; i < count; i += 1) {
        const g = await game();
        await g.startClassicRun(i);
        await g.click("#go-map");
        await g.visible(".map-node.boss-node");
        bosses.push(await g.text("#open-boss-preview"));
        assert.deepEqual(g.errors, [], `errori JavaScript nella season ${i + 1}`);
        await g.close();
      }
      assert.equal(new Set(bosses).size >= 2, true, `le season sembrano tutte uguali: ${bosses.join(" / ")}`);
    },
  },
  {
    name: "06-rtg-partita-completa",
    // BUG NOTO (segnalato il 3 nov 2026, non ancora corretto): il pulsante "Conferma e riparti" dell'intervallo
    // ha due gestori del clic (rtg-match-view.js e rtg-controller.js), quindi l'intervallo viene confermato due
    // volte e la seconda lancia "RTG halftime unavailable". Togliere questa riga quando il bug e' corretto.
    knownErrors: [/RTG halftime unavailable/],
    // RTG: con 15+ svincolati si apre la mappa, si prepara la partita e la si gioca fino al risultato.
    async run({ game, assert }) {
      const g = await game({ flowingClock: true });
      await g.unlockAllFreeAgents({ maxOverall: RTG_MAX_OVERALL });
      await g.click("[data-rtg-home-open=campaigns]");
      await g.click("[data-rtg-campaign=rtg-ie-trilogy]");
      await g.click("[data-rtg-current-node]");
      await g.click("[data-rtg-start-node]:not([disabled])");
      await g.click("[data-rtg-prematch-start]");
      const result = await g.playRtgMatch();
      assert.ok(result, "la partita RTG non e' arrivata al risultato");
      await g.click("[data-rtg-result-continue]");
      assert.ok(await g.visible("[data-rtg-current-node]"), "dopo la partita non si torna alla mappa RTG");
    },
  },
  {
    name: "07-rtg-card-e-coach",
    // RTG: si apre la scheda di un giocatore della squadra e la scheda di un allenatore.
    async run({ game, assert }) {
      const g = await game();
      await g.unlockAllFreeAgents({ maxOverall: RTG_MAX_OVERALL });
      await g.click("[data-rtg-home-open=campaigns]");
      await g.click("[data-rtg-campaign=rtg-ie-trilogy]");
      await g.click("[data-rtg-tab=squad]");
      await g.click("[data-rtg-player-detail]");
      await g.waitText("#modal-root", /STATISTICHE/i); // la scheda giocatore mostra le statistiche
      await g.click("#modal-root [data-close-modal], #modal-root .modal-close");
      await g.click("[data-rtg-open-coaches]");
      await g.click("[data-rtg-coach-detail]");
      await g.waitText("#modal-root", /POTERE ALLENATORE/i); // la scheda allenatore mostra il potere
    },
  },
  {
    name: "08-coach-potere",
    // Evento Halloween: si ottiene l'allenatore Hekyll Jyde dal distributore, lo si assegna alla squadra,
    // si configura il suo potere su un titolare Halloween e il valore dei requisiti cambia.
    async run({ game, assert }) {
      const g = await game({ dev: true });
      await g.unlockAllFreeAgents({ maxOverall: RTG_MAX_OVERALL });
      await g.click("[data-rtg-home-open=campaigns]");
      await g.click("[data-rtg-halloween-open]");
      await g.devHalloweenPumpkins();
      const coachSpin = await g.spinHalloweenUntilCoach();
      assert.ok(coachSpin >= 0, "il distributore Halloween non ha dato l'allenatore");
      const result = await g.configureHalloweenCoachPower();
      // Il titolare Halloween conta 15 OVR in meno nei requisiti: l'overall mostrato deve scendere,
      // e deve coincidere con l'anteprima mostrata nel dialogo del potere.
      assert.ok(Number(result.after) < Number(result.before), `overall prima ${result.before}, dopo ${result.after}`);
      assert.ok(result.preview.includes(`${result.before} → ${result.after}`), `anteprima diversa: ${result.preview}`);
    },
  },
  {
    name: "09-evento-halloween",
    // Evento Halloween: si apre, la squadra e' valida, card giocatore e allenatori si vedono, il distributore si apre.
    async run({ game, assert }) {
      const g = await game();
      await g.unlockAllFreeAgents();
      await g.click("[data-rtg-home-open=campaigns]");
      await g.click("[data-rtg-halloween-open]");
      await g.waitText("#app", /Formazione valida/i); // la squadra dell'evento risulta valida
      await g.click(".tactical-player-card");
      await g.waitText("#modal-root", /STATISTICHE/i); // la card giocatore Halloween si apre
      await g.click("#modal-root [data-close-modal], #modal-root .modal-close");
      await g.click("[data-halloween-open-vending]");
      assert.ok(await g.visible("[data-halloween-pull]"), "il distributore stregato non si apre");
      await g.click("[data-halloween-close-vending]");
      await g.click("[data-halloween-tab=squad]");
      await g.click("[data-rtg-open-coaches]");
      await g.waitText("#modal-root", /Hekyll Jyde/i); // l'allenatore dell'evento compare
    },
  },
  {
    name: "10-salvataggi",
    // Una run salvata si riprende dopo aver ricaricato la pagina; un salvataggio vecchio senza seasonId
    // viene letto come Season 1 con le vite riportate a 2 e riparte dalla fase in cui era.
    async run({ harness, game, assert }) {
      const g = await game();
      await openFirstMap(g);
      const path = await g.page.locator(".map-node").evaluateAll((nodes) => nodes.map((n) => n.dataset.nodeId).join(","));
      // Ricaricando la pagina la home offre "Continua la run", che riporta alla stessa mappa.
      await g.reload();
      assert.match(await g.text("#home-primary-cta"), /continua la run/i, "la home non offre di continuare la run");
      await g.click("#home-primary-cta");
      await g.visible(".map-node");
      const again = await g.page.locator(".map-node").evaluateAll((nodes) => nodes.map((n) => n.dataset.nodeId).join(","));
      assert.equal(again, path, "la mappa ripresa non e' quella salvata");
      assert.match(await g.text("body"), /Squadra Test/, "la run ripresa non e' quella salvata");

      const old = await game();
      await old.page.evaluate(() => {
        localStorage.setItem(globalThis.SEASON1_CONFIG.saveKey, JSON.stringify({
          version: 2, runId: "legacy", phase: "formation", lives: 3, bossIndex: 0, roster: [], lineup: [], bench: [],
          inventory: [], completedBossIds: [], unlockedTeamIds: [], activeMatch: null, currentZone: null, postBossFlow: null,
        }));
      });
      await old.reload();
      const legacy = await old.page.evaluate(() => {
        const run = globalThis.RunState.load("ie1");
        return { seasonId: run?.seasonId, lives: run?.lives };
      });
      assert.deepEqual(legacy, { seasonId: "ie1", lives: 2 }, "il salvataggio vecchio non viene letto come Season 1");
      // Il salvataggio vecchio era fermo alla scelta del modulo: riprendendolo si torna li'.
      await old.click("#home-primary-cta");
      assert.ok(await old.visible(".formation-card"), "il salvataggio vecchio non riparte dalla scelta del modulo");
    },
  },
  {
    name: "11-negozio-sviluppo-album",
    // Si compra un Progetto Buono nel negozio, lo si usa nel Centro di sviluppo per evolvere un giocatore,
    // e un giocatore ottenuto nel draft compare come sbloccato nell'album.
    async run({ game, assert }) {
      const g = await game({ dev: true });
      await g.unlockAllFreeAgents();
      await g.click("#open-shop-home");
      await g.click("[data-shop-coins='1000']");
      await g.click("[data-shop-cups=ie1][data-amount='5']");
      const projectCard = "[class*=project]:has([data-buy-project=Buono])";
      await g.waitText("[class*=wallet]", /MONETE\s*1000/); // monete di prova arrivate
      await g.waitText(projectCard, /Posseduti\s*×0/); // si parte senza progetti
      await g.click("[data-buy-project=Buono]");
      await g.click(".shop-buy-modal__confirm");
      await g.waitText(projectCard, /Posseduti\s*×1/); // l'acquisto aggiunge il progetto
      await g.waitText("[class*=wallet]", /MONETE\s*750/); // e scala 250 monete

      await g.click(".shop-back");
      await g.click("#open-development-home");
      await g.click("[data-development-card]");
      const before = await g.text("[data-development-selected-card]");
      await g.click("#prepare-evolution:not([disabled])");
      await g.click("#confirm-evolution");
      await g.page.waitForTimeout(800);
      const after = await g.text("[data-development-selected-card]");
      assert.notEqual(after, before, "l'evoluzione non ha cambiato il giocatore");
      await g.waitText("#app", /PROGETTI\s*0/); // il progetto e' stato consumato

      const fresh = await game();
      await fresh.click("#open-album-home");
      await fresh.waitText("#app", /Inazuma Eleven 1 0 \/ \d+ giocatori sbloccati/); // account nuovo: album vuoto
      await fresh.click("[data-section-root], .section-root-button");
      await openFirstMap(fresh);
      await fresh.click("[data-section-root]");
      await fresh.click(".season-select-home-button");
      await fresh.click("#open-album-home");
      await fresh.waitText("#app", /Inazuma Eleven 1 11 \/ \d+ giocatori sbloccati/); // gli 11 del draft compaiono
    },
  },
  {
    name: "12-evento-finto",
    // Passo 3.5: l'evento finto (data/events/dev/prova_dev.json) si apre solo con ?dev=1&evento=prova_dev,
    // funziona con lo stesso modulo di Halloween e NON scrive mai l'account vero (shared:account).
    async run({ game, assert }) {
      const normal = await game({ dev: true });
      assert.equal(await normal.page.evaluate(() => window.GameEvents.get("prova_dev")), null,
        "senza ?evento= l'evento finto non si carica");
      assert.equal(await normal.page.evaluate(() => window.RoadToGloryHalloween.EVENT_ID), "halloween2026");

      const g = await game({ dev: true, query: "evento=prova_dev" });
      assert.equal(await g.page.evaluate(() => window.RoadToGloryHalloween.EVENT_ID), "prova_dev",
        "con ?evento=prova_dev si usa l'evento finto");
      await g.unlockAllFreeAgents();
      const REAL = "shared:account", DEV = "dev:prova_dev:shared:account";
      const before = await g.readRtgRecords([REAL, DEV]);
      assert.equal(before[DEV] ?? null, null, "il salvataggio finto parte vuoto");
      await g.click("[data-rtg-home-open=campaigns]");
      await g.click("[data-rtg-halloween-open]");
      await g.waitText("#app", /Formazione valida/i);
      await g.devHalloweenPumpkins();
      await g.click("[data-halloween-open-vending]");
      await g.click("[data-halloween-pull]:not([disabled])");
      await g.page.locator("[data-rtg-pull-continue], [data-rtg-coaches-collection]").locator("visible=true").first()
        .waitFor({ timeout: 20000 });
      const after = await g.readRtgRecords([REAL, DEV]);
      assert.deepEqual(after[REAL] ?? null, before[REAL] ?? null, "l'account vero non e' cambiato");
      const ledger = after[DEV]?.events?.prova_dev;
      assert.ok(ledger, "lo stato dell'evento finto sta in dev:...:shared:account, campo events.prova_dev");
      assert.equal(ledger.pullCount, 1, "una capsula aperta");
      assert.equal(ledger.balance, 99999 - 200, "prezzo della capsula dal file dell'evento");
      assert.equal(after[DEV].halloween, undefined, "l'evento finto non tocca lo stato di Halloween");
      const won = (after[DEV].gachaAcquiredCards || []).filter((c) => String(c.cardId).startsWith("prova_dev::"));
      const coach = (after[DEV].coachOwnedIds || []).length > (before[REAL]?.coachOwnedIds || []).length;
      assert.ok(won.length === 1 || coach, "la capsula ha dato una carta dell'evento finto o l'allenatore");
    },
  },
];
