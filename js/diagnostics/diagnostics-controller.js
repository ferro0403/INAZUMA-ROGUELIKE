(function (global) {
  "use strict";

  function create({ runtime, storage, view }) {
    let uiShell = null;

    function setUiShell(shell) {
      uiShell = shell || null;
      return uiShell;
    }

    async function copyReport(report) {
      const value = JSON.stringify(report, null, 2);
      try {
        if (!global.navigator?.clipboard?.writeText) throw new Error("clipboard-unavailable");
        await global.navigator.clipboard.writeText(value);
      } catch (_) {
        const textarea = global.document?.createElement?.("textarea");
        if (textarea) {
          textarea.value = value;
          textarea.setAttribute("readonly", "");
          textarea.style.cssText = "position:fixed;left:-9999px;top:0";
          global.document.body?.appendChild(textarea);
          textarea.select?.();
          global.document.execCommand?.("copy");
          textarea.remove?.();
        }
      }
      uiShell?.toast?.("REPORT DIAGNOSTICO COPIATO");
      return value;
    }

    async function open(probe = null) {
      if (!uiShell?.openModal) return null;
      runtime.recordEvent("diagnostics-opened", { hasProbe: !!probe });
      const report = await runtime.buildReport(probe);
      uiShell.openModal(view.markup(report), { closeable: true, className: "game-diagnostics-modal" });
      global.document?.getElementById?.("game-diagnostics-copy")?.addEventListener("click", () => copyReport(report));
      global.document?.getElementById?.("game-diagnostics-clear")?.addEventListener("click", () => {
        runtime.clearRecorded();
        open(probe);
      });
      global.document?.getElementById?.("game-diagnostics-probe")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "VERIFICA IN CORSO…";
        const result = await storage.probeStorage();
        runtime.recordEvent("storage-probe", { results: result.results });
        open(result);
      });
      return report;
    }

    return Object.freeze({ setUiShell, open, copyReport, probeStorage: storage.probeStorage, buildReport: runtime.buildReport });
  }

  global.GameDiagnosticsController = Object.freeze({ create });
})(globalThis);
