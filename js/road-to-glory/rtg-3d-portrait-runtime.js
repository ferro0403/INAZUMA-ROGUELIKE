import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MANIFEST_URL = "data/RTG_3D_PROTOTYPE.json";
const LEGACY_CACHE_NAME = "rtg-3d-portrait-v5";
const G4_CACHE_NAME = "rtg-3d-portrait-v6-g4";
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

function selectedShaderMode() {
  const value = String(new URLSearchParams(globalThis.location?.search || "").get("rtg3dShader") || "").trim().toLowerCase();
  return value === "g4" || value === "v6" ? "g4" : "legacy";
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

function cacheKey(playerId, internalCode, uniformId, uniformCrc, shaderMode) {
  const version = shaderMode === "g4" ? "v6-g4" : "v5";
  return [version, playerId, internalCode, uniformId, uniformCrc].map((value) => String(value || "")).join("__");
}

function cacheName(shaderMode) {
  return shaderMode === "g4" ? G4_CACHE_NAME : LEGACY_CACHE_NAME;
}

function cacheRequest(key) {
  return new Request(new URL(CACHE_PREFIX + encodeURIComponent(key) + ".webp", globalThis.location?.origin || "https://localhost").href);
}

async function readCachedBlob(key, name) {
  if (!globalThis.caches) return null;
  try {
    const cache = await caches.open(name);
    const response = await cache.match(cacheRequest(key));
    return response?.ok ? await response.blob() : null;
  } catch (_) {
    return null;
  }
}

async function writeCachedBlob(key, blob, name) {
  if (!globalThis.caches || !blob) return;
  try {
    const cache = await caches.open(name);
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
      "  outgoingLight += vec3(0.055, 0.052, 0.060) * g4Spec;",
      "  outgoingLight += vec3(0.10, 0.095, 0.11) * g4Rim * 0.055;",
      "  outgoingLight += vec3(0.010, 0.022, 0.028) * g4Rim * 0.055;",
      hasLine
        ? "  float g4Line = texture2D(g4LineMap, g4Uv).b; float g4Edge = pow(1.0 - g4Facing, 5.2) * g4Line; outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.88, 0.85, 0.87), clamp(g4Edge * 0.07, 0.0, 0.07));"
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


function buildG4CaptureMaterial(sourceMaterial, aux) {
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
    shininess: 0,
    specular: new THREE.Color(0x000000),
    fog: false,
  });

  if (sourceMaterial?.normalMap) {
    material.normalMap = copyTextureSettings(sourceMaterial.normalMap, { color: false });
    if (sourceMaterial.normalScale?.clone) material.normalScale.copy(sourceMaterial.normalScale);
  }

  material.name = (sourceMaterial?.name || "Character") + "__rtg_g4_capture";
  material.userData = {
    ...(sourceMaterial?.userData || {}),
    rtgAuxTextures: aux,
    rtgShaderMode: "g4",
  };

  material.onBeforeCompile = (shader) => {
    const hasOcclusion = !!aux.occlusion;
    const hasSpecularShape = !!aux.specular;
    const hasSpecularMask = !!aux.specular_mask;

    shader.uniforms.g4OcclusionMap = { value: aux.occlusion || null };
    shader.uniforms.g4SpecularShapeMap = { value: aux.specular || null };
    shader.uniforms.g4SpecularMaskMap = { value: aux.specular_mask || null };
    shader.uniforms.g4LightDirView = { value: new THREE.Vector3(0.32, 0.50, 0.80).normalize() };

    const declarations = [
      "uniform vec3 g4LightDirView;",
      hasOcclusion ? "uniform sampler2D g4OcclusionMap;" : "",
      hasSpecularShape ? "uniform sampler2D g4SpecularShapeMap;" : "",
      hasSpecularMask ? "uniform sampler2D g4SpecularMaskMap;" : "",
      "vec3 g4LinearToUnorm(vec3 c) {",
      "  c = max(c, vec3(0.0));",
      "  vec3 low = c * 12.92;",
      "  vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;",
      "  return mix(high, low, lessThanEqual(c, vec3(0.0031308)));",
      "}",
      "vec3 g4UnormToLinear(vec3 c) {",
      "  c = max(c, vec3(0.0));",
      "  vec3 low = c / 12.92;",
      "  vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));",
      "  return mix(high, low, lessThanEqual(c, vec3(0.04045)));",
      "}",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      "#include <map_pars_fragment>\n" + declarations,
    );

    const g4Composite = [
      "#ifdef USE_MAP",
      "  vec2 g4Uv = vMapUv;",
      "#else",
      "  vec2 g4Uv = vec2(0.5);",
      "#endif",
      "  vec3 g4N = normalize(normal);",
      "  vec3 g4V = normalize(vViewPosition);",
      "  float g4Signed = clamp(dot(g4N, normalize(g4LightDirView)), -1.0, 1.0);",
      hasOcclusion
        ? "  vec3 g4Oc = texture2D(g4OcclusionMap, g4Uv).rgb;"
        : "  vec3 g4Oc = vec3(1.0, 0.0, 0.0);",
      "  float g4OcWeight = clamp(g4Oc.r * 2.0, 0.0, 1.0);",
      "  float g4Offset = g4OcWeight * 0.90 - 0.25;",
      "  float g4Main = g4Signed * 0.35 + g4Offset;",
      "  g4Main = g4Main * 0.5 + 0.5;",
      "  float g4Second = g4Oc.g * (1.0 - g4Main) + g4Main;",
      "  float g4Grad0 = g4Main - 0.50 + 0.50;",
      "  float g4Grad1 = g4Second - 0.54 + 0.50;",
      "  float g4Cover0 = 1.0 - smoothstep(0.751, 0.757, g4Grad0);",
      "  float g4Cover1 = 1.0 - smoothstep(0.527, 0.533, g4Grad1);",
      "  vec3 g4Shadow0 = vec3(0.74995, 0.60020, 0.77992);",
      "  vec3 g4Shadow1 = vec3(0.72967, 0.52992, 0.69982);",
      "  vec3 g4ShadowMix = mix(g4Shadow0, g4Shadow1, g4Cover1);",
      "  vec3 g4Base = g4LinearToUnorm(diffuseColor.rgb);",
      "  float g4Lum = dot(g4Base, vec3(0.29891, 0.58661, 0.11448));",
      "  vec3 g4Shade = g4ShadowMix + vec3(g4Lum * 0.10);",
      "  vec3 g4AmbientColor = vec3(0.924925, 0.874975, 0.874975);",
      "  vec3 g4Ambient = mix(g4Base, g4AmbientColor, 0.04995);",
      "  vec3 g4AmbientMul = g4Ambient * g4AmbientColor;",
      "  float g4AddRate = g4Cover0 * -0.10;",
      "  float g4MulRate = g4Cover0 * 1.30;",
      "  vec3 g4Added = g4AmbientMul + (g4Shade - g4AmbientMul) * g4AddRate;",
      "  vec3 g4Multiplied = g4Added * g4Shade;",
      "  vec3 g4Shaded = g4Added + (g4Multiplied - g4Added) * g4MulRate;",
      "  float g4Recovery = clamp(g4Lum * 0.20 + g4Oc.b, 0.0, 1.0);",
      "  vec3 g4Color = mix(g4Shaded, g4Base, g4Recovery);",
      hasSpecularShape
        ? "  vec2 g4SphereUv = g4N.xy * vec2(0.5, -0.5) + 0.5; vec3 g4SpecShape = texture2D(g4SpecularShapeMap, g4SphereUv).rgb;"
        : "  vec3 g4SpecShape = vec3(0.0);",
      hasSpecularMask
        ? "  vec3 g4SpecMask = texture2D(g4SpecularMaskMap, g4Uv).rgb;"
        : "  vec3 g4SpecMask = vec3(1.0);",
      "  vec3 g4LitSpec = g4SpecShape * g4SpecMask * g4ShadowMix;",
      "  g4LitSpec *= mix(1.0, 0.42, 0.22);",
      "  g4Color += g4LitSpec;",
      "  float g4Facing = clamp(abs(dot(g4N, g4V)), 0.0, 1.0);",
      "  float g4Grazing = 1.0 - g4Facing;",
      "  float g4HighSignal = g4Grazing * g4Signed + g4Main;",
      "  float g4High = clamp((g4HighSignal - 1.5999) * 10000.0, 0.0, 1.0);",
      "  float g4Under = clamp(-g4Signed, 0.0, 1.0) * g4Grazing;",
      "  g4Under = clamp((g4Under + 1.0 - 1.45) * 300.0, 0.0, 1.0);",
      "  g4Color += vec3(0.30) * g4High;",
      "  g4Color += vec3(0.02, 0.075, 0.10) * g4Under;",
      "  outgoingLight = g4UnormToLinear(max(g4Color, vec3(0.0)));",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      g4Composite + "\n#include <opaque_fragment>",
    );
  };

  material.customProgramCacheKey = () => [
    "rtg-g4-capture-v6",
    aux.occlusion ? "oc" : "",
    aux.specular ? "sp" : "",
    aux.specular_mask ? "spm" : "",
  ].join("-");

  return material;
}

async function applyCharacterShader(gltf, shaderMode = "legacy") {
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
            return shaderMode === "g4"
              ? buildG4CaptureMaterial(source, aux)
              : buildCharacterMaterial(source, aux);
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

async function renderGlbToBlob(buffer, sourceUrl, shaderMode = "legacy") {
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc2bcc6, 1.38));

  const key = new THREE.DirectionalLight(0xffffff, 1.22);
  key.position.set(3.5, 6.5, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xfff8f4, 0.46);
  fill.position.set(-4, 2.5, 4);
  scene.add(fill);

  await applyCharacterShader(gltf, shaderMode);
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

  const shaderMode = selectedShaderMode();
  const key = cacheKey(playerId, playerConfig.internalCode, chosenUniformId, uniformCrc, shaderMode);
  const selectedCacheName = cacheName(shaderMode);
  const memoryUrl = memoryUrls.get(key);
  if (memoryUrl) {
    return { url: memoryUrl, cache: "memory", totalMs: 0, uniformId: chosenUniformId, uniformCrc, isKeeper, shaderMode };
  }

  const persistentBlob = await readCachedBlob(key, selectedCacheName);
  if (persistentBlob) {
    return {
      url: objectUrlFor(key, persistentBlob),
      cache: "browser",
      totalMs: 0,
      uniformId: chosenUniformId,
      uniformCrc,
      isKeeper,
      shaderMode,
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

  const rendered = await renderGlbToBlob(buffer, modelUrl, shaderMode);
  await writeCachedBlob(key, rendered.blob, selectedCacheName);
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
    shaderMode,
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
    const shaderLabel = result.shaderMode === "g4" ? "G4" : "3D";
    status.textContent = result.cache === "miss"
      ? shaderLabel + " · " + Math.round(result.totalMs) + " ms · " + (result.isKeeper ? "GK" : "campo")
      : shaderLabel + " · cache " + result.cache + " · " + (result.isKeeper ? "GK" : "campo");
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
