(function (global) {
  "use strict";
  function classifyCloudWriteFailure(error) {
    const code = String(error?.code || "sync-failed");
    if (code === "cloud-cas-conflict") return { status: "sync-conflict", error: code, retryable: false, needsManifestRefresh: true, problemSector: error?.problemSector || null };
    if (code === "metadata-repair-needed") return { status: "metadata-repair-needed", error: code, retryable: true, needsManifestRefresh: false, problemSector: error?.problemSector || null };
    return { status: "sync-error", error: code, retryable: true, needsManifestRefresh: false, problemSector: error?.problemSector || null };
  }
  const api = Object.freeze({ classifyCloudWriteFailure });
  global.InazumaCloudWriteFailurePolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
