(function (global) {
  "use strict";

  function create(deps) {
    function renderTerminalEffectPending(retry) {
      deps.app().innerHTML = `<main class="gameover-screen"><section class="gameover-card" aria-labelledby="terminal-pending-title">
        <div class="gameover-mark" aria-hidden="true">!</div><p class="eyebrow">RICOMPENSA IN ATTESA</p>
        <h1 id="terminal-pending-title">FINALIZZAZIONE NON SALVATA</h1>
        <p class="gameover-copy">La run è al sicuro, ma la ricompensa permanente non è ancora stata registrata. Riprova senza creare una nuova run.</p>
        <div class="gameover-actions"><button type="button" class="btn btn-yellow" id="retry-terminal-effect">RIPROVA</button></div>
      </section></main>`;
      deps.resetScroll();
      document.getElementById("retry-terminal-effect")?.addEventListener("click", retry);
    }

    function renderDevelopmentRewardReveal(presentation, onContinue) {
      const won = presentation.endReason === "victory";
      deps.app().innerHTML = `<main class="development-reward-screen" data-development-reward-reveal><section class="development-reward-panel">
        <header><h1>RICOMPENSE RUN</h1><p>${won ? "RUN COMPLETATA" : "RUN TERMINATA"}</p></header>
        <div class="development-reward-list">
          <article class="development-reward-item">${deps.currencyIcon("coins")}<span><small>MONETE</small><strong data-reward-count="${deps.escapeHtml(presentation.coins)}">+0</strong></span></article>
          ${won ? `<article class="development-reward-item development-reward-cup">${deps.currencyIcon("cups")}<span><small>COPPA SEASON</small><strong>+${deps.escapeHtml(presentation.cups)}</strong></span></article>` : ""}
        </div>
        <button type="button" class="btn btn-yellow development-reward-continue" id="development-reward-continue">CONTINUA</button>
        <p class="development-reward-skip">Tocca per saltare l’animazione</p>
      </section></main>`;
      deps.resetScroll();
      const counter = document.querySelector("[data-reward-count]");
      const target = Number(presentation.coins) || 0;
      const startedAt = performance.now();
      let finished = false;
      const finishAnimation = () => {
        if (finished) return;
        finished = true;
        if (counter) counter.textContent = `+${target}`;
        document.querySelector(".development-reward-panel")?.classList.add("is-complete");
      };
      const tick = (now) => {
        if (finished) return;
        const progress = Math.min(1, (now - startedAt) / 900);
        if (counter) counter.textContent = `+${Math.round(target * progress)}`;
        if (progress < 1) requestAnimationFrame(tick); else finishAnimation();
      };
      requestAnimationFrame(tick);
      document.querySelector("[data-development-reward-reveal]")?.addEventListener("click", finishAnimation);
      document.getElementById("development-reward-continue")?.addEventListener("click", (event) => { event.stopPropagation(); finishAnimation(); onContinue(); });
    }

    function renderGameOver({ bossReached, bossTotal, level, overall, wins, onRestart, onHome }) {
      deps.app().innerHTML = `<main class="gameover-screen"><section class="gameover-card" aria-labelledby="gameover-title">
        <div class="gameover-mark" aria-hidden="true">×</div><p class="eyebrow">0 VITE RIMASTE</p><h1 id="gameover-title">RUN TERMINATA</h1>
        <p class="gameover-copy">La squadra non può più continuare questa run.</p><dl class="gameover-summary">
        <div><dt>Boss raggiunto</dt><dd>${deps.escapeHtml(bossReached)}/${deps.escapeHtml(bossTotal)}</dd></div>
        <div><dt>Livello</dt><dd>${deps.escapeHtml(level)}</dd></div><div><dt>OVR</dt><dd>${deps.escapeHtml(overall)}</dd></div>
        <div><dt>Partite vinte</dt><dd>${deps.escapeHtml(wins)}</dd></div></dl>
        <div class="gameover-actions"><button type="button" class="btn btn-yellow" id="restart-run">NUOVA RUN</button><button type="button" class="btn" id="home">MENU</button></div>
      </section></main>`;
      deps.resetScroll();
      document.getElementById("restart-run").addEventListener("click", onRestart);
      document.getElementById("home").addEventListener("click", onHome);
    }
    return { renderTerminalEffectPending, renderDevelopmentRewardReveal, renderGameOver };
  }
  global.GameOverView = { create };
})(globalThis);
