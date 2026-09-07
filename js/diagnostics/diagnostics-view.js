(function (global) {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 102400 ? 0 : 1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function shortCommit(value) {
    const string = String(value || "");
    return string ? (string.length > 16 ? `${string.slice(0, 8)}…${string.slice(-6)}` : string) : "-";
  }

  function create({ escape = escapeHtml } = {}) {
    function card(title, body) {
      return `<section class="panel"><p class="eyebrow">${escape(title)}</p>${body}</section>`;
    }

    function failureMarkup(failure) {
      if (!failure) return card("ULTIMO ERRORE", '<h3>Nessun errore di salvataggio</h3><p class="muted">Se un salvataggio fallisce, qui restano causa, stage e stato della run.</p>');
      const generation = failure.generation || {};
      const match = failure.match || {};
      const cause = failure.error?.cause;
      return card("ULTIMO ERRORE", `<h3>${escape(failure.error?.code || failure.error?.name || "Errore sconosciuto")}</h3><p class="muted">${escape(failure.error?.message || "")}</p>${cause ? `<p class="muted"><strong>Causa interna:</strong> ${escape(cause.name || "Error")} · ${escape(cause.code || cause.message || "-")}</p>` : ""}<div class="stat-grid"><div class="stat-card"><span>Azione</span><strong>${escape(failure.label || "-")}</strong></div><div class="stat-card"><span>Stage</span><strong>${escape(failure.stage || failure.error?.stage || "-")}</strong></div><div class="stat-card"><span>Generation RAM</span><strong>${escape(generation.memory ?? "-")}</strong></div><div class="stat-card"><span>Generation canonica</span><strong>${escape(generation.canonical ?? "-")}</strong></div><div class="stat-card"><span>Commit RAM</span><strong>${escape(shortCommit(failure.commitId?.memory))}</strong></div><div class="stat-card"><span>Commit canonico</span><strong>${escape(shortCommit(failure.commitId?.canonical))}</strong></div><div class="stat-card"><span>Partita</span><strong>${escape(match.type || "-")}</strong></div><div class="stat-card"><span>Stato partita</span><strong>${escape(match.simulationState || match.state || "-")}</strong></div><div class="stat-card"><span>Resolution</span><strong>${match.resolutionApplied === true ? "SÌ" : match.resolutionApplied === false ? "NO" : "-"}</strong></div><div class="stat-card"><span>Post-navigation</span><strong>${match.postMatchNavigationApplied === true ? "SÌ" : match.postMatchNavigationApplied === false ? "NO" : "-"}</strong></div></div>`);
    }

    function storageMarkup(report) {
      const storage = report.storage || {};
      const estimate = storage.browserEstimate;
      const top = (storage.topInazumaKeys || []).slice(0, 6);
      return card("SPAZIO LOCALE", `<div class="stat-grid"><div class="stat-card"><span>localStorage</span><strong>${escape(formatBytes(storage.localStorageMeasuredBytes))}</strong></div><div class="stat-card"><span>Albo d’Oro</span><strong>${escape(formatBytes(storage.hallBytes))}</strong><small>${escape(storage.hallSharePercent || 0)}% del totale</small></div><div class="stat-card"><span>Development</span><strong>${escape(formatBytes(storage.developmentBytes))}</strong></div><div class="stat-card"><span>Album</span><strong>${escape(formatBytes(storage.albumBytes))}</strong></div>${storage.browserFamily ? `<div class="stat-card"><span>Browser</span><strong>${escape(storage.browserFamily)}</strong></div>` : ""}${estimate ? `<div class="stat-card"><span>Quota stimata browser</span><strong>${escape(formatBytes(estimate.quota))}</strong></div>` : ""}</div>${top.length ? `<div class="panel" style="margin-top:12px"><p class="eyebrow">CHIAVI PIÙ PESANTI</p>${top.map((entry) => `<p class="muted" style="display:flex;justify-content:space-between;gap:12px"><span>${escape(entry.key)}</span><strong>${escape(formatBytes(entry.bytes))}</strong></p>`).join("")}</div>` : ""}`);
    }

    function eventsMarkup(events) {
      const visible = (events || []).slice(-6).reverse();
      if (!visible.length) return card("EVENTI RECENTI", '<p class="muted">Nessun errore JavaScript o evento diagnostico registrato.</p>');
      return card("EVENTI RECENTI", visible.map((entry) => `<p class="muted"><strong>${escape(entry.type)}</strong> · ${escape(entry.detail?.message || entry.detail?.label || entry.detail?.error?.code || "evento registrato")}<br><small>${escape(new Date(entry.at).toLocaleString("it-IT"))}</small></p>`).join(""));
    }

    function probeMarkup(probe) {
      if (!probe) return card("TEST DI SCRITTURA", '<p class="muted">Prova scritture temporanee da 16 KB, 64 KB e 256 KB. La chiave viene rimossa subito.</p>');
      return card("TEST DI SCRITTURA", `<div class="stat-grid">${probe.results.map((item) => `<div class="stat-card"><span>${escape(formatBytes(item.sizeBytes))}</span><strong>${item.ok ? "OK" : "FALLITO"}</strong>${item.error ? `<small>${escape(item.error.code || item.error.name || item.error.message)}</small>` : ""}</div>`).join("")}</div>`);
    }

    function markup(report) {
      return `<div class="modal-head"><div><p class="eyebrow">DIAGNOSTICA GIOCO</p><h2>${escape(report.classification.title)}</h2><p class="muted">${escape(report.classification.detail)}</p></div></div>${failureMarkup(report.lastFailure)}${storageMarkup(report)}${eventsMarkup(report.recentEvents)}${probeMarkup(report.probe)}${report.diagnosticWriteError ? card("LOG DIAGNOSTICO", `<h3>Il log non è entrato in localStorage</h3><p class="muted">${escape(report.diagnosticWriteError.error?.code || report.diagnosticWriteError.error?.name || "Errore storage")}</p>`) : ""}<div class="button-row"><button type="button" class="btn btn-yellow" id="game-diagnostics-probe">TESTA SPAZIO LOCALE</button><button type="button" class="btn" id="game-diagnostics-copy">COPIA REPORT</button><button type="button" class="btn" id="game-diagnostics-clear">AZZERA LOG</button></div>`;
    }

    return Object.freeze({ markup, formatBytes, shortCommit });
  }

  global.GameDiagnosticsView = Object.freeze({ create });
})(globalThis);
