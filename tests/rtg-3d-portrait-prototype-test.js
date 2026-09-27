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
assert(runtime.includes("MeshPhongMaterial"), "RTG portrait renderer must use the Character-style material base.");
assert(runtime.includes("userData?.nie?.textures"), "RTG portrait renderer must consume NIE Character texture metadata.");
assert(runtime.includes('getDependency("texture", index)'), "RTG portrait renderer must load embedded Character auxiliary textures.");
assert(runtime.includes("g4SpecularShapeMap"), "RTG Character shader must use the native specular-shape texture when available.");
assert(runtime.includes("g4SpecularMaskMap"), "RTG Character shader must use the native specular mask when available.");
assert(runtime.includes("g4OcclusionMap"), "RTG Character shader must use native occlusion when available.");
assert(runtime.includes("mix(0.94, 1.0, g4Occlusion)"), "Character occlusion must stay subtle and must not crush portrait brightness.");
assert(!runtime.includes("g4ShadowDeep"), "RTG portrait must not double-apply synthetic shadow bands on top of Three.js lighting.");
assert(runtime.includes("PerspectiveCamera"), "RTG portrait must restore depth with a perspective camera.");
assert(!runtime.includes("MeshToonMaterial"), "Generic MeshToonMaterial must not be used for Victory Road portraits.");
assert(!runtime.includes("OrthographicCamera"), "Flat orthographic portrait camera must not be used.");
assert(runtime.includes('rtg-3d-portrait-v5'), "Legacy Character shader cache must remain available as fallback.");
assert(runtime.includes('rtg-3d-portrait-v6-g4'), "Capture-derived G4 shader must use an isolated cache.");
assert(runtime.includes('get("rtg3dShader")'), "Capture-derived G4 shader must remain explicitly selectable.");
assert(runtime.includes('function buildG4CaptureMaterial'), "Capture-derived G4 material path missing.");
assert(runtime.includes('vec3(0.74995, 0.60020, 0.77992)'), "G4 shadow color 0 from capture-derived profile is missing.");
assert(runtime.includes('vec3(0.72967, 0.52992, 0.69982)'), "G4 shadow color 1 from capture-derived profile is missing.");
assert(runtime.includes('smoothstep(0.751, 0.757, g4Grad0)'), "G4 primary gradient cutoff must follow capture-derived values.");
assert(runtime.includes('smoothstep(0.527, 0.533, g4Grad1)'), "G4 secondary gradient cutoff must follow capture-derived values.");
assert(runtime.includes('g4Oc.r * 2.0'), "G4 capture-derived occlusion weight is missing.");
assert(runtime.includes('g4SpecShape * g4SpecMask * g4ShadowMix'), "G4 capture-derived specular composition is missing.");
assert(runtime.includes('g4HighSignal - 1.5999'), "G4 capture-derived highlight threshold is missing.");
assert(runtime.includes('g4Under + 1.0 - 1.45'), "G4 capture-derived under-light threshold is missing.");
assert(runtime.includes('rtg-g4-capture-v6'), "G4 shader program cache version is missing.");
assert(runtime.includes('rtg-3d-portrait-v7-native-data'), "Native-data portrait mode must use an isolated cache.");
assert(runtime.includes('value === "native" || value === "v7"'), "Native-data portrait mode must be selectable.");
assert(runtime.includes('function buildNativeGradientTexture()'), "Native-data portrait must reconstruct the extracted chrGrd_01 rows.");
assert(runtime.includes('new THREE.Vector3(0.83, 0.40, 0.37)'), "Native charaLightDir from light_data.cfg.bin is missing.");
assert(runtime.includes('vec3(0.67, 0.60, 0.55)'), "Native charaShadowColor1 is missing.");
assert(runtime.includes('vec3(0.52, 0.44, 0.40)'), "Native charaShadowColor2 is missing.");
assert(runtime.includes('texture2D(g4NativeGradientMap'), "Native portrait must sample the extracted chrGrd_01 gradient rows.");
assert(runtime.includes('g4HighSignal - 1.50'), "Native highlight threshold must come from charaHighLightColor.w.");
assert(runtime.includes('vec3(0.10) * g4High'), "Native highlight color must come from light_data.cfg.bin.");
assert(runtime.includes('vec3(0.07) * g4Under'), "Native under-rim color must come from light_data.cfg.bin.");
assert(runtime.includes('rtg-g4-native-data-v7'), "Native-data shader program cache version is missing.");
assert(runtime.includes('rtg-3d-portrait-v8-native-edge'), "Native edge portrait mode must use an isolated cache.");
assert(runtime.includes('value === "native-edge" || value === "edge2" || value === "v8"'), "Native edge portrait mode must be selectable.");
assert(runtime.includes('function renderNativeEdgeComposite'), "Native edge portrait post-process is missing.");
assert(runtime.includes('outlinePixels: { value: 1.65 }'), "Native edge portrait must use the capture-derived outline width.");
assert(runtime.includes('normalThreshold: { value: 0.30 }'), "Native edge portrait normal threshold is missing.");
assert(runtime.includes('depthThreshold: { value: 0.015 }'), "Native edge portrait depth threshold is missing.");
assert(runtime.includes('new THREE.Color(0.018, 0.012, 0.018)'), "Native edge portrait dark edge color is missing.");
assert(runtime.includes('NATIVE+EDGE'), "Native edge portrait status label is missing.");
assert(runtime.includes('function compareEnabled()'), "Portrait comparison query helper is missing.");
assert(runtime.includes('rtg3dCompare'), "Portrait comparison query parameter is missing.");
assert(runtime.includes('shaderModeOverride'), "Portrait comparison must render explicit shader modes.");
assert(runtime.includes('G4 v6'), "Portrait comparison must label the G4 side.");
assert(runtime.includes('NATIVE v7'), "Portrait comparison must label the native-data side.");
assert(runtime.includes('rtg-3d-compare-wrap'), "Portrait comparison wrapper is missing.");
const compareCss = fs.readFileSync(path.join(root, "css", "rtg-3d-portrait.css"), "utf8");
assert(!/\.rtg-3d-compare-host\s*\{[^}]*position\s*:\s*relative/i.test(compareCss), "Portrait compare host must not override the absolute player-detail visual positioning.");

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
