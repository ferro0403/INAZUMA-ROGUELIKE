import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MANIFEST_URL = "../../data/REMOTE_3D_PROTOTYPE.json";
const STRESS_CYCLES = 100;

const dom = {
  viewer: document.querySelector("#viewer"),
  empty: document.querySelector("#empty-state"),
  select: document.querySelector("#model-select"),
  load: document.querySelector("#load-model"),
  reload: document.querySelector("#reload-model"),
  release: document.querySelector("#release-model"),
  stress: document.querySelector("#stress-test"),
  status: document.querySelector("#status"),
  stressStatus: document.querySelector("#stress-status"),
  source: document.querySelector("#model-source"),
  metrics: {
    fetches: document.querySelector("#metric-fetches"),
    bytes: document.querySelector("#metric-bytes"),
    network: document.querySelector("#metric-network"),
    parse: document.querySelector("#metric-parse"),
    meshes: document.querySelector("#metric-meshes"),
    skinned: document.querySelector("#metric-skinned"),
    bones: document.querySelector("#metric-bones"),
    animations: document.querySelector("#metric-animations"),
    gpuGeometries: document.querySelector("#metric-gpu-geometries"),
    gpuTextures: document.querySelector("#metric-gpu-textures"),
    heap: document.querySelector("#metric-heap"),
    stressCycles: document.querySelector("#metric-stress-cycles"),
    stressResult: document.querySelector("#metric-stress-result"),
  },
};

const state = {
  manifest: null,
  current: null,
  mixer: null,
  fetches: 0,
  busy: false,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3eedf);

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
camera.position.set(2.6, 1.8, 3.4);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
dom.viewer.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x72664c, 2.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
keyLight.position.set(4, 7, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xffd966, 1.3);
rimLight.position.set(-4, 3, -4);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2.3, 64),
  new THREE.MeshStandardMaterial({ color: 0xe3dcc9, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);

const clock = new THREE.Clock();

function setStatus(message, error = false) {
  dom.status.textContent = message;
  dom.status.classList.toggle("error", error);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return String(bytes) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function heapBytes() {
  const memory = performance.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return null;
  return memory.usedJSHeapSize;
}

function heapText() {
  const bytes = heapBytes();
  return bytes == null ? "n/d" : formatBytes(bytes);
}

function runtimeSnapshot() {
  return {
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    heap: heapBytes(),
  };
}

function updateRendererMetrics() {
  dom.metrics.gpuGeometries.textContent = String(renderer.info.memory.geometries);
  dom.metrics.gpuTextures.textContent = String(renderer.info.memory.textures);
  dom.metrics.heap.textContent = heapText();
}

function updateControls() {
  const ready = Boolean(state.manifest) && !state.busy;
  dom.select.disabled = !ready;
  dom.load.disabled = !ready;
  dom.reload.disabled = !ready;
  dom.stress.disabled = !ready;
  dom.release.disabled = state.busy || !state.current;
}

function resizeRenderer() {
  const width = Math.max(1, dom.viewer.clientWidth);
  const height = Math.max(1, dom.viewer.clientHeight);
  const pixelWidth = renderer.domElement.width;
  const pixelHeight = renderer.domElement.height;
  const targetWidth = Math.floor(width * renderer.getPixelRatio());
  const targetHeight = Math.floor(height * renderer.getPixelRatio());

  if (pixelWidth !== targetWidth || pixelHeight !== targetHeight) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function waitFrames(count = 2) {
  return new Promise((resolve) => {
    let remaining = Math.max(1, count);
    function next() {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(next);
    }
    requestAnimationFrame(next);
  });
}

function collectTextures(value, textures, seen) {
  if (!value || typeof value !== "object") return;
  if (value.isTexture) {
    textures.add(value);
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) collectTextures(entry, textures, seen);
    return;
  }

  for (const entry of Object.values(value)) {
    collectTextures(entry, textures, seen);
  }
}

function closeTextureImages(texture, closedImages) {
  const candidates = [];
  if (texture && texture.source && texture.source.data) candidates.push(texture.source.data);
  if (texture && texture.image) candidates.push(texture.image);

  for (const candidate of candidates) {
    const images = Array.isArray(candidate) ? candidate : [candidate];
    for (const image of images) {
      if (!image || closedImages.has(image)) continue;
      closedImages.add(image);
      if (typeof image.close === "function") {
        try {
          image.close();
        } catch {
          // Some browser-backed image objects may already be closed.
        }
      }
    }
  }
}

function disposeModelResources(root) {
  const geometries = new Set();
  const materials = new Set();
  const skeletons = new Set();
  const textures = new Set();
  const seen = new WeakSet();
  const closedImages = new Set();

  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);

    const nodeMaterials = Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [];

    for (const material of nodeMaterials) {
      materials.add(material);
      collectTextures(material, textures, seen);
    }
  });

  for (const skeleton of skeletons) {
    if (skeleton.boneTexture) textures.add(skeleton.boneTexture);
    skeleton.dispose?.();
  }

  for (const texture of textures) {
    closeTextureImages(texture, closedImages);
    texture.dispose?.();
  }

  for (const geometry of geometries) {
    geometry.dispose?.();
  }

  for (const material of materials) {
    material.dispose?.();
  }

  return {
    geometries: geometries.size,
    materials: materials.size,
    skeletons: skeletons.size,
    textures: textures.size,
  };
}

async function releaseCurrentModel({ quiet = false, settleFrames = 2 } = {}) {
  if (!state.current) {
    if (!quiet) setStatus("Nessun modello GLB attualmente residente.");
    updateRendererMetrics();
    updateControls();
    return null;
  }

  const current = state.current;

  if (state.mixer) {
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(current.scene);
    state.mixer = null;
  }

  scene.remove(current.scene);
  const disposed = disposeModelResources(current.scene);

  if (current.parser?.cache?.removeAll) {
    current.parser.cache.removeAll();
  }

  state.current = null;
  renderer.renderLists.dispose();
  renderer.render(scene, camera);

  if (settleFrames > 0) {
    await waitFrames(settleFrames);
    renderer.render(scene, camera);
  }

  dom.empty.classList.remove("hidden");
  updateRendererMetrics();
  updateControls();

  if (!quiet) {
    setStatus(
      "Modello rimosso: disposed " +
        disposed.geometries +
        " geometrie, " +
        disposed.materials +
        " materiali, " +
        disposed.textures +
        " texture e " +
        disposed.skeletons +
        " skeleton.",
    );
  }

  return disposed;
}

function inspectModel(gltf) {
  let nodes = 0;
  let meshes = 0;
  let skinned = 0;
  let bones = 0;
  const materials = new Set();
  const textures = new Set();
  const seen = new WeakSet();

  gltf.scene.traverse((node) => {
    nodes += 1;
    if (node.isMesh) meshes += 1;
    if (node.isSkinnedMesh) skinned += 1;
    if (node.isBone) bones += 1;

    const list = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of list) {
      materials.add(material);
      collectTextures(material, textures, seen);
    }
  });

  return {
    nodes,
    meshes,
    skinned,
    bones,
    materials: materials.size,
    textures: textures.size,
    animations: gltf.animations.length,
  };
}

function fitCamera(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.25);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius / Math.sin(fov / 2)) * 1.18;

  controls.target.copy(sphere.center);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(100, distance * 20);
  camera.position.copy(sphere.center).add(new THREE.Vector3(distance * 0.6, distance * 0.18, distance));
  camera.updateProjectionMatrix();
  controls.update();
}

function parseGlb(buffer, baseUrl) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(buffer, baseUrl, resolve, reject);
  });
}

function assertGlb(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) {
    throw new Error("Risposta troppo piccola per essere un GLB valido.");
  }
  const magic = new TextDecoder("ascii").decode(new Uint8Array(buffer, 0, 4));
  if (magic !== "glTF") {
    throw new Error('Firma GLB non valida: "' + magic + '".');
  }
}

function selectedEntry() {
  if (!state.manifest) return null;
  return state.manifest.models.find((model) => model.id === dom.select.value) || null;
}

async function loadEntry(entry, { announce = true } = {}) {
  await releaseCurrentModel({ quiet: true, settleFrames: 1 });

  state.fetches += 1;
  dom.metrics.fetches.textContent = String(state.fetches);
  dom.metrics.bytes.textContent = "…";
  dom.metrics.network.textContent = "…";
  dom.metrics.parse.textContent = "…";
  dom.metrics.meshes.textContent = "…";
  dom.metrics.skinned.textContent = "…";
  dom.metrics.bones.textContent = "…";
  dom.metrics.animations.textContent = "…";
  dom.source.textContent = "Fonte modello: " + entry.source + " · " + entry.license;
  if (announce) setStatus("Download on-demand di " + entry.label + "…");

  const networkStart = performance.now();
  const response = await fetch(entry.modelUrl, { mode: "cors", cache: "default" });
  if (!response.ok) {
    throw new Error("HTTP " + response.status + " durante il download GLB.");
  }
  const buffer = await response.arrayBuffer();
  const networkMs = performance.now() - networkStart;
  assertGlb(buffer);

  const parseStart = performance.now();
  const baseUrl = entry.modelUrl.slice(0, entry.modelUrl.lastIndexOf("/") + 1);
  const gltf = await parseGlb(buffer, baseUrl);
  const parseMs = performance.now() - parseStart;

  state.current = gltf;
  scene.add(gltf.scene);
  fitCamera(gltf.scene);

  if (gltf.animations.length > 0) {
    state.mixer = new THREE.AnimationMixer(gltf.scene);
    state.mixer.clipAction(gltf.animations[0]).play();
  }

  const report = inspectModel(gltf);
  dom.metrics.bytes.textContent = formatBytes(buffer.byteLength);
  dom.metrics.network.textContent = networkMs.toFixed(0) + " ms";
  dom.metrics.parse.textContent = parseMs.toFixed(0) + " ms";
  dom.metrics.meshes.textContent = String(report.meshes);
  dom.metrics.skinned.textContent = String(report.skinned);
  dom.metrics.bones.textContent = String(report.bones);
  dom.metrics.animations.textContent = String(report.animations);
  dom.empty.classList.add("hidden");

  renderer.render(scene, camera);
  await waitFrames(1);
  updateRendererMetrics();

  const expected = Number(entry.expectedBytes);
  const sizeNote =
    Number.isFinite(expected) && expected !== buffer.byteLength
      ? " · attesi " + formatBytes(expected) + " nel manifest"
      : "";

  if (announce) {
    setStatus(
      "GLB caricato da URL: " +
        formatBytes(buffer.byteLength) +
        " in " +
        networkMs.toFixed(0) +
        " ms, parsing " +
        parseMs.toFixed(0) +
        " ms" +
        sizeNote +
        ".",
    );
  }

  return {
    bytes: buffer.byteLength,
    networkMs,
    parseMs,
    report,
  };
}

async function loadSelectedModel() {
  if (state.busy) return;
  const entry = selectedEntry();
  if (!entry) {
    setStatus("Nessun modello selezionato.", true);
    return;
  }

  state.busy = true;
  updateControls();

  try {
    await loadEntry(entry, { announce: true });
  } catch (error) {
    await releaseCurrentModel({ quiet: true, settleFrames: 1 });
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    state.busy = false;
    updateControls();
    updateRendererMetrics();
  }
}

async function runStressTest() {
  if (state.busy) return;
  const entry = selectedEntry();
  if (!entry) {
    setStatus("Nessun modello selezionato.", true);
    return;
  }

  state.busy = true;
  updateControls();
  dom.metrics.stressCycles.textContent = "0/" + STRESS_CYCLES;
  dom.metrics.stressResult.textContent = "IN CORSO";
  dom.metrics.stressResult.className = "";
  dom.stressStatus.textContent = "Preparazione baseline GPU…";

  let baseline = null;
  let after = null;
  let totalNetworkMs = 0;
  let totalParseMs = 0;

  try {
    await releaseCurrentModel({ quiet: true, settleFrames: 3 });
    renderer.render(scene, camera);
    await waitFrames(2);
    baseline = runtimeSnapshot();

    for (let cycle = 1; cycle <= STRESS_CYCLES; cycle += 1) {
      const result = await loadEntry(entry, { announce: false });
      totalNetworkMs += result.networkMs;
      totalParseMs += result.parseMs;

      await releaseCurrentModel({ quiet: true, settleFrames: 2 });

      if (cycle === 1 || cycle % 5 === 0 || cycle === STRESS_CYCLES) {
        const current = runtimeSnapshot();
        dom.metrics.stressCycles.textContent = cycle + "/" + STRESS_CYCLES;
        dom.stressStatus.textContent =
          "Ciclo " +
          cycle +
          "/" +
          STRESS_CYCLES +
          " · GPU geo " +
          current.geometries +
          " · texture " +
          current.textures +
          " · heap " +
          (current.heap == null ? "n/d" : formatBytes(current.heap));
        await waitFrames(1);
      }
    }

    await waitFrames(4);
    renderer.render(scene, camera);
    after = runtimeSnapshot();

    const geometryDelta = after.geometries - baseline.geometries;
    const textureDelta = after.textures - baseline.textures;
    const heapDelta =
      baseline.heap != null && after.heap != null
        ? after.heap - baseline.heap
        : null;
    const gpuStable = geometryDelta <= 0 && textureDelta <= 0;

    dom.metrics.stressResult.textContent = gpuStable ? "PASS" : "ATTENZIONE";
    dom.metrics.stressResult.className = gpuStable ? "metric-pass" : "metric-warn";

    const heapPart = heapDelta == null
      ? "heap n/d"
      : "heap Δ " + (heapDelta >= 0 ? "+" : "") + formatBytes(Math.abs(heapDelta));

    dom.stressStatus.textContent =
      "100 cicli completati · GPU Δ geometrie " +
      (geometryDelta >= 0 ? "+" : "") +
      geometryDelta +
      " · texture " +
      (textureDelta >= 0 ? "+" : "") +
      textureDelta +
      " · " +
      heapPart +
      " · media download " +
      (totalNetworkMs / STRESS_CYCLES).toFixed(1) +
      " ms · media parsing " +
      (totalParseMs / STRESS_CYCLES).toFixed(1) +
      " ms.";

    setStatus(
      gpuStable
        ? "Stress test completato: le risorse GPU sono tornate al baseline."
        : "Stress test completato: restano risorse GPU sopra il baseline.",
      !gpuStable,
    );
  } catch (error) {
    dom.metrics.stressResult.textContent = "ERRORE";
    dom.metrics.stressResult.className = "metric-warn";
    dom.stressStatus.textContent = error instanceof Error ? error.message : String(error);
    setStatus("Stress test interrotto.", true);
    await releaseCurrentModel({ quiet: true, settleFrames: 2 });
  } finally {
    state.busy = false;
    updateControls();
    updateRendererMetrics();
  }
}

async function loadManifest() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Manifest HTTP " + response.status);
  }
  const manifest = await response.json();
  if (!manifest || !Array.isArray(manifest.models) || manifest.models.length === 0) {
    throw new Error("Manifest 3D vuoto o non valido.");
  }

  state.manifest = manifest;
  dom.select.replaceChildren(
    ...manifest.models.map((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.label;
      return option;
    }),
  );
  dom.source.textContent = "Fonte modello: seleziona un asset e premi Carica modello.";
  setStatus("Manifest pronto. Nessun GLB è stato scaricato.");
  updateControls();
}

dom.load.addEventListener("click", loadSelectedModel);
dom.reload.addEventListener("click", loadSelectedModel);
dom.release.addEventListener("click", async () => {
  if (state.busy) return;
  state.busy = true;
  updateControls();
  try {
    await releaseCurrentModel();
  } finally {
    state.busy = false;
    updateControls();
  }
});
dom.stress.addEventListener("click", runStressTest);
dom.select.addEventListener("change", () => {
  const entry = selectedEntry();
  if (entry) dom.source.textContent = "Fonte modello: " + entry.source + " · " + entry.license;
});

window.addEventListener("beforeunload", () => {
  if (!state.current) return;
  scene.remove(state.current.scene);
  disposeModelResources(state.current.scene);
  state.current = null;
});

function animate() {
  requestAnimationFrame(animate);
  resizeRenderer();
  const delta = Math.min(clock.getDelta(), 0.05);
  state.mixer?.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

loadManifest().catch((error) => {
  setStatus(
    "Impossibile leggere il manifest: " +
      (error instanceof Error ? error.message : String(error)),
    true,
  );
});

animate();
