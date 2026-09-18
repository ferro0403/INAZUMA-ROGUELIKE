import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MANIFEST_URL = "../../data/REMOTE_3D_PROTOTYPE.json";

const dom = {
  viewer: document.querySelector("#viewer"),
  empty: document.querySelector("#empty-state"),
  select: document.querySelector("#model-select"),
  load: document.querySelector("#load-model"),
  reload: document.querySelector("#reload-model"),
  release: document.querySelector("#release-model"),
  status: document.querySelector("#status"),
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
  },
};

const state = {
  manifest: null,
  current: null,
  mixer: null,
  fetches: 0,
  loading: false,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3eedf);

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
camera.position.set(2.6, 1.8, 3.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function heapText() {
  const memory = performance.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return "n/d";
  return formatBytes(memory.usedJSHeapSize);
}

function updateRendererMetrics() {
  dom.metrics.gpuGeometries.textContent = String(renderer.info.memory.geometries);
  dom.metrics.gpuTextures.textContent = String(renderer.info.memory.textures);
  dom.metrics.heap.textContent = heapText();
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

function disposeMaterial(material, disposedTextures) {
  if (!material) return;
  for (const value of Object.values(material)) {
    if (value?.isTexture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose?.();
}

function releaseCurrentModel({ quiet = false } = {}) {
  if (!state.current) {
    if (!quiet) setStatus("Nessun modello GLB attualmente residente.");
    updateRendererMetrics();
    return;
  }

  if (state.mixer) {
    state.mixer.stopAllAction();
    state.mixer.uncacheRoot(state.current.scene);
    state.mixer = null;
  }

  const disposedTextures = new Set();
  state.current.scene.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => disposeMaterial(material, disposedTextures));
    } else {
      disposeMaterial(node.material, disposedTextures);
    }
  });

  scene.remove(state.current.scene);
  state.current = null;
  renderer.renderLists.dispose();
  dom.empty.classList.remove("hidden");
  dom.release.disabled = true;
  dom.reload.disabled = state.loading;
  renderer.render(scene, camera);
  updateRendererMetrics();

  if (!quiet) {
    setStatus("Modello rimosso dalla scena; geometrie, materiali e texture sono stati disposed.");
  }
}

function inspectModel(gltf) {
  let nodes = 0;
  let meshes = 0;
  let skinned = 0;
  let bones = 0;
  const materials = new Set();
  const textures = new Set();

  gltf.scene.traverse((node) => {
    nodes += 1;
    if (node.isMesh) meshes += 1;
    if (node.isSkinnedMesh) skinned += 1;
    if (node.isBone) bones += 1;

    const list = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
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
    throw new Error(`Firma GLB non valida: "${magic}".`);
  }
}

function selectedEntry() {
  if (!state.manifest) return null;
  return state.manifest.models.find((model) => model.id === dom.select.value) || null;
}

async function loadSelectedModel() {
  if (state.loading) return;
  const entry = selectedEntry();
  if (!entry) {
    setStatus("Nessun modello selezionato.", true);
    return;
  }

  state.loading = true;
  dom.load.disabled = true;
  dom.reload.disabled = true;
  dom.release.disabled = true;
  releaseCurrentModel({ quiet: true });

  state.fetches += 1;
  dom.metrics.fetches.textContent = String(state.fetches);
  dom.metrics.bytes.textContent = "…";
  dom.metrics.network.textContent = "…";
  dom.metrics.parse.textContent = "…";
  dom.metrics.meshes.textContent = "…";
  dom.metrics.skinned.textContent = "…";
  dom.metrics.bones.textContent = "…";
  dom.metrics.animations.textContent = "…";
  dom.source.textContent = `Fonte modello: ${entry.source} · ${entry.license}`;
  setStatus(`Download on-demand di ${entry.label}…`);

  try {
    const networkStart = performance.now();
    const response = await fetch(entry.modelUrl, { mode: "cors", cache: "default" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} durante il download GLB.`);
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
    dom.metrics.network.textContent = `${networkMs.toFixed(0)} ms`;
    dom.metrics.parse.textContent = `${parseMs.toFixed(0)} ms`;
    dom.metrics.meshes.textContent = String(report.meshes);
    dom.metrics.skinned.textContent = String(report.skinned);
    dom.metrics.bones.textContent = String(report.bones);
    dom.metrics.animations.textContent = String(report.animations);
    dom.empty.classList.add("hidden");

    renderer.render(scene, camera);
    updateRendererMetrics();

    const expected = Number(entry.expectedBytes);
    const sizeNote = Number.isFinite(expected) && expected !== buffer.byteLength
      ? ` · attesi ${formatBytes(expected)} nel manifest`
      : "";
    setStatus(
      `GLB caricato da URL: ${formatBytes(buffer.byteLength)} in ${networkMs.toFixed(0)} ms, parsing ${parseMs.toFixed(0)} ms${sizeNote}.`,
    );
  } catch (error) {
    releaseCurrentModel({ quiet: true });
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    state.loading = false;
    dom.load.disabled = false;
    dom.reload.disabled = false;
    dom.release.disabled = !state.current;
    updateRendererMetrics();
  }
}

async function loadManifest() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest HTTP ${response.status}`);
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
  dom.select.disabled = false;
  dom.load.disabled = false;
  dom.reload.disabled = false;
  dom.source.textContent = "Fonte modello: seleziona un asset e premi Carica modello.";
  setStatus("Manifest pronto. Nessun GLB è stato scaricato.");
}

dom.load.addEventListener("click", loadSelectedModel);
dom.reload.addEventListener("click", loadSelectedModel);
dom.release.addEventListener("click", () => releaseCurrentModel());
dom.select.addEventListener("change", () => {
  const entry = selectedEntry();
  if (entry) dom.source.textContent = `Fonte modello: ${entry.source} · ${entry.license}`;
});

window.addEventListener("beforeunload", () => releaseCurrentModel({ quiet: true }));

function animate() {
  requestAnimationFrame(animate);
  resizeRenderer();
  const delta = Math.min(clock.getDelta(), 0.05);
  state.mixer?.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

loadManifest().catch((error) => {
  setStatus(`Impossibile leggere il manifest: ${error instanceof Error ? error.message : String(error)}`, true);
});

animate();
