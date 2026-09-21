import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MANIFEST_URL = "data/RTG_3D_PROTOTYPE.json";
const CACHE_NAME = "rtg-3d-portrait-v1";
const CACHE_PREFIX = "/__rtg3d_portrait_cache__/";
const RENDER_WIDTH = 512;
const RENDER_HEIGHT = 640;
const memoryUrls = new Map();
let manifestPromise = null;

function enabled() {
  const value = new URLSearchParams(globalThis.location?.search || "").get("rtg3d");
  return value !== null && value !== "0" && value !== "false";
}

function selectedUniformId(manifest) {
  const params = new URLSearchParams(globalThis.location?.search || "");
  return String(params.get("rtg3dUniform") || manifest?.defaultUniformId || "").trim();
}

function selectedServerBase(manifest) {
  const params = new URLSearchParams(globalThis.location?.search || "");
  return String(params.get("rtg3dServer") || manifest?.serverBaseUrl || "").trim().replace(/\/$/, "");
}

async function manifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("RTG 3D manifest HTTP " + response.status);
      return response.json();
    });
  }
  return manifestPromise;
}

function roleOf(player) {
  return String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
}

function cacheKey(playerId, internalCode, uniformId, uniformCrc) {
  return ["v1", playerId, internalCode, uniformId, uniformCrc].map((value) => String(value || "")).join("__");
}

function cacheRequest(key) {
  return new Request(new URL(CACHE_PREFIX + encodeURIComponent(key) + ".webp", globalThis.location?.origin || "https://localhost").href);
}

async function readCachedBlob(key) {
  if (!globalThis.caches) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheRequest(key));
    return response?.ok ? await response.blob() : null;
  } catch (_) {
    return null;
  }
}

async function writeCachedBlob(key, blob) {
  if (!globalThis.caches || !blob) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheRequest(key), new Response(blob, {
      headers: { "Content-Type": blob.type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    }));
  } catch (_) {
    // Cache Storage is an optimization only. Rendering still succeeds without it.
  }
}

function objectUrlFor(key, blob) {
  const existing = memoryUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  memoryUrls.set(key, url);
  return url;
}

function assertGlb(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) {
    throw new Error("Risposta GLB troppo piccola");
  }
  const magic = new TextDecoder("ascii").decode(new Uint8Array(buffer, 0, 4));
  if (magic !== "glTF") throw new Error("Risposta nie-model non e un GLB valido");
}

function parseGlb(buffer, baseUrl) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(buffer, baseUrl, resolve, reject);
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
  for (const entry of Object.values(value)) collectTextures(entry, textures, seen);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  const skeletons = new Set();
  const textures = new Set();
  const seen = new WeakSet();

  root?.traverse?.((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    const list = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of list) {
      materials.add(material);
      collectTextures(material, textures, seen);
    }
  });

  for (const skeleton of skeletons) {
    if (skeleton.boneTexture) textures.add(skeleton.boneTexture);
    skeleton.dispose?.();
  }
  for (const texture of textures) texture.dispose?.();
  for (const geometry of geometries) geometry.dispose?.();
  for (const material of materials) material.dispose?.();
}

function fitFrontCamera(camera, root) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error("Bounding box modello vuota");

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const heightDistance = size.y / Math.max(0.001, 2 * Math.tan(verticalFov / 2));
  const widthDistance = size.x / Math.max(0.001, 2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(heightDistance, widthDistance, 0.5) * 1.08;
  const targetY = center.y + size.y * 0.015;

  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(100, distance * 20);
  camera.position.set(center.x, targetY, center.z + distance);
  camera.lookAt(center.x, targetY, center.z);
  camera.updateProjectionMatrix();
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    const finish = (blob) => blob ? resolve(blob) : reject(new Error("Impossibile creare il render frontale"));
    if (canvas.toBlob) {
      canvas.toBlob(finish, "image/webp", 0.92);
      return;
    }
    reject(new Error("Canvas toBlob non disponibile"));
  });
}

async function renderGlbToBlob(buffer, sourceUrl) {
  const parseStart = performance.now();
  const gltf = await parseGlb(buffer, sourceUrl.slice(0, sourceUrl.lastIndexOf("/") + 1));
  const parseMs = performance.now() - parseStart;

  const canvas = document.createElement("canvas");
  canvas.width = RENDER_WIDTH;
  canvas.height = RENDER_HEIGHT;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, RENDER_WIDTH / RENDER_HEIGHT, 0.01, 500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.5));

  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(4, 7, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.5);
  fill.position.set(-4, 3, 4);
  scene.add(fill);

  scene.add(gltf.scene);
  fitFrontCamera(camera, gltf.scene);

  const renderStart = performance.now();
  renderer.render(scene, camera);
  const blob = await canvasBlob(canvas);
  const renderMs = performance.now() - renderStart;

  scene.remove(gltf.scene);
  disposeModel(gltf.scene);
  gltf.parser?.cache?.removeAll?.();
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss?.();

  return { blob, parseMs, renderMs, animations: Number(gltf.animations?.length || 0) };
}

async function portraitFor({ playerId, player, uniformId = null } = {}) {
  if (!enabled()) return { skipped: "disabled" };

  const config = await manifest();
  const playerConfig = config?.players?.[String(playerId)];
  if (!playerConfig?.internalCode) return { skipped: "unmapped-player" };

  const chosenUniformId = String(uniformId || selectedUniformId(config));
  const uniform = config?.uniforms?.[chosenUniformId];
  if (!uniform) throw new Error("Uniforme 3D RTG non configurata: " + chosenUniformId);

  const isKeeper = roleOf(player) === "GK";
  const uniformCrc = isKeeper
    ? uniform.uniformKeeperModelIdCrc
    : uniform.uniformFielderModelIdCrc;

  if (!uniformCrc) throw new Error("CRC uniforme mancante per " + (isKeeper ? "GK" : "giocatore di campo"));

  const key = cacheKey(playerId, playerConfig.internalCode, chosenUniformId, uniformCrc);
  const memoryUrl = memoryUrls.get(key);
  if (memoryUrl) {
    return { url: memoryUrl, cache: "memory", totalMs: 0, uniformId: chosenUniformId, uniformCrc, isKeeper };
  }

  const persistentBlob = await readCachedBlob(key);
  if (persistentBlob) {
    return {
      url: objectUrlFor(key, persistentBlob),
      cache: "browser",
      totalMs: 0,
      uniformId: chosenUniformId,
      uniformCrc,
      isKeeper,
    };
  }

  const base = selectedServerBase(config);
  if (!base) throw new Error("serverBaseUrl nie-model mancante");

  const modelUrl = base + "/model-full/" + encodeURIComponent(playerConfig.internalCode) + ".glb?uniform=" + encodeURIComponent(uniformCrc);
  const totalStart = performance.now();
  const networkStart = performance.now();
  const response = await fetch(modelUrl, { mode: "cors", cache: "default" });
  if (!response.ok) throw new Error("nie-model HTTP " + response.status);
  const buffer = await response.arrayBuffer();
  const networkMs = performance.now() - networkStart;
  assertGlb(buffer);

  const rendered = await renderGlbToBlob(buffer, modelUrl);
  await writeCachedBlob(key, rendered.blob);
  const totalMs = performance.now() - totalStart;

  return {
    url: objectUrlFor(key, rendered.blob),
    cache: "miss",
    totalMs,
    networkMs,
    parseMs: rendered.parseMs,
    renderMs: rendered.renderMs,
    bytes: buffer.byteLength,
    animations: rendered.animations,
    uniformId: chosenUniformId,
    uniformCrc,
    isKeeper,
  };
}

function statusNode(visual) {
  let node = visual.querySelector(".rtg-3d-portrait-status");
  if (!node) {
    node = document.createElement("small");
    node.className = "rtg-3d-portrait-status";
    visual.appendChild(node);
  }
  return node;
}

async function renderIntoDetail({ playerId, player, modalRoot, uniformId = null } = {}) {
  if (!enabled()) return { skipped: "disabled" };
  const visual = modalRoot?.querySelector?.(".player-detail-visual");
  if (!visual) return { skipped: "no-detail-visual" };

  const status = statusNode(visual);
  status.textContent = "3D · generazione…";
  status.dataset.state = "loading";

  try {
    const result = await portraitFor({ playerId, player, uniformId });
    if (result?.skipped) {
      status.remove();
      return result;
    }

    const img = document.createElement("img");
    img.className = "player-fullbody rtg-3d-generated-portrait";
    img.alt = String(player?.name || "");
    img.decoding = "async";
    img.src = result.url;

    if (typeof img.decode === "function") await img.decode().catch(() => {});
    if (!visual.isConnected) return result;

    visual.querySelectorAll(".rtg-3d-generated-portrait").forEach((old) => old.remove());
    const fallback = visual.querySelector("img.player-fullbody:not(.rtg-3d-generated-portrait), .player-fullbody-placeholder");
    fallback?.classList?.add("rtg-3d-fallback-hidden");
    visual.prepend(img);

    status.dataset.state = "ready";
    status.textContent = result.cache === "miss"
      ? "3D · " + Math.round(result.totalMs) + " ms · " + (result.isKeeper ? "GK" : "campo")
      : "3D · cache " + result.cache + " · " + (result.isKeeper ? "GK" : "campo");
    return result;
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = "3D non disponibile";
    console.warn("[RTG 3D portrait]", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

globalThis.RoadToGlory3DPortrait = Object.freeze({
  enabled,
  portraitFor,
  renderIntoDetail,
});

globalThis.addEventListener?.("beforeunload", () => {
  for (const url of memoryUrls.values()) URL.revokeObjectURL(url);
  memoryUrls.clear();
});
