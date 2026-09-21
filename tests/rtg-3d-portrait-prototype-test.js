const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const manifest = JSON.parse(read("data/RTG_3D_PROTOTYPE.json"));
const runtime = read("js/road-to-glory/rtg-3d-portrait-runtime.js");
const controller = read("js/road-to-glory/rtg-controller.js");
const index = read("index.html");

assert.strictEqual(manifest.players?.["1"]?.internalCode, "c01000010", "Mark Evans must map to c01000010.");
assert.strictEqual(manifest.uniforms?.zeus?.uniformFielderModelIdCrc, "0xF0006501", "Zeus fielder CRC mismatch.");
assert.strictEqual(manifest.uniforms?.zeus?.uniformKeeperModelIdCrc, "0x38E0EA71", "Zeus keeper CRC mismatch.");

assert(runtime.includes('roleOf(player) === "GK"'), "Runtime must distinguish goalkeeper from field players.");
assert(runtime.includes("uniform.uniformKeeperModelIdCrc"), "Keeper CRC path missing.");
assert(runtime.includes("uniform.uniformFielderModelIdCrc"), "Fielder CRC path missing.");
assert(runtime.includes('"/model-full/"'), "Runtime must call the patched model-full endpoint.");
assert(runtime.includes('".glb?uniform="'), "Runtime must pass the uniform CRC query.");
assert(runtime.includes('get("rtg3d")'), "Prototype must remain explicitly opt-in.");
assert(runtime.includes('get("rtg3dServer")'), "Prototype must allow the model server origin to be overridden without a code change.");
assert(runtime.includes("Cache Storage is an optimization only"), "Cache must remain non-critical.");
assert(runtime.includes("disposeModel(gltf.scene)"), "Loaded GLB resources must be released.");
assert(runtime.includes("renderer.forceContextLoss?.()"), "WebGL context cleanup is required.");

assert(controller.includes("RoadToGlory3DPortrait?.renderIntoDetail"), "RTG player detail must invoke the isolated 3D portrait runtime.");
assert(controller.includes('get("rtgCheatMark")'), "Prototype must expose the opt-in Mark cheat.");
assert(controller.includes('repository.update("rtg-debug-mark-cheat"'), "Mark cheat must use the RTG repository transaction.");
assert(controller.includes('rawRole(playerId)==="GK"'), "Mark cheat must replace the current goalkeeper slot only.");
assert(index.includes("rtg-3d-portrait-runtime.js"), "RTG 3D runtime must be loaded.");
assert(index.includes("three@0.186.0"), "Three.js prototype version must remain pinned.");

const syntax = spawnSync(process.execPath, ["--check", path.join(root, "js/road-to-glory/rtg-3d-portrait-runtime.js")], {
  encoding: "utf8",
});
assert.strictEqual(syntax.status, 0, syntax.stderr || "rtg-3d-portrait-runtime.js syntax check failed");

console.log("rtg-3d-portrait-prototype-test: ok");
