(function (global) {
  "use strict";
  function accessError(error, stage) { return Object.assign(new Error("storage-access-error"), { code: "storage-access-error", stage, cause: error }); }
  function read(storage, key, uid, deviceId) {
    let raw; try { raw = storage.getItem(key); } catch (error) { if (error?.name === "SecurityError") throw accessError(error, "metadata-read"); throw error; }
    if (raw == null) return null;
    let value; try { value = JSON.parse(raw); } catch (error) { throw Object.assign(new Error("metadata-repair-needed"), { code: "metadata-repair-needed", stage: "metadata-parse", cause: error }); }
    return value?.uid === uid && value.deviceId === deviceId && value.status === "associated" ? value : null;
  }
  function write(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); } catch (error) { if (error?.name === "SecurityError") throw accessError(error, "metadata-write"); throw error; } }
  const api = Object.freeze({ read, write }); global.InazumaCloudLocalMetadata = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
