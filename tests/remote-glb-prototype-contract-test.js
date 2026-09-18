const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const mainIndex = read("index.html");
const labIndex = read("experiments/remote-glb/index.html");
const labApp = read("experiments/remote-glb/app.js");
const manifest = JSON.parse(read("data/REMOTE_3D_PROTOTYPE.json"));

assert(
  !mainIndex.includes("experiments/remote-glb") && !mainIndex.includes("REMOTE_3D_PROTOTYPE"),
  "The production index must remain completely unaware of the 3D lab.",
);

assert.strictEqual(manifest.version, 2, "Unexpected prototype manifest version.");
assert.strictEqual(manifest.stressRounds, 5, "Stress test must use five rounds.");
assert(Array.isArray(manifest.stressModels), "stressModels must be an array.");
assert.strictEqual(manifest.stressModels.length, 20, "Stress test must use 20 distinct models.");
assert.strictEqual(new Set(manifest.stressModels.map((model) => model.modelUrl)).size, 20, "Stress model URLs must be distinct.");
assert(Array.isArray(manifest.models) && manifest.models.length >= 2, "Need at least two remote model entries.");

for (const model of manifest.models) {
  assert(/^https:\/\//.test(model.modelUrl), model.id + ": modelUrl must be remote HTTPS.");
  assert(/\.glb(?:$|\?)/i.test(model.modelUrl), model.id + ": expected a GLB URL.");
}

assert(labIndex.includes('type="importmap"'), "Lab page must pin browser module imports.");
assert(labIndex.includes("three@0.186.0"), "Three.js version must remain pinned for reproducibility.");
assert(labIndex.includes('src="./app.js"'), "Lab page must load its isolated module.");
assert(labIndex.includes('id="stress-test"'), "Lab must expose the 100-cycle stress action.");

assert(labApp.includes('fetch(entry.modelUrl, { mode: "cors", cache: "default" })'), "GLB must be fetched from the manifest URL.");
assert(labApp.includes('dom.load.addEventListener("click", loadSelectedModel)'), "GLB loading must be user-triggered.");
assert(labApp.includes('dom.stress.addEventListener("click", runStressTest)'), "Stress test must be explicitly user-triggered.");
assert(labApp.includes("const DEFAULT_STRESS_ROUNDS = 5"), "Stress test must default to five rounds.");
assert(labApp.includes("seenUrls.add(entry.modelUrl)"), "Stress test must track distinct model URLs.");
assert(labApp.includes("validationCycles = stressModels.length * validationRounds"), "Stress test must measure post-warm-up cycles separately.");
assert(labApp.includes("coldBaseline = runtimeSnapshot()"), "Stress test must capture a cold renderer baseline.");
assert(labApp.includes("warmBaseline = runtimeSnapshot()"), "Stress test must capture a post-warm-up baseline.");
assert(labApp.includes("after.textures - warmBaseline.textures"), "Texture leak detection must use the warmed baseline.");
assert(labApp.includes("after.geometries - warmBaseline.geometries"), "Geometry leak detection must use the warmed baseline.");
assert(labApp.includes("PASS STABILE"), "Stable post-warm-up lifecycle must have an explicit result.");
assert(labApp.includes("geometry.dispose?.()"), "Geometry disposal is required.");
assert(labApp.includes("texture.dispose?.()"), "Texture disposal is required.");
assert(labApp.includes("material.dispose?.()"), "Material disposal is required.");
assert(labApp.includes("skeleton.dispose?.()"), "Skeleton / bone texture disposal is required.");
assert(labApp.includes('typeof image.close === "function"'), "ImageBitmap cleanup is required.");
assert(labApp.includes("current.parser?.cache?.removeAll"), "GLTF parser cache cleanup is required.");
assert(labApp.includes('magic !== "glTF"'), "Downloaded binary must be validated as GLB.");
assert(labApp.includes("textureDelta <= 0"), "Stress result must compare textures against the warmed baseline.");
assert(labApp.includes("geometryDelta <= 0"), "Stress result must compare geometries against the warmed baseline.");

const syntax = spawnSync(process.execPath, ["--check", path.join(root, "experiments/remote-glb/app.js")], {
  encoding: "utf8",
});
assert.strictEqual(syntax.status, 0, syntax.stderr || "app.js syntax check failed");

console.log("remote-glb-prototype-contract-test: ok");
