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

assert.strictEqual(manifest.version, 1, "Unexpected prototype manifest version.");
assert(Array.isArray(manifest.models) && manifest.models.length >= 2, "Need at least two remote model entries.");

for (const model of manifest.models) {
  assert(/^https:\/\//.test(model.modelUrl), `${model.id}: modelUrl must be remote HTTPS.`);
  assert(/\.glb(?:$|\?)/i.test(model.modelUrl), `${model.id}: expected a GLB URL.`);
}

assert(labIndex.includes('type="importmap"'), "Lab page must pin browser module imports.");
assert(labIndex.includes("three@0.186.0"), "Three.js version must remain pinned for reproducibility.");
assert(labIndex.includes('src="./app.js"'), "Lab page must load its isolated module.");

assert(labApp.includes('fetch(entry.modelUrl, { mode: "cors", cache: "default" })'), "GLB must be fetched from the manifest URL.");
assert(labApp.includes('dom.load.addEventListener("click", loadSelectedModel)'), "GLB loading must be user-triggered.");
assert(labApp.includes("node.geometry?.dispose?.()"), "Geometry disposal is required.");
assert(labApp.includes("value.dispose()"), "Texture disposal is required.");
assert(labApp.includes("material.dispose?.()"), "Material disposal is required.");
assert(labApp.includes('magic !== "glTF"'), "Downloaded binary must be validated as GLB.");

const syntax = spawnSync(process.execPath, ["--check", path.join(root, "experiments/remote-glb/app.js")], {
  encoding: "utf8",
});
assert.strictEqual(syntax.status, 0, syntax.stderr || "app.js syntax check failed");

console.log("remote-glb-prototype-contract-test: ok");
