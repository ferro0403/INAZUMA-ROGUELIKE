import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MANIFEST_URL = "data/RTG_3D_PROTOTYPE.json";
const LEGACY_CACHE_NAME = "rtg-3d-portrait-v5";
const G4_CACHE_NAME = "rtg-3d-portrait-v6-g4";
const NATIVE_CACHE_NAME = "rtg-3d-portrait-v7-native-data";
const NATIVE_EDGE_CACHE_NAME = "rtg-3d-portrait-v26-native-mask-normal-edge";
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
  if (value === "native-edge" || value === "edge2" || value === "v8" || value === "v9" || value === "v10" || value === "v11" || value === "v12" || value === "v13" || value === "v14" || value === "v15" || value === "v16" || value === "v17" || value === "v18" || value === "v19" || value === "v20" || value === "v21" || value === "v22" || value === "v23" || value === "v24" || value === "v25" || value === "v26") return "native-edge";
  if (value === "native" || value === "v7") return "native";
  return value === "g4" || value === "v6" ? "g4" : "legacy";
}

function compareEnabled() {
  const value = String(new URLSearchParams(globalThis.location?.search || "").get("rtg3dCompare") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "g4-native";
}

function freshRenderEnabled() {
  const value = String(new URLSearchParams(globalThis.location?.search || "").get("rtg3dFresh") || "").trim().toLowerCase();
  return value === "1" || value === "true";
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

function normalizedRgbaBytes(value) {
  if (!Array.isArray(value) || value.length < 4) return null;
  const bytes = value.slice(0, 4).map((component) => {
    const numeric = Number(component);
    return Number.isFinite(numeric) ? Math.min(255, Math.max(0, Math.round(numeric))) : 0;
  });
  return bytes.map((component) => component / 255);
}

function nativeRecolorForUniform(uniform, isKeeper, uniformCrc) {
  const config = uniform?.nativeRecolor;
  const record = isKeeper ? config?.keeper : config?.fielder;
  if (!config || !record) return null;
  if (String(record.crc || "").toUpperCase() !== String(uniformCrc || "").toUpperCase()) return null;

  const subColor1 = normalizedRgbaBytes(record.subColor1);
  const subColor2 = normalizedRgbaBytes(record.subColor2);
  if (!subColor1 || !subColor2) return null;

  return Object.freeze({
    source: String(config.source || ""),
    record: String(config.record || ""),
    logicalCode: String(record.logicalCode || ""),
    crc: String(record.crc || ""),
    redChannelMode: String(config.redChannelMode || ""),
    subColor1,
    subColor2,
  });
}

function cacheKey(playerId, internalCode, uniformId, uniformCrc, shaderMode) {
  const version = shaderMode === "native-edge"
    ? "v26-native-mask-normal-edge"
    : shaderMode === "native"
      ? "v7-native-data"
      : shaderMode === "g4"
        ? "v6-g4"
        : "v5";
  return [version, playerId, internalCode, uniformId, uniformCrc].map((value) => String(value || "")).join("__");
}

function cacheName(shaderMode) {
  if (shaderMode === "native-edge") return NATIVE_EDGE_CACHE_NAME;
  if (shaderMode === "native") return NATIVE_CACHE_NAME;
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

function inspectGlbNativePayload(buffer) {
  try {
    const view = new DataView(buffer);
    let offset = 12;
    let json = null;
    while (offset + 8 <= buffer.byteLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      const start = offset + 8;
      const end = start + length;
      if (end > buffer.byteLength) break;
      if (type === 0x4E4F534A) {
        const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer, start, length)).replace(/\u0000+$/g, "").trim();
        json = JSON.parse(text);
        break;
      }
      offset = end;
    }
    if (!json) return null;

    const usedMaterials = new Set();
    const nativeMaterials = new Set();
    const materialDebug = new Map();
    let primitiveCount = 0;
    let colorPrimitives = 0;

    for (const mesh of json.meshes || []) {
      for (const primitive of mesh?.primitives || []) {
        primitiveCount += 1;
        if (primitive?.attributes?.COLOR_0 !== undefined) colorPrimitives += 1;
        const materialIndex = Number(primitive?.material);
        if (!Number.isInteger(materialIndex) || materialIndex < 0) continue;
        usedMaterials.add(materialIndex);
        const nie = json.materials?.[materialIndex]?.extras?.nie;
        if (nie && typeof nie === "object" && (
          nie.shader_hash !== undefined
          || Array.isArray(nie.shader_parameters)
          || Array.isArray(nie.native_colors)
          || Array.isArray(nie.render_states)
        )) {
          nativeMaterials.add(materialIndex);
          if (!materialDebug.has(materialIndex)) {
            const textures = nie.textures && typeof nie.textures === "object"
              ? Object.keys(nie.textures).sort()
              : [];
            materialDebug.set(materialIndex, {
              materialIndex,
              name: String(json.materials?.[materialIndex]?.name || ""),
              sourceMaterial: String(nie.source_material || ""),
              shaderHash: typeof nie.shader_hash_hex === "string"
                ? nie.shader_hash_hex
                : Number.isInteger(Number(nie.shader_hash))
                  ? "0x" + (Number(nie.shader_hash) >>> 0).toString(16).toUpperCase().padStart(8, "0")
                  : "",
              textures,
              textureDescriptors: nie.textures && typeof nie.textures === "object" ? nie.textures : {},
              nativeColors: Array.isArray(nie.native_colors) ? nie.native_colors : [],
              shaderParameters: Array.isArray(nie.shader_parameters) ? nie.shader_parameters : [],
              extraKeys: Object.keys(nie).sort(),
            });
          }
        }
      }
    }

    return {
      usedMaterials: usedMaterials.size,
      nativeMaterials: nativeMaterials.size,
      primitiveCount,
      colorPrimitives,
      materialDebug: [...materialDebug.values()],
    };
  } catch (error) {
    console.warn("[RTG 3D portrait] diagnostica JSON GLB non disponibile", error);
    return null;
  }
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

function materialIndexForNode(gltf, node) {
  const association = gltf?.parser?.associations?.get?.(node);
  const meshIndex = Number(association?.meshes);
  const primitiveIndex = Number(association?.primitives);
  if (!Number.isInteger(meshIndex) || meshIndex < 0 || !Number.isInteger(primitiveIndex) || primitiveIndex < 0) {
    return null;
  }
  const materialIndex = Number(gltf?.parser?.json?.meshes?.[meshIndex]?.primitives?.[primitiveIndex]?.material);
  return Number.isInteger(materialIndex) && materialIndex >= 0 ? materialIndex : null;
}

function nieMaterialExtras(gltf, sourceMaterial, materialIndexHint = null) {
  const direct = sourceMaterial?.userData?.nie;
  if (direct && typeof direct === "object") return direct;

  let materialIndex = Number(materialIndexHint);
  if (!Number.isInteger(materialIndex) || materialIndex < 0) {
    const association = gltf?.parser?.associations?.get?.(sourceMaterial);
    materialIndex = Number(association?.materials);
  }
  if (!Number.isInteger(materialIndex) || materialIndex < 0) return null;

  const fromJson = gltf?.parser?.json?.materials?.[materialIndex]?.extras?.nie;
  return fromJson && typeof fromJson === "object" ? fromJson : null;
}

async function loadNieAuxTextures(gltf, sourceMaterial, materialIndexHint = null) {
  const descriptors = nieMaterialExtras(gltf, sourceMaterial, materialIndexHint)?.textures;
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

function normalizeNativeVec4List(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Array.isArray(entry) && entry.length >= 4)
    .map((entry) => entry.slice(0, 4).map((component) => Number(component) || 0));
}

function normalizeNativeRenderStates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Array.isArray(entry) && entry.length >= 2)
    .map((entry) => [Number(entry[0]) || 0, Number(entry[1]) || 0]);
}

function readNieNativeMaterial(gltf, sourceMaterial, materialIndexHint = null) {
  const nie = nieMaterialExtras(gltf, sourceMaterial, materialIndexHint);
  if (!nie) return null;

  const shaderHash = Number(nie.shader_hash);
  const shaderParameters = normalizeNativeVec4List(nie.shader_parameters);
  const nativeColors = normalizeNativeVec4List(nie.native_colors);
  const renderStates = normalizeNativeRenderStates(nie.render_states);
  const hasNativePayload = Number.isInteger(shaderHash)
    || shaderParameters.length > 0
    || nativeColors.length > 0
    || renderStates.length > 0;
  if (!hasNativePayload) return null;

  return Object.freeze({
    sourceMaterial: String(nie.source_material || sourceMaterial?.name || ""),
    sourceMaterialIndex: Number.isInteger(Number(nie.source_material_index))
      ? Number(nie.source_material_index)
      : null,
    sourcePiece: String(nie.source_piece || ""),
    shaderHash: Number.isInteger(shaderHash) ? shaderHash >>> 0 : null,
    shaderHashHex: typeof nie.shader_hash_hex === "string"
      ? nie.shader_hash_hex
      : Number.isInteger(shaderHash)
        ? "0x" + (shaderHash >>> 0).toString(16).toUpperCase().padStart(8, "0")
        : "",
    shaderParameters,
    nativeColors,
    renderStates,
  });
}

const NATIVE_SHADER_FAMILIES = Object.freeze({
  [0xC94BC3EA]: Object.freeze({
    id: "toon",
    shaderFx: "Chr_Toon",
    fxbin: "chr_toon.fxbin",
    pixelShader: "chr_toon.pfxo",
  }),
  [0x61C84B7D]: Object.freeze({
    id: "toon-metal",
    shaderFx: "Chr_ToonMetal",
    fxbin: "chr_toon_metal.fxbin",
    pixelShader: "chr_toon_metal.pfxo",
  }),
  [0x5B442961]: Object.freeze({
    id: "toon-variable",
    shaderFx: "Chr_ToonVariable",
    fxbin: "chr_toon_variable.fxbin",
    pixelShader: "chr_toon_variable.pfxo",
  }),
  [0xFBCE9C2D]: Object.freeze({
    id: "edit-toon",
    shaderFx: "Chr_EditToon",
    fxbin: "chr_edit_toon.fxbin",
    pixelShader: "chr_toon_edit.pfxo",
  }),
});

const UNKNOWN_NATIVE_SHADER_FAMILY = Object.freeze({
  id: "unknown",
  shaderFx: "",
  fxbin: "",
  pixelShader: "",
});

function nativeShaderFamily(nativeMaterial) {
  const hash = Number(nativeMaterial?.shaderHash);
  return Number.isInteger(hash)
    ? NATIVE_SHADER_FAMILIES[hash >>> 0] || UNKNOWN_NATIVE_SHADER_FAMILY
    : UNKNOWN_NATIVE_SHADER_FAMILY;
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


const NATIVE_GRADIENT_URL = new URL("../../assets/rtg/chrGrd_01.png", import.meta.url).href;
let nativeGradientPixelsPromise = null;

function loadNativeGradientPixels() {
  if (!nativeGradientPixelsPromise) {
    nativeGradientPixelsPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        try {
          const width = Number(image.naturalWidth || image.width);
          const height = Number(image.naturalHeight || image.height);
          if (width !== 512 || height !== 256) {
            throw new Error("chrGrd_01 inattesa: " + width + "x" + height);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: false });
          if (!context) throw new Error("Canvas 2D non disponibile per chrGrd_01");
          context.drawImage(image, 0, 0);
          const imageData = context.getImageData(0, 0, width, height);
          resolve({
            width,
            height,
            pixels: new Uint8Array(imageData.data),
          });
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Impossibile decodificare chrGrd_01"));
      image.src = NATIVE_GRADIENT_URL;
    });
  }
  return nativeGradientPixelsPromise;
}

async function buildNativeGradientTexture() {
  // Full original chrGrd_01 decoded losslessly from the game's
  // data/dx11/chr/shader/texture/chr_tex.g4tx (512x256 BC3/DXT5, no mip chain).
  // Keep row 0 first in the typed array: G4/D3D material V coordinates near 1.0
  // must address the bottom rows (Mark: 254/256 and 250/256), not their flipped top rows.
  const source = await loadNativeGradientPixels();
  const texture = new THREE.DataTexture(
    source.pixels,
    source.width,
    source.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function buildG4NativeDataMaterial(sourceMaterial, aux, profile = "general", nativeMaterial = null, gradient = null, nativeRecolor = null) {
  if (!gradient) throw new Error("chrGrd_01 nativa non disponibile");
  const useCaptureProfile = profile === "capture";
  const shaderFamily = nativeShaderFamily(nativeMaterial);
  // DXBC/resource-table evidence: only Chr_ToonMetal declares in_tex2 + in_tex3 as its metal extras.
  // Do not feed those textures into Toon, ToonVariable or EditToon as synthetic specular maps.
  const useMetalTextures = shaderFamily.id === "toon-metal";
  const nativeSpecularShape = useMetalTextures ? aux.specular || null : null;
  const nativeSpecularMask = useMetalTextures ? aux.specular_mask || null : null;
  const useMetalBranch = useMetalTextures && !!nativeSpecularShape && !!nativeSpecularMask;
  const nativeAmbientX = Number(nativeMaterial?.nativeColors?.[1]?.[0]) || 0.0;
  // chr_toon_metal.pfxo instructions 311-321:
  // shadowMetal = saturate(shadowSignal * (u_charaShadowParam.z + u_charaShadowParam.w));
  // metalScale = 1 - shadowMetal.
  // RTG capture proves u_charaShadowParam=[1,1,0,1], so z+w=1.
  const nativeMetalShadowZW = useCaptureProfile ? 1.0 : 0.0;
  // nie-model-serve currently bakes the mask's red-channel skin tint into the emitted
  // uniform base texture. Applying u_skinColor again here would double-tint skin.
  // The green/blue channels remain untouched and map to the two CHARA_PARTS_COLOR words.
  const useEditRecolor = shaderFamily.id === "edit-toon"
    && !!aux.mask
    && nativeRecolor?.redChannelMode === "server-baked-skin";
  const param0 = nativeMaterial?.shaderParameters?.[0];
  const param1 = nativeMaterial?.shaderParameters?.[1];
  const shaderParam0 = Array.isArray(param0) && param0.length >= 4
    ? param0.slice(0, 4).map((value) => Number(value) || 0)
    : [1.0, 1.0, 1.0, 0.0];
  const shaderParam1 = Array.isArray(param1) && param1.length >= 4
    ? param1.slice(0, 4).map((value) => Number(value) || 0)
    : [1.0, 1.0, 1.0, 0.0];
  const editSubColor1 = useEditRecolor ? nativeRecolor.subColor1 : [1.0, 1.0, 1.0, 0.0];
  const editSubColor2 = useEditRecolor ? nativeRecolor.subColor2 : [1.0, 1.0, 1.0, 0.0];
  const param4 = nativeMaterial?.shaderParameters?.[4];
  const shaderParam4 = Array.isArray(param4) && param4.length >= 4
    ? param4.slice(0, 4).map((value) => Number(value) || 0)
    : null;
  // chr_toon_variable.pfxo first computes the atlas cell from u_shaderParam4.
  // u_varableParam can dynamically override it at runtime; that user-data buffer is
  // not present in the exported GLB, so v17 implements only the native default branch
  // (override blend = 0), never an invented expression value.
  const useVariableAtlas = shaderFamily.id === "toon-variable"
    && !!sourceMaterial?.map
    && !!shaderParam4
    && shaderParam4[1] > 0
    && shaderParam4[2] !== 0;
  const param2 = nativeMaterial?.shaderParameters?.[2];
  const shaderParam2 = Array.isArray(param2) && param2.length >= 4
    ? param2.slice(0, 4).map((value) => Number(value) || 0)
    : [0.9921875, 0.9765625, 0.0, 0.0];
  const nativeLightData = useCaptureProfile
    ? {
        source: "light_2d_capture.cfg.bin",
        charaAmbient: [1.0, 1.0, 1.0, 1.0],
        charaLightDir: [0.358, 0.614, 0.703],
        charaHighLightColor: [0.10, 0.10, 0.10, 1.50],
        charaShadowColor1: [0.77, 0.70, 0.65, 0.50],
        charaShadowColor2: [0.62, 0.54, 0.50, 0.55],
        charaToonMaskRate: 1.10,
        charaToonMaskLightRate: 0.50,
        occlusionParam: [0.25, 0.65, 0.0, 0.0],
        charaShadowBlendRate: 1.20,
        charaUnderRimColor: [0.07, 0.07, 0.07, 1.45],
        charaBlendRateParam: [0.50, 300.0, 0.20, 0.10],
        charaAmbLightParam: [0.0, 1.0],
        charaGrTParam: [0.0, 1.0, 1.0, 0.0],
        edge2OutlineScale: 2.5,
      }
    : {
        source: "light_data.cfg.bin",
        charaAmbient: [1.0, 1.0, 1.0, 1.0],
        charaLightDir: [0.83, 0.40, 0.37],
        charaHighLightColor: [0.10, 0.10, 0.10, 1.50],
        charaShadowColor1: [0.67, 0.60, 0.55, 0.50],
        charaShadowColor2: [0.52, 0.44, 0.40, 0.55],
        charaToonMaskRate: 1.10,
        charaToonMaskLightRate: 0.50,
        charaShadowBlendRate: 1.20,
        charaUnderRimColor: [0.07, 0.07, 0.07, 1.45],
        charaBlendRateParam: [0.50, 300.0, 0.20, 0.10],
        charaAmbLightParam: [0.0, 1.0],
        charaGrTParam: [0.0, 1.0, 1.0, 0.50],
      };
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

  material.name = (sourceMaterial?.name || "Character") + "__rtg_native_data";
  material.userData = {
    ...(sourceMaterial?.userData || {}),
    rtgAuxTextures: aux,
    rtgNativeGradientTexture: gradient,
    rtgNativeMaterial: nativeMaterial,
    rtgNativeShaderFamily: shaderFamily.id,
    rtgNativeShaderFx: shaderFamily.shaderFx,
    rtgNativeFxbin: shaderFamily.fxbin,
    rtgNativePixelShader: shaderFamily.pixelShader,
    rtgNativeShaderParam2: shaderParam2,
    rtgNativeEditRecolorApplied: useEditRecolor,
    rtgNativeEditRecolor: useEditRecolor ? nativeRecolor : null,
    rtgNativeVariableAtlasApplied: useVariableAtlas,
    rtgNativeShaderParam4: shaderParam4,
    rtgNativeMetalBranchApplied: useMetalBranch,
    rtgNativeAmbientX: nativeAmbientX,
    rtgShaderMode: useCaptureProfile ? "native-edge" : "native",
    rtgNativeLightData: nativeLightData,
    rtgNativeLightDirWorld: new THREE.Vector3(...nativeLightData.charaLightDir).normalize(),
  };

  material.onBeforeCompile = (shader) => {
    const hasOcclusion = !!aux.occlusion;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nattribute vec4 color;\nvarying float g4NativeVertexAlpha;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  g4NativeVertexAlpha = color.a;",
    );
    const hasSpecularShape = !!nativeSpecularShape;
    const hasSpecularMask = !!nativeSpecularMask;

    shader.uniforms.g4OcclusionMap = { value: aux.occlusion || null };
    shader.uniforms.g4SpecularShapeMap = { value: nativeSpecularShape };
    shader.uniforms.g4SpecularMaskMap = { value: nativeSpecularMask };
    shader.uniforms.g4EditMaskMap = { value: useEditRecolor ? aux.mask : null };
    shader.uniforms.g4ShaderParam0 = { value: new THREE.Vector4(...shaderParam0) };
    shader.uniforms.g4ShaderParam1 = { value: new THREE.Vector4(...shaderParam1) };
    shader.uniforms.g4EditSubColor1 = { value: new THREE.Vector4(...editSubColor1) };
    shader.uniforms.g4EditSubColor2 = { value: new THREE.Vector4(...editSubColor2) };
    shader.uniforms.g4ShaderParam4 = { value: new THREE.Vector4(...(shaderParam4 || [0, 1, 1, 0])) };
    shader.uniforms.g4NativeGradientMap = { value: gradient };
    shader.uniforms.g4ShaderParam2 = { value: new THREE.Vector4(...shaderParam2) };
    shader.uniforms.g4LightDirView = { value: material.userData.rtgNativeLightDirWorld.clone() };
    material.userData.rtgNativeCompiledShader = shader;

    const declarations = [
      "uniform vec3 g4LightDirView;",
      "varying float g4NativeVertexAlpha;",
      "uniform sampler2D g4NativeGradientMap;",
      "uniform vec4 g4ShaderParam2;",
      hasOcclusion ? "uniform sampler2D g4OcclusionMap;" : "",
      hasSpecularShape ? "uniform sampler2D g4SpecularShapeMap;" : "",
      hasSpecularMask ? "uniform sampler2D g4SpecularMaskMap;" : "",
      useEditRecolor ? "uniform sampler2D g4EditMaskMap;" : "",
      useEditRecolor ? "uniform vec4 g4ShaderParam0;" : "",
      useEditRecolor ? "uniform vec4 g4ShaderParam1;" : "",
      useEditRecolor ? "uniform vec4 g4EditSubColor1;" : "",
      useEditRecolor ? "uniform vec4 g4EditSubColor2;" : "",
      useVariableAtlas ? "uniform vec4 g4ShaderParam4;" : "",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      "#include <map_pars_fragment>\n" + declarations,
    );

    if (useVariableAtlas) {
      // chr_toon_variable.pfxo native default path:
      // columns = uint(param4.y), slot = uint(param4.x),
      // col = slot % columns, row = slot / columns,
      // uv += (col / columns, row / (columns * param4.z)).
      // Mark: eye [0,4,0.5,0] => slot 0; mouth [4,4,0.5,0] => +0.5 V.
      const variableMapFragment = [
        "#ifdef USE_MAP",
        "  float g4VarColumns = max(floor(g4ShaderParam4.y), 1.0);",
        "  float g4VarSlot = max(floor(g4ShaderParam4.x), 0.0);",
        "  float g4VarRow = floor(g4VarSlot / g4VarColumns);",
        "  float g4VarColumn = g4VarSlot - g4VarRow * g4VarColumns;",
        "  float g4VarCellWidth = 1.0 / g4VarColumns;",
        "  float g4VarVScale = max(abs(g4ShaderParam4.z), 0.000001);",
        "  vec2 g4VariableUv = vMapUv + vec2(g4VarColumn * g4VarCellWidth, g4VarRow * g4VarCellWidth / g4VarVScale);",
        "  vec4 sampledDiffuseColor = texture2D(map, g4VariableUv);",
        "  #ifdef DECODE_VIDEO_TEXTURE",
        "    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);",
        "  #endif",
        "  diffuseColor *= sampledDiffuseColor;",
        "#endif",
      ].join("\n");
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", variableMapFragment);
    }

    const nativeComposite = [
      "#ifdef USE_MAP",
      "  vec2 g4Uv = vMapUv;",
      "#else",
      "  vec2 g4Uv = vec2(0.5);",
      "#endif",
      "  vec3 g4N = normalize(normal);",
      "  vec3 g4V = normalize(vViewPosition);",
      "  float g4NdotV = clamp(dot(g4N, g4V), 0.0, 1.0);",
      "  float g4NdotL = clamp(dot(g4N, normalize(g4LightDirView)), -1.0, 1.0);",
      hasOcclusion
        ? "  vec3 g4Oc = texture2D(g4OcclusionMap, g4Uv).rgb;"
        : "  vec3 g4Oc = vec3(1.0, 0.0, 0.0);",
      // chr_toon.pfxo: dp2_sat r6.x, r4.xxxx, v1.wwww
      // = saturate(2 * occlusion.r * COLOR_0.a).
      "  float g4OcWeight = clamp(g4Oc.r * g4NativeVertexAlpha * 2.0, 0.0, 1.0);",
      "  float g4OcBase = g4OcWeight * 0.90 - 0.25;",
      "  float g4Grazing = 1.0 - g4NdotV;",
      "  float g4PositiveRim = clamp(g4Grazing * g4NdotL, 0.0, 1.0);",
      "  float g4NegativeRim = clamp(-g4Grazing * g4NdotL, 0.0, 1.0);",
      "  float g4Main = (g4OcBase + g4NdotL * 0.35) * 0.5 + 0.5;",
      "  float g4Second = g4Main + g4Oc.g * (1.0 - g4Main);",
      // DXBC swaps the temporary pair before adding 0.5:
      // row0 X = saturate(main), row1 X = saturate(second - 0.05).
      "  float g4Grad0X = clamp(g4Main, 0.0, 1.0);",
      "  float g4Grad1X = clamp(g4Second - 0.05, 0.0, 1.0);",
      "  vec4 g4Grad0 = texture2D(g4NativeGradientMap, vec2(g4Grad0X, g4ShaderParam2.x));",
      "  vec4 g4Grad1 = texture2D(g4NativeGradientMap, vec2(g4Grad1X, g4ShaderParam2.y));",
      "  vec3 g4Shadow0 = vec3(" + nativeLightData.charaShadowColor1.slice(0, 3).join(", ") + ");",
      "  vec3 g4Shadow1 = vec3(" + nativeLightData.charaShadowColor2.slice(0, 3).join(", ") + ");",
      // chr_toon.pfxo 1875..1894: gradient RGB participates directly;
      // gradient1.a blends the two shadow-colored gradient samples.
      "  vec3 g4ToonShade0 = g4Grad0.rgb * g4Shadow0;",
      "  vec3 g4ToonShade1 = g4Grad1.rgb * g4Shadow1;",
      "  vec3 g4ShadowMix = mix(g4ToonShade0, g4ToonShade1, g4Grad1.a);",
      "  vec3 g4Base = diffuseColor.rgb;",
      useEditRecolor
        ? "  vec3 g4EditMask = texture2D(g4EditMaskMap, g4Uv).rgb;"
        : "",
      useEditRecolor
        ? "  vec3 g4EditColor1 = mix(g4ShaderParam0.rgb, g4EditSubColor1.rgb, g4EditSubColor1.a);"
        : "",
      useEditRecolor
        ? "  vec3 g4EditColor2 = mix(g4ShaderParam1.rgb, g4EditSubColor2.rgb, g4EditSubColor2.a);"
        : "",
      useEditRecolor
        ? "  g4Base *= mix(vec3(1.0), g4EditColor1, g4EditMask.g);"
        : "",
      useEditRecolor
        ? "  g4Base *= mix(vec3(1.0), g4EditColor2, g4EditMask.b);"
        : "",
      "  float g4Lum = dot(g4Base, vec3(0.29891, 0.58661, 0.11448));",
      // No external shadow RT is bound in the browser portrait. Native PS takes
      // max(shadowRT, gradient0.a), so the exact available fallback is gradient0.a.
      "  float g4ShadowSignal = g4Grad0.a;",
      "  vec3 g4Shade = g4ShadowMix + vec3(g4Lum * 0.10);",
      // light_2d_capture: charaAmbLightParam=(0,1), charaAmbient=(1,1,1).
      // This reduces the native ambient branch exactly to the base color.
      "  vec3 g4AmbientBase = g4Base;",
      // light_2d_capture: charaShadowParam.zw=(0,1).
      "  float g4ShadowAdd = g4ShadowSignal * 0.0;",
      "  float g4ShadowMul = g4ShadowSignal * 1.0;",
      "  vec3 g4Shaded = mix(g4AmbientBase, g4Shade, g4ShadowAdd) * mix(vec3(1.0), g4Shade, g4ShadowMul);",
      // chr_toon.pfxo 2054..2082: base-color recovery from luminance + occlusion B.
      "  float g4Recovery = clamp(g4Lum * 0.20 + g4Oc.b, 0.0, 1.0);",
      "  vec3 g4Color = mix(g4Shaded, g4Base, g4Recovery);",

      // Native highlight mask: saturate((grazing*NdotL + main - 1.5) * 10000).
      "  float g4High = clamp((g4PositiveRim + g4Main - 1.50) * 10000.0, 0.0, 1.0);",
      // Native under-rim signal from chr_toon.pfxo 354..371 / 2118..2134.
      "  float g4UnderSignal = (g4OcBase + g4NdotL * (0.65 - 1.0)) * 0.5 + g4NegativeRim;",
      "  float g4Under = clamp((g4UnderSignal + 0.5 - 1.45) * 300.0, 0.0, 1.0);",
      "  vec3 g4Rim = vec3(0.10) * g4High + vec3(0.07) * g4Under;",
      // charaBlendRateParam.x = 0.5: native rim is attenuated by current color.
      "  g4Color += g4Rim * (vec3(1.0) - g4Color * 0.50);",
      // chr_toon_metal.pfxo samples t3/t4 only at the very end of beauty.
      // u_mtxEyeSphere is not yet exported; Three's view-space normal keeps the
      // existing sphere projection isolated until that camera matrix is proven.
      useMetalBranch
        ? "  vec2 g4SphereUv = g4N.xy * vec2(0.5, -0.5) + 0.5;"
        : "",
      useMetalBranch
        ? "  vec3 g4MetalSphere = texture2D(g4SpecularShapeMap, g4SphereUv).rgb;"
        : "",
      useMetalBranch
        ? "  vec3 g4MetalMask = texture2D(g4SpecularMaskMap, g4Uv).rgb;"
        : "",
      useMetalBranch
        ? "  float g4MetalShadow = clamp(g4ShadowSignal * " + nativeMetalShadowZW.toFixed(1) + ", 0.0, 1.0);"
        : "",
      useMetalBranch
        ? "  float g4MetalScale = 1.0 - g4MetalShadow;"
        : "",
      useMetalBranch
        ? "  g4Color = g4Color * " + (1.0 + nativeAmbientX).toFixed(6) + " + g4MetalSphere * g4MetalMask * g4MetalScale;"
        : "",
      "  outgoingLight = max(g4Color, vec3(0.0));",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      nativeComposite + "\n#include <opaque_fragment>",
    );
  };

  material.onBeforeRender = (_renderer, _scene, camera) => {
    const shader = material.userData?.rtgNativeCompiledShader;
    const worldLight = material.userData?.rtgNativeLightDirWorld;
    if (!shader?.uniforms?.g4LightDirView || !worldLight || !camera?.matrixWorldInverse) return;
    shader.uniforms.g4LightDirView.value
      .copy(worldLight)
      .transformDirection(camera.matrixWorldInverse)
      .normalize();
  };

  material.customProgramCacheKey = () => [
    useCaptureProfile ? "rtg-g4-native-capture-v23-metal-shadow" : "rtg-g4-native-data-v23-metal-shadow",
    shaderFamily.id,
    useEditRecolor ? "editmask" : "no-editmask",
    useVariableAtlas ? "toonvar-default" : "no-toonvar",
    nativeMaterial?.shaderHashHex || "no-native-hash",
    aux.occlusion ? "oc" : "",
    aux.specular ? "sp" : "",
    aux.specular_mask ? "spm" : "",
  ].join("-");

  return material;
}

async function applyCharacterShader(gltf, shaderMode = "legacy", nativeRecolor = null) {
  const converted = new Map();
  const replacements = [];
  const nativeSourceUuids = new Set();
  const nativeShaderHashes = new Set();
  const nativeShaderFamilies = new Map();
  let nativeMaterials = 0;
  let missingNativeMaterials = 0;
  let shaderParam2Materials = 0;
  let editRecolorMaterials = 0;
  let variableAtlasMaterials = 0;
  let metalBranchMaterials = 0;

  gltf.scene?.traverse?.((node) => {
    if (!node.isMesh || !node.material) return;
    const sources = Array.isArray(node.material) ? node.material : [node.material];
    const materialIndexHint = materialIndexForNode(gltf, node);

    replacements.push((async () => {
      const next = [];
      for (const source of sources) {
        if (!source) {
          next.push(source);
          continue;
        }
        const conversionKey = source.uuid + ":" + String(materialIndexHint ?? "na");
        const native = (shaderMode === "native" || shaderMode === "native-edge")
          ? readNieNativeMaterial(gltf, source, materialIndexHint)
          : null;
        if (!nativeSourceUuids.has(conversionKey) && (shaderMode === "native" || shaderMode === "native-edge")) {
          nativeSourceUuids.add(conversionKey);
          if (native) {
            nativeMaterials += 1;
            if (Array.isArray(native.shaderParameters?.[2]) && native.shaderParameters[2].length >= 4) {
              shaderParam2Materials += 1;
            }
            if (native.shaderHashHex) nativeShaderHashes.add(native.shaderHashHex);
            const familyId = nativeShaderFamily(native).id;
            nativeShaderFamilies.set(familyId, (nativeShaderFamilies.get(familyId) || 0) + 1);
          } else {
            missingNativeMaterials += 1;
          }
        }
        if (!converted.has(conversionKey)) {
          converted.set(conversionKey, (async () => {
            const aux = await loadNieAuxTextures(gltf, source, materialIndexHint);
            if (shaderMode === "native-edge" || shaderMode === "native") {
              const gradient = await buildNativeGradientTexture();
              const material = shaderMode === "native-edge"
                ? buildG4NativeDataMaterial(source, aux, "capture", native, gradient, nativeRecolor)
                : buildG4NativeDataMaterial(source, aux, "general", native, gradient, nativeRecolor);
              if (material?.userData?.rtgNativeEditRecolorApplied) editRecolorMaterials += 1;
              if (material?.userData?.rtgNativeVariableAtlasApplied) variableAtlasMaterials += 1;
              if (material?.userData?.rtgNativeMetalBranchApplied) metalBranchMaterials += 1;
              return material;
            }
            return shaderMode === "g4"
              ? buildG4CaptureMaterial(source, aux)
              : buildCharacterMaterial(source, aux);
          })());
        }
        next.push(await converted.get(conversionKey));
      }
      node.material = Array.isArray(node.material) ? next : next[0];
      node.castShadow = false;
      node.receiveShadow = false;
    })());
  });

  await Promise.all(replacements);
  return {
    materials: nativeMaterials,
    missing: missingNativeMaterials,
    shaderParam2: shaderParam2Materials,
    editRecolor: editRecolorMaterials,
    variableAtlas: variableAtlasMaterials,
    metalBranch: metalBranchMaterials,
    shaderHashes: [...nativeShaderHashes].sort(),
    shaderFamilies: Object.fromEntries([...nativeShaderFamilies.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
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


const NATIVE_EDGE2_CAPTURE_PROFILE = Object.freeze({
  // light_2d_capture.cfg.bin proves edge2OutlineScale=2.5, but it does not
  // provide the edge2 depth max/offset pair. Keep the native shader's explicit
  // max <= 0 fallback branch instead of inventing EventMap values for RTG.
  depthScaleMax: 0.0,
  depthScaleOffset: 0.0,
  edgeScale: 2.5,
  shaderParam7: Object.freeze([0.30, 0.30, 0.30, 1.0]),
});

const NATIVE_SCREEN_EDGE_PROFILE = Object.freeze({
  // light_data.cfg.bin
  edgeColor: Object.freeze([0.30, 0.30, 0.30, 1.0]),
  edgeWeight0: Object.freeze([0.30, 0.30, 0.0, 0.05]),
  edgeWeight1: Object.freeze([0.30, 1.0, 1.50, 0.0]),
  // edge_tone.vfxo writes these constants straight into TEXCOORD.zw.
  toneVertexParam: Object.freeze([0.005, 0.10]),
  edgeToneUrl: "assets/rtg/edgeTone01.png",
});

let nativeEdgeTonePixelsPromise = null;
let nativeEdgeToneTexturePromise = null;

function loadNativeEdgeTonePixels() {
  if (!nativeEdgeTonePixelsPromise) {
    nativeEdgeTonePixelsPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        try {
          const width = Number(image.naturalWidth || image.width);
          const height = Number(image.naturalHeight || image.height);
          if (width !== 128 || height !== 64) {
            throw new Error("edgeTone01 inattesa: " + width + "x" + height);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: false });
          if (!context) throw new Error("Canvas 2D non disponibile per edgeTone01");
          context.drawImage(image, 0, 0);
          const imageData = context.getImageData(0, 0, width, height);
          resolve({
            width,
            height,
            pixels: new Uint8Array(imageData.data),
          });
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Impossibile decodificare edgeTone01"));
      image.src = NATIVE_SCREEN_EDGE_PROFILE.edgeToneUrl;
    });
  }
  return nativeEdgeTonePixelsPromise;
}

async function nativeEdgeToneTexture() {
  if (!nativeEdgeToneTexturePromise) {
    nativeEdgeToneTexturePromise = loadNativeEdgeTonePixels().then((source) => {
      // Do not upload the HTMLImageElement directly. Chromium/WebGL rejected the
      // extracted LUT with texSubImage2D bad image data in V24. Like chrGrd_01,
      // upload the decoded RGBA bytes through DataTexture instead.
      const texture = new THREE.DataTexture(
        source.pixels,
        source.width,
        source.height,
        THREE.RGBAFormat,
        THREE.UnsignedByteType,
      );
      texture.name = "edgeTone01";
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return texture;
    });
  }
  return nativeEdgeToneTexturePromise;
}

function makeFullscreenPass(fragmentShader, uniforms, name) {
  const material = new THREE.ShaderMaterial({
    name,
    uniforms,
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = vec4(position.xy, 0.0, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { scene, camera: new THREE.Camera(), material, mesh };
}

function disposeFullscreenPass(pass) {
  pass?.mesh?.geometry?.dispose?.();
  pass?.material?.dispose?.();
}

function buildNativeEdgeMaskMaterial(sourceMaterial) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: sourceMaterial?.map || null,
    alphaMap: sourceMaterial?.alphaMap || null,
    alphaTest: Number(sourceMaterial?.alphaTest || 0),
    side: sourceMaterial?.side ?? THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    vertexColors: true,
    fog: false,
  });
  material.toneMapped = false;
  material.name = (sourceMaterial?.name || "Character") + "__rtg_native_edge_mask_v26";
  material.userData = {
    ...(sourceMaterial?.userData || {}),
    rtgSourcePixelShader: "chr_toon*.pfxo Target2",
    rtgMaskPacking: "R=COLOR_0.g G=COLOR_0.r B=7/255 A=COLOR_0.b fallback",
  };

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      [
        "#ifdef USE_COLOR_ALPHA",
        "  vec4 rtgEdgeMaskColor = vColor;",
        "#elif defined(USE_COLOR)",
        "  vec4 rtgEdgeMaskColor = vec4(vColor, 1.0);",
        "#else",
        "  vec4 rtgEdgeMaskColor = vec4(0.0, 0.0, 0.0, 1.0);",
        "#endif",
        // chr_toon / chr_toon_variable / chr_toon_metal / chr_toon_edit:
        // Target2.RG = COLOR0.GR and Target2.B = 7/255.
        // Target2.A also contains u_depthEdgeParam, whose runtime vector is not
        // present in the exported GLB. Preserve COLOR0.B instead of inventing it.
        "  outgoingLight = vec3(",
        "    clamp(rtgEdgeMaskColor.g, 0.0, 1.0),",
        "    clamp(rtgEdgeMaskColor.r, 0.0, 1.0),",
        "    7.0 / 255.0",
        "  );",
        "  diffuseColor.a = clamp(rtgEdgeMaskColor.b, 0.0, 1.0);",
        "#include <opaque_fragment>",
      ].join("\n"),
    );
  };
  material.customProgramCacheKey = () => "rtg-native-edge-mask-v26";
  return material;
}

function renderNativeEdgeDataPass(renderer, scene, camera, root, maskTarget, normalTarget) {
  const originals = [];
  const maskMaterials = new Set();
  let maskMeshes = 0;
  let colorMeshes = 0;

  root.traverse?.((node) => {
    if (!node.isMesh || !node.material) return;
    const color = node.geometry?.getAttribute?.("color");
    originals.push({ node, material: node.material, visible: node.visible });
    if (!color || color.itemSize < 3) {
      node.visible = false;
      return;
    }

    colorMeshes += 1;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = list.map((source) => {
      const mask = buildNativeEdgeMaskMaterial(source);
      maskMaterials.add(mask);
      return mask;
    });
    node.material = Array.isArray(node.material) ? replacements : replacements[0];
    maskMeshes += 1;
  });

  const normalMaterial = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
  });
  normalMaterial.toneMapped = false;
  normalMaterial.name = "RTG__chr_toon_target3_normal_v26";

  const previousOverride = scene.overrideMaterial;
  try {
    renderer.setRenderTarget(maskTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    for (const original of originals) {
      original.node.material = original.material;
      original.node.visible = original.visible;
    }

    scene.overrideMaterial = normalMaterial;
    renderer.setRenderTarget(normalTarget);
    renderer.setClearColor(0x8080ff, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
  } finally {
    scene.overrideMaterial = previousOverride;
    for (const original of originals) {
      original.node.material = original.material;
      original.node.visible = original.visible;
    }
    for (const material of maskMaterials) material.dispose();
    normalMaterial.dispose();
  }

  return {
    colorMeshes,
    maskMeshes,
    maskPacking: "COLOR_0.gr + 7/255 + COLOR_0.b fallback",
    normalPacking: "view normal * 0.5 + 0.5",
    unresolved: "u_depthEdgeParam runtime vector",
  };
}

function buildNativeScreenEdgePasses({ maskTexture, normalTexture, depthTexture, beautyTexture, edgeTone, camera }) {
  const texel = new THREE.Vector2(1 / RENDER_WIDTH, 1 / RENDER_HEIGHT);
  const edgeColor = new THREE.Color().setRGB(
    NATIVE_SCREEN_EDGE_PROFILE.edgeColor[0],
    NATIVE_SCREEN_EDGE_PROFILE.edgeColor[1],
    NATIVE_SCREEN_EDGE_PROFILE.edgeColor[2],
    THREE.SRGBColorSpace,
  );

  // V26 ports the proven edge.pfxo data semantics:
  // - t0 in_texMask: COLOR_0 packed Target2
  // - t1 in_texNrm: view normal Target3
  // - t2 in_texDep: center depth only
  // - axial full/half-radius sampling, no diagonal 3x3 gradient.
  const edgeParam = makeFullscreenPass([
    "varying vec2 vUv;",
    "uniform sampler2D uMask;",
    "uniform sampler2D uNormal;",
    "uniform sampler2D uDepth;",
    "uniform vec2 uTexel;",
    "uniform mat4 uProjectionInverse;",
    "uniform vec4 uEdgeWeight0;",
    "uniform vec4 uEdgeWeight1;",
    "float packedByte(vec4 m) { return floor(m.b * 255.0 + 0.5); }",
    "float maskBit0(vec4 m) { return mod(packedByte(m), 2.0); }",
    "float maskBit3(vec4 m) { return mod(floor(packedByte(m) / 8.0), 2.0); }",
    "vec3 rawNormalAt(vec2 uv) { return texture2D(uNormal, uv).xyz; }",
    "vec3 normalAt(vec2 uv) { return normalize(rawNormalAt(uv) * 2.0 - 1.0); }",
    "vec3 viewPositionAt(vec2 uv, float d) {",
    "  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);",
    "  vec4 view = uProjectionInverse * clip;",
    "  return view.xyz / max(abs(view.w), 1e-6);",
    "}",
    "void accumulateNeighbor(",
    "  vec2 uv, vec4 centerMask, float centerFacing, vec3 toEye,",
    "  inout float sumFacing, inout float sumMaskR, inout float sumMaskG, inout float bit3Sum",
    ") {",
    "  vec4 m = texture2D(uMask, uv);",
    "  vec3 n = normalAt(uv);",
    "  sumFacing += abs(centerFacing - dot(toEye, n));",
    "  sumMaskR += abs(centerMask.r - m.r);",
    "  sumMaskG += abs(centerMask.g - m.g);",
    "  bit3Sum += maskBit3(m);",
    "}",
    "float stableHalfNormal(vec3 centerRaw, vec2 uv, float threshold) {",
    "  vec3 delta = abs(centerRaw - rawNormalAt(uv));",
    "  return all(lessThanEqual(delta, vec3(threshold))) ? 1.0 : 0.0;",
    "}",
    "void main() {",
    "  vec4 centerMask = texture2D(uMask, vUv);",
    "  if (maskBit0(centerMask) < 0.5) discard;",
    "  float rawDepth = texture2D(uDepth, vUv).x;",
    "  if (rawDepth >= 0.999999) discard;",
    "",
    "  vec3 viewPos = viewPositionAt(vUv, rawDepth);",
    "  vec3 toEye = normalize(-viewPos);",
    "  vec3 centerRaw = rawNormalAt(vUv);",
    "  vec3 centerNormal = normalize(centerRaw * 2.0 - 1.0);",
    "  float centerFacing = dot(toEye, centerNormal);",
    "",
    // edge.pfxo: dx = windowParamForEdge.z;
    // dy = lerp(windowParamForEdge.z, windowParamForEdge.w, edgeWeight1.w).
    // In the extracted profile edgeWeight1.w == 0, therefore both axes use z.
    "  float dx = uTexel.x;",
    "  float dy = mix(uTexel.x, uTexel.y, uEdgeWeight1.w);",
    "  vec2 x1 = vec2(dx, 0.0);",
    "  vec2 y1 = vec2(0.0, dy);",
    "  vec2 xh = x1 * 0.5;",
    "  vec2 yh = y1 * 0.5;",
    "",
    "  float sumFacing = 0.0;",
    "  float sumMaskR = 0.0;",
    "  float sumMaskG = 0.0;",
    "  float bit3Sum = 0.0;",
    "  accumulateNeighbor(vUv + x1, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv - x1, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv + y1, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv - y1, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv + xh, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv - xh, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv + yh, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "  accumulateNeighbor(vUv - yh, centerMask, centerFacing, toEye, sumFacing, sumMaskR, sumMaskG, bit3Sum);",
    "",
    // edge.pfxo reconstructs a negative view-space Z-like metric and fades it
    // over the proven 25.5 / 2.5 / 0.6 constants.
    "  float q = clamp((viewPos.z + 25.5) / 25.5, 0.0, 1.0);",
    "  float depthFade = 1.0 - min((1.0 - q) * 2.5, 0.6);",
    "  float rawThreshold = mix(uEdgeWeight0.x, uEdgeWeight0.y, depthFade);",
    "  float normalStable = 1.0;",
    "  normalStable *= stableHalfNormal(centerRaw, vUv + xh, rawThreshold);",
    "  normalStable *= stableHalfNormal(centerRaw, vUv - xh, rawThreshold);",
    "  normalStable *= stableHalfNormal(centerRaw, vUv + yh, rawThreshold);",
    "  normalStable *= stableHalfNormal(centerRaw, vUv - yh, rawThreshold);",
    "",
    "  float facingThreshold = mix(uEdgeWeight1.x, uEdgeWeight1.y, depthFade);",
    "  float facingScore = clamp((facingThreshold - 0.5 * sumFacing) * 256.0, 0.0, 1.0);",
    "  float maskGFactor = clamp((0.25 - 0.5 * sumMaskG) * 256.0, 0.0, 1.0);",
    "  float detailedScore = facingScore * maskGFactor * normalStable;",
    "  float maskRFactor = 1.0 - clamp(sumMaskR * 5.0, 0.0, 1.0);",
    "  float depthMix = clamp(clamp(depthFade * uEdgeWeight1.z, 0.0, 1.0) * 1.33329999 - 0.333249986, 0.0, 1.0);",
    "  float edgeValue = maskRFactor * mix(1.0, detailedScore, depthMix);",
    "  float gate = 1.0 - step(0.5, bit3Sum);",
    "",
    // edge.pfxo structured output. Z is the smoothness/edge parameter consumed
    // by edge_tone; a discontinuity drives it toward zero.
    "  gl_FragColor = vec4(",
    "    clamp(centerFacing, 0.0, 1.0),",
    "    gate * centerMask.a,",
    "    gate * edgeValue,",
    "    clamp(centerFacing, 0.0, 1.0)",
    "  );",
    "}",
  ].join("\n"), {
    uMask: { value: maskTexture },
    uNormal: { value: normalTexture },
    uDepth: { value: depthTexture },
    uTexel: { value: texel },
    uProjectionInverse: { value: camera.projectionMatrixInverse.clone() },
    uEdgeWeight0: { value: new THREE.Vector4(...NATIVE_SCREEN_EDGE_PROFILE.edgeWeight0) },
    uEdgeWeight1: { value: new THREE.Vector4(...NATIVE_SCREEN_EDGE_PROFILE.edgeWeight1) },
  }, "RTG__edge_param_v26_native_data");

  const tone = makeFullscreenPass([
    "varying vec2 vUv;",
    "uniform sampler2D uEdgeParam;",
    "uniform sampler2D uDepth;",
    "uniform sampler2D uEdgeTone;",
    "uniform vec2 uTexel;",
    "float edgeParamZ(vec2 uv) { return texture2D(uEdgeParam, uv).b; }",
    "void main() {",
    "  float rawDepth = texture2D(uDepth, vUv).x;",
    "  if (rawDepth >= 0.999999) { gl_FragColor = vec4(0.0); return; }",
    // edge_tone.pfxo filters edgeParam.Z: center .20 + eight neighbors .10.
    "  float center = edgeParamZ(vUv);",
    "  float filtered = center * 0.2;",
    "  for (int y = -1; y <= 1; ++y) {",
    "    for (int x = -1; x <= 1; ++x) {",
    "      if (x == 0 && y == 0) continue;",
    "      filtered += edgeParamZ(vUv + vec2(float(x), float(y)) * uTexel) * 0.1;",
    "    }",
    "  }",
    "  filtered = clamp(filtered, 0.0, 1.0);",
    // Extracted edgeTone01 is addressed by the geometric parameter and its
    // filtered response. The proven tail is (1-LUT.r)*LUT.a*2*(1-filtered).
    "  vec4 lut = texture2D(uEdgeTone, vec2(clamp(center, 0.0, 1.0), filtered));",
    "  float tone = (1.0 - lut.r) * lut.a * clamp(2.0 * (1.0 - filtered), 0.0, 1.0);",
    "  gl_FragColor = vec4(vec3(tone), 1.0);",
    "}",
  ].join("\n"), {
    uEdgeParam: { value: null },
    uDepth: { value: depthTexture },
    uEdgeTone: { value: edgeTone },
    uTexel: { value: texel },
  }, "RTG__edge_tone_v26_native_data");

  const composite = makeFullscreenPass([
    "varying vec2 vUv;",
    "uniform sampler2D uBeauty;",
    "uniform sampler2D uEdgeRate;",
    "uniform vec3 uEdgeColor;",
    "void main() {",
    "  vec4 beauty = texture2D(uBeauty, vUv);",
    "  float rate = texture2D(uEdgeRate, vUv).r;",
    "  rate = rate > (1.0 / 255.0) ? clamp(rate, 0.0, 1.0) : 0.0;",
    "  vec3 rgb = mix(beauty.rgb, uEdgeColor, rate);",
    "  gl_FragColor = vec4(rgb, beauty.a);",
    "  #include <colorspace_fragment>",
    "}",
  ].join("\n"), {
    uBeauty: { value: beautyTexture },
    uEdgeRate: { value: null },
    uEdgeColor: { value: edgeColor },
  }, "RTG__edge_composi_v26");

  return { edgeParam, tone, composite };
}

async function renderNativeScreenSpaceEdgePass(renderer, scene, camera, root, beautyTarget) {
  const edgeTone = await nativeEdgeToneTexture();

  const maskTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  maskTarget.texture.colorSpace = THREE.NoColorSpace;

  const normalTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  normalTarget.texture.colorSpace = THREE.NoColorSpace;

  const edgeParamTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  edgeParamTarget.texture.colorSpace = THREE.NoColorSpace;

  const edgeToneTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  edgeToneTarget.texture.colorSpace = THREE.NoColorSpace;

  const edgeData = renderNativeEdgeDataPass(
    renderer,
    scene,
    camera,
    root,
    maskTarget,
    normalTarget,
  );

  const passes = buildNativeScreenEdgePasses({
    maskTexture: maskTarget.texture,
    normalTexture: normalTarget.texture,
    depthTexture: beautyTarget.depthTexture,
    beautyTexture: beautyTarget.texture,
    edgeTone,
    camera,
  });
  passes.tone.material.uniforms.uEdgeParam.value = edgeParamTarget.texture;
  passes.composite.material.uniforms.uEdgeRate.value = edgeToneTarget.texture;

  const previousTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(edgeParamTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.render(passes.edgeParam.scene, passes.edgeParam.camera);

    renderer.setRenderTarget(edgeToneTarget);
    renderer.clear(true, false, false);
    renderer.render(passes.tone.scene, passes.tone.camera);

    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(passes.composite.scene, passes.composite.camera);
  } finally {
    renderer.setRenderTarget(previousTarget);
    disposeFullscreenPass(passes.edgeParam);
    disposeFullscreenPass(passes.tone);
    disposeFullscreenPass(passes.composite);
    maskTarget.dispose();
    normalTarget.dispose();
    edgeParamTarget.dispose();
    edgeToneTarget.dispose();
  }

  return {
    enabled: true,
    source: "chr_toon Target2/3 + edge.pfxo V26 + edge_tone.pfxo + edge_composi.pfxo",
    lut: "edgeTone01 128x64",
    toneVertexParam: [...NATIVE_SCREEN_EDGE_PROFILE.toneVertexParam],
    edgeData,
  };
}

function geometryHasNativeEdge2Weight(geometry) {
  const color = geometry?.getAttribute?.("color");
  const normal = geometry?.getAttribute?.("normal");
  if (!color || color.itemSize < 3 || !normal) return false;

  for (let index = 0; index < color.count; index += 1) {
    if (Number(color.getZ(index)) > (1 / 255)) return true;
  }
  return false;
}

function buildNativeEdge2Material() {
  // edgeColor is stored as raw UNORM/display RGB in the capture profile.
  // Convert from sRGB into Three's working space so the final canvas conversion
  // lands back on the extracted 0.30 / 0.30 / 0.30 values.
  const edgeColor = new THREE.Color().setRGB(
    NATIVE_EDGE2_CAPTURE_PROFILE.shaderParam7[0],
    NATIVE_EDGE2_CAPTURE_PROFILE.shaderParam7[1],
    NATIVE_EDGE2_CAPTURE_PROFILE.shaderParam7[2],
    THREE.SRGBColorSpace,
  );

  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    shininess: 0,
    specular: new THREE.Color(0x000000),
    fog: false,
  });
  material.toneMapped = false;
  material.name = "RTG__chr_edge2_capture";
  material.userData = {
    rtgShaderMode: "native-edge2",
    rtgSourceVertexShader: "chr_toon_edge2.vfxo",
    rtgSourcePixelShader: "chr_edge2.pfxo",
    rtgCaptureProfile: {
      edge2OutlineScale: NATIVE_EDGE2_CAPTURE_PROFILE.edgeScale,
      edgeColor: [...NATIVE_EDGE2_CAPTURE_PROFILE.shaderParam7],
    },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.rtgEdge2DepthScaleMax = { value: NATIVE_EDGE2_CAPTURE_PROFILE.depthScaleMax };
    shader.uniforms.rtgEdge2DepthScaleOffset = { value: NATIVE_EDGE2_CAPTURE_PROFILE.depthScaleOffset };
    shader.uniforms.rtgEdge2Scale = { value: NATIVE_EDGE2_CAPTURE_PROFILE.edgeScale };
    shader.uniforms.rtgEdge2ShaderParam7W = { value: NATIVE_EDGE2_CAPTURE_PROFILE.shaderParam7[3] };
    shader.uniforms.rtgEdge2Color = { value: edgeColor };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      [
        "#include <common>",
        "uniform float rtgEdge2DepthScaleMax;",
        "uniform float rtgEdge2DepthScaleOffset;",
        "uniform float rtgEdge2Scale;",
        "uniform float rtgEdge2ShaderParam7W;",
      ].join("\n"),
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <displacementmap_vertex>",
      [
        "#include <displacementmap_vertex>",
        "float rtgEdge2ViewDepth = abs((modelViewMatrix * vec4(transformed, 1.0)).z);",
        "float rtgEdge2DepthFactor = rtgEdge2DepthScaleMax > 0.0",
        "  ? min(rtgEdge2ViewDepth, rtgEdge2DepthScaleMax) + rtgEdge2DepthScaleOffset",
        "  : 1.0;",
        "rtgEdge2DepthFactor /= max(projectionMatrix[1][1], 1.0);",
        "float rtgEdge2Width = color.b * rtgEdge2ShaderParam7W * 0.5",
        "  * rtgEdge2DepthFactor * rtgEdge2Scale * 0.01;",
        "transformed += normalize(objectNormal) * rtgEdge2Width;",
      ].join("\n"),
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform vec3 rtgEdge2Color;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      [
        "outgoingLight = rtgEdge2Color;",
        "diffuseColor.a = 1.0;",
        "#include <opaque_fragment>",
      ].join("\n"),
    );
  };

  material.customProgramCacheKey = () => "rtg-native-edge2-v9-capture";
  return material;
}

function renderNativeEdge2Pass(renderer, scene, camera, root) {
  const edgeMaterial = buildNativeEdge2Material();
  const originals = [];
  let colorMeshes = 0;
  let weightedMeshes = 0;

  root.traverse?.((node) => {
    if (!node.isMesh || !node.material) return;

    const color = node.geometry?.getAttribute?.("color");
    if (color && color.itemSize >= 3) colorMeshes += 1;

    originals.push({ node, material: node.material, visible: node.visible });

    if (!geometryHasNativeEdge2Weight(node.geometry)) {
      node.visible = false;
      return;
    }

    weightedMeshes += 1;
    node.material = Array.isArray(node.material)
      ? node.material.map(() => edgeMaterial)
      : edgeMaterial;
  });

  try {
    renderer.render(scene, camera);
  } finally {
    for (const original of originals) {
      original.node.material = original.material;
      original.node.visible = original.visible;
    }
    edgeMaterial.dispose();
  }

  if (weightedMeshes === 0) {
    console.warn("[RTG 3D portrait] edge2: nessuna mesh con COLOR.b originale disponibile nel GLB");
  }

  return { colorMeshes, weightedMeshes };
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

async function renderGlbToBlob(buffer, sourceUrl, shaderMode = "legacy", nativeRecolor = null) {
  const glbPayload = inspectGlbNativePayload(buffer);
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

  const nativeMaterials = await applyCharacterShader(gltf, shaderMode, nativeRecolor);
  scene.add(gltf.scene);
  fitFrontCamera(camera, gltf.scene);

  const renderStart = performance.now();
  let edge2 = null;
  let screenEdge = null;
  if (shaderMode === "native-edge") {
    const beautyTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    beautyTarget.texture.colorSpace = THREE.NoColorSpace;
    beautyTarget.depthTexture = new THREE.DepthTexture(RENDER_WIDTH, RENDER_HEIGHT, THREE.UnsignedIntType);
    beautyTarget.depthTexture.format = THREE.DepthFormat;

    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.setRenderTarget(beautyTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      edge2 = renderNativeEdge2Pass(renderer, scene, camera, gltf.scene);
      screenEdge = await renderNativeScreenSpaceEdgePass(renderer, scene, camera, gltf.scene, beautyTarget);
    } finally {
      renderer.setRenderTarget(null);
      renderer.autoClear = previousAutoClear;
      beautyTarget.dispose();
    }
  } else {
    renderer.render(scene, camera);
  }
  const blob = await canvasBlob(canvas);
  const renderMs = performance.now() - renderStart;

  scene.remove(gltf.scene);
  disposeModel(gltf.scene);
  gltf.parser?.cache?.removeAll?.();
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss?.();

  return { blob, parseMs, renderMs, animations: Number(gltf.animations?.length || 0), edge2, screenEdge, nativeMaterials, glbPayload };
}

async function portraitFor({ playerId, player, uniformId = null, shaderModeOverride = null } = {}) {
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

  const shaderMode = shaderModeOverride || selectedShaderMode();
  const nativeRecolor = shaderMode === "native-edge"
    ? nativeRecolorForUniform(uniform, isKeeper, uniformCrc)
    : null;
  const key = cacheKey(playerId, playerConfig.internalCode, chosenUniformId, uniformCrc, shaderMode);
  const selectedCacheName = cacheName(shaderMode);
  const forceFresh = freshRenderEnabled();
  const memoryUrl = forceFresh ? null : memoryUrls.get(key);
  if (memoryUrl) {
    return { url: memoryUrl, cache: "memory", totalMs: 0, uniformId: chosenUniformId, uniformCrc, isKeeper, shaderMode };
  }

  const persistentBlob = forceFresh ? null : await readCachedBlob(key, selectedCacheName);
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
  const response = await fetch(modelUrl, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error("nie-model HTTP " + response.status);
  const buffer = await response.arrayBuffer();
  const networkMs = performance.now() - networkStart;
  assertGlb(buffer);

  const rendered = await renderGlbToBlob(buffer, modelUrl, shaderMode, nativeRecolor);
  await writeCachedBlob(key, rendered.blob, selectedCacheName);
  if (forceFresh && rendered.glbPayload?.materialDebug) {
    console.info("[RTG 3D portrait] native material debug JSON " + JSON.stringify(rendered.glbPayload.materialDebug));
  }
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
    edge2: rendered.edge2,
    screenEdge: rendered.screenEdge,
    nativeMaterials: rendered.nativeMaterials,
    glbPayload: rendered.glbPayload,
    nativeRecolor,
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
  status.textContent = compareEnabled() ? "G4 ↔ NATIVE · caricamento…" : "3D · generazione…";
  status.dataset.state = "loading";

  try {
    if (compareEnabled()) {
      const [g4Result, nativeResult] = await Promise.all([
        portraitFor({ playerId, player, uniformId, shaderModeOverride: "g4" }),
        portraitFor({ playerId, player, uniformId, shaderModeOverride: "native" }),
      ]);
      if (g4Result?.skipped || nativeResult?.skipped) {
        status.remove();
        return g4Result?.skipped ? g4Result : nativeResult;
      }

      const makeImage = (result, side) => {
        const img = document.createElement("img");
        img.className = "player-fullbody rtg-3d-generated-portrait rtg-3d-compare-image rtg-3d-compare-" + side;
        img.alt = String(player?.name || "") + " " + (side === "left" ? "G4 v6" : "NATIVE v7");
        img.decoding = "async";
        img.src = result.url;
        return img;
      };

      const g4Image = makeImage(g4Result, "left");
      const nativeImage = makeImage(nativeResult, "right");
      await Promise.all([
        typeof g4Image.decode === "function" ? g4Image.decode().catch(() => {}) : Promise.resolve(),
        typeof nativeImage.decode === "function" ? nativeImage.decode().catch(() => {}) : Promise.resolve(),
      ]);
      if (!visual.isConnected) return { g4: g4Result, native: nativeResult };

      visual.querySelectorAll(".rtg-3d-generated-portrait, .rtg-3d-compare-wrap").forEach((old) => old.remove());
      const fallback = visual.querySelector("img.player-fullbody:not(.rtg-3d-generated-portrait), .player-fullbody-placeholder");
      fallback?.classList?.add("rtg-3d-fallback-hidden");
      visual.classList.add("rtg-3d-compare-host");

      const wrap = document.createElement("div");
      wrap.className = "rtg-3d-compare-wrap";
      wrap.append(g4Image, nativeImage);

      const divider = document.createElement("span");
      divider.className = "rtg-3d-compare-divider";
      wrap.append(divider);

      const leftLabel = document.createElement("strong");
      leftLabel.className = "rtg-3d-compare-label rtg-3d-compare-label-left";
      leftLabel.textContent = "G4 v6";
      wrap.append(leftLabel);

      const rightLabel = document.createElement("strong");
      rightLabel.className = "rtg-3d-compare-label rtg-3d-compare-label-right";
      rightLabel.textContent = "NATIVE v7";
      wrap.append(rightLabel);

      visual.prepend(wrap);
      status.dataset.state = "ready";
      status.textContent = "50/50 · G4 v6 ↔ NATIVE v7 · " + (nativeResult.isKeeper ? "GK" : "campo");
      return { compare: true, g4: g4Result, native: nativeResult };
    }

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

    visual.querySelectorAll(".rtg-3d-generated-portrait, .rtg-3d-compare-wrap").forEach((old) => old.remove());
    visual.classList.remove("rtg-3d-compare-host");
    const fallback = visual.querySelector("img.player-fullbody:not(.rtg-3d-generated-portrait), .player-fullbody-placeholder");
    fallback?.classList?.add("rtg-3d-fallback-hidden");
    visual.prepend(img);

    status.dataset.state = "ready";
    const shaderLabel = result.shaderMode === "native-edge"
      ? "NATIVE CORE V26 · SS MASK+NRM · EDGE DXBC · METAL SHADOW · LINEAR DXBC · TOONVAR · EDITMASK · EDGE2 EXP"
      : result.shaderMode === "native"
        ? "NATIVE"
        : result.shaderMode === "g4"
          ? "G4"
          : "3D";
    const nativeMaterialLabel = result.nativeMaterials
      ? " · MAT " + result.nativeMaterials.materials
        + "/" + (result.nativeMaterials.materials + result.nativeMaterials.missing)
      : "";
    const param2Label = result.nativeMaterials
      ? " · P2 " + result.nativeMaterials.shaderParam2 + "/" + result.nativeMaterials.materials
      : "";
    const familyLabel = result.nativeMaterials?.shaderFamilies
      ? " · FX " + Object.entries(result.nativeMaterials.shaderFamilies)
        .map(([family, count]) => family + ":" + count)
        .join(",")
      : "";
    const recolorLabel = result.nativeMaterials
      ? " · RC " + result.nativeMaterials.editRecolor + "/3"
      : "";
    const variableLabel = result.nativeMaterials
      ? " · VAR " + result.nativeMaterials.variableAtlas + "/2"
      : "";
    const metalLabel = result.nativeMaterials
      ? " · MET " + result.nativeMaterials.metalBranch + "/1"
      : "";
    const screenEdgeLabel = result.screenEdge?.enabled ? " · SS 1/1" : " · SS 0/1";
    const rawGlbLabel = result.glbPayload
      ? " · RAW " + result.glbPayload.nativeMaterials + "/" + result.glbPayload.usedMaterials
        + " · C " + result.glbPayload.colorPrimitives + "/" + result.glbPayload.primitiveCount
      : "";
    status.textContent = result.cache === "miss"
      ? shaderLabel + nativeMaterialLabel + param2Label + recolorLabel + variableLabel + metalLabel + screenEdgeLabel + familyLabel + rawGlbLabel + " · " + Math.round(result.totalMs) + " ms · " + (result.isKeeper ? "GK" : "campo")
      : shaderLabel + nativeMaterialLabel + param2Label + rawGlbLabel + " · cache " + result.cache + " · " + (result.isKeeper ? "GK" : "campo");
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
  compareEnabled,
  portraitFor,
  renderIntoDetail,
});

globalThis.addEventListener?.("beforeunload", () => {
  for (const url of memoryUrls.values()) URL.revokeObjectURL(url);
  memoryUrls.clear();
});
