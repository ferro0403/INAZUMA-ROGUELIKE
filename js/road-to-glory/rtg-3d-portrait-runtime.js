import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MANIFEST_URL = "data/RTG_3D_PROTOTYPE.json";
const CACHE_NAME = "rtg-3d-portrait-v4";
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
  return ["v4", playerId, internalCode, uniformId, uniformCrc].map((value) => String(value || "")).join("__");
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

function copyTextureSettings(texture, { color = false } = {}) {
  if (!texture) return texture;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function loadNieAuxTextures(gltf, sourceMaterial) {
  const descriptors = sourceMaterial?.userData?.nie?.textures;
  if (!descriptors || typeof descriptors !== "object") return {};

  const entries = await Promise.all(
    Object.entries(descriptors).map(async ([role, descriptor]) => {
      const index = Number(descriptor?.texture);
      if (!Number.isInteger(index) || index < 0) return [role, null];
      try {
        const texture = await gltf.parser.getDependency("texture", index);
        return [role, copyTextureSettings(texture, { color: false })];
      } catch (error) {
        console.warn("[RTG 3D portrait] texture Character non disponibile", role, error);
        return [role, null];
      }
    }),
  );

  return Object.fromEntries(entries.filter(([, texture]) => texture));
}

function buildCharacterMaterial(sourceMaterial, aux) {
  const material = new THREE.MeshPhongMaterial({
    color: sourceMaterial?.color?.clone?.() || new THREE.Color(0xffffff),
    map: copyTextureSettings(sourceMaterial?.map || null, { color: true }),
    alphaMap: sourceMaterial?.alphaMap || null,
    transparent: !!sourceMaterial?.transparent,
    opacity: Number.isFinite(sourceMaterial?.opacity) ? sourceMaterial.opacity : 1,
    alphaTest: Number(sourceMaterial?.alphaTest || 0),
    side: sourceMaterial?.side ?? THREE.FrontSide,
    depthWrite: sourceMaterial?.depthWrite !== false,
    depthTest: sourceMaterial?.depthTest !== false,
    shininess: aux.specular || aux.specular_mask ? 18 : 10,
    specular: new THREE.Color(0x4a4650),
    fog: false,
  });

  if (sourceMaterial?.normalMap) {
    material.normalMap = copyTextureSettings(sourceMaterial.normalMap, { color: false });
    if (sourceMaterial.normalScale?.clone) material.normalScale.copy(sourceMaterial.normalScale);
  }

  if (aux.specular_mask) {
    material.specularMap = aux.specular_mask;
  }

  material.name = (sourceMaterial?.name || "Character") + "__rtg_character";
  material.userData = {
    ...(sourceMaterial?.userData || {}),
    rtgAuxTextures: aux,
  };

  material.onBeforeCompile = (shader) => {
    const hasOcclusion = !!aux.occlusion;
    const hasSpecularShape = !!aux.specular;
    const hasSpecularMask = !!aux.specular_mask;
    const hasLine = !!aux.line;

    shader.uniforms.g4OcclusionMap = { value: aux.occlusion || null };
    shader.uniforms.g4SpecularShapeMap = { value: aux.specular || null };
    shader.uniforms.g4SpecularMaskMap = { value: aux.specular_mask || null };
    shader.uniforms.g4LineMap = { value: aux.line || null };

    const declarations = [
      hasOcclusion ? "uniform sampler2D g4OcclusionMap;" : "",
      hasSpecularShape ? "uniform sampler2D g4SpecularShapeMap;" : "",
      hasSpecularMask ? "uniform sampler2D g4SpecularMaskMap;" : "",
      hasLine ? "uniform sampler2D g4LineMap;" : "",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      "#include <map_pars_fragment>\n" + declarations,
    );

    const characterComposite = [
      "#ifdef USE_MAP",
      "  vec2 g4Uv = vMapUv;",
      "#else",
      "  vec2 g4Uv = vec2(0.5);",
      "#endif",
      "  vec3 g4Normal = normalize(normal);",
      "  vec3 g4View = normalize(vViewPosition);",
      "  float g4Facing = clamp(abs(dot(g4Normal, g4View)), 0.0, 1.0);",
      "  float g4Rim = pow(1.0 - g4Facing, 3.6);",
      hasOcclusion
        ? "  float g4Occlusion = texture2D(g4OcclusionMap, g4Uv).r; outgoingLight *= mix(0.94, 1.0, g4Occlusion);"
        : "",
      hasSpecularShape
        ? "  vec2 g4SphereUv = g4Normal.xy * vec2(0.5, -0.5) + 0.5; float g4SpecShape = dot(texture2D(g4SpecularShapeMap, g4SphereUv).rgb, vec3(0.333333));"
        : "  float g4SpecShape = 0.0;",
      hasSpecularMask
        ? "  float g4SpecMask = texture2D(g4SpecularMaskMap, g4Uv).r;"
        : "  float g4SpecMask = 1.0;",
      "  float g4Spec = g4SpecShape * g4SpecMask;",
      "  outgoingLight += vec3(0.10, 0.095, 0.11) * g4Spec;",
      "  outgoingLight += vec3(0.16, 0.15, 0.17) * g4Rim * 0.10;",
      "  outgoingLight += vec3(0.015, 0.035, 0.045) * g4Rim * 0.10;",
      hasLine
        ? "  float g4Line = texture2D(g4LineMap, g4Uv).b; float g4Edge = pow(1.0 - g4Facing, 4.5) * g4Line; outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.82, 0.78, 0.80), clamp(g4Edge * 0.12, 0.0, 0.12));"
        : "",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      characterComposite + "\n#include <opaque_fragment>",
    );
  };

  material.customProgramCacheKey = () => [
    "rtg-character-v1",
    aux.occlusion ? "oc" : "",
    aux.specular ? "sp" : "",
    aux.specular_mask ? "spm" : "",
    aux.line ? "line" : "",
  ].join("-");

  return material;
}

async function applyCharacterShader(gltf) {
  const converted = new Map();
  const replacements = [];

  gltf.scene?.traverse?.((node) => {
    if (!node.isMesh || !node.material) return;
    const sources = Array.isArray(node.material) ? node.material : [node.material];

    replacements.push((async () => {
      const next = [];
      for (const source of sources) {
        if (!source) {
          next.push(source);
          continue;
        }
        if (!converted.has(source.uuid)) {
          converted.set(source.uuid, (async () => {
            const aux = await loadNieAuxTextures(gltf, source);
            return buildCharacterMaterial(source, aux);
          })());
        }
        next.push(await converted.get(source.uuid));
      }
      node.material = Array.isArray(node.material) ? next : next[0];
      node.castShadow = false;
      node.receiveShadow = false;
    })());
  });

  await Promise.all(replacements);
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
  const distance = Math.max(heightDistance, widthDistance, 0.5) * 1.10;
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
  const camera = new THREE.PerspectiveCamera(26, RENDER_WIDTH / RENDER_HEIGHT, 0.01, 500);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0bd, 1.45));

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(3.5, 6.5, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xfff7f2, 0.52);
  fill.position.set(-4, 2.5, 4);
  scene.add(fill);

  await applyCharacterShader(gltf);
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
