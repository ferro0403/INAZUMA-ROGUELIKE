(function (global) {
  "use strict";

  if (global.GameDiagnostics) return;

  const storage = global.GameDiagnosticsStorage.create({ errorSnapshot: global.GameDiagnosticsRuntime.errorSnapshot });
  const runtime = global.GameDiagnosticsRuntime.create({ storage });
  const view = global.GameDiagnosticsView.create();
  const controller = global.GameDiagnosticsController.create({ runtime, storage, view });

  const uiShellApi = global.AppUiShell;
  if (uiShellApi?.create && !uiShellApi.create.__gameDiagnosticsWrapped) {
    const originalCreate = uiShellApi.create;
    const wrappedCreate = function createWithGameDiagnosticsShell(...args) {
      const shell = originalCreate(...args);
      controller.setUiShell(shell);
      return shell;
    };
    wrappedCreate.__gameDiagnosticsWrapped = true;
    global.AppUiShell = Object.freeze({ ...uiShellApi, create: wrappedCreate });
  }

  global.GameDiagnosticsErrorCapture.install({ runtime });

  const api = Object.freeze({
    open: (...args) => controller.open(...args),
    buildReport: (...args) => runtime.buildReport(...args),
    probeStorage: (...args) => storage.probeStorage(...args),
    recordFailure: (...args) => runtime.recordFailure(...args),
    recordEvent: (...args) => runtime.recordEvent(...args),
    readFailure: () => storage.readFailure(),
    readEvents: () => runtime.readEvents(),
    clearRecorded: () => runtime.clearRecorded(),
    keys: storage.keys,
  });

  global.GameDiagnostics = api;
  global.PersistenceHomeDiagnostics = api;
})(globalThis);
