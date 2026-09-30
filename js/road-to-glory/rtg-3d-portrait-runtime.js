import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MANIFEST_URL = "data/RTG_3D_PROTOTYPE.json";
const LEGACY_CACHE_NAME = "rtg-3d-portrait-v5";
const G4_CACHE_NAME = "rtg-3d-portrait-v6-g4";
const NATIVE_CACHE_NAME = "rtg-3d-portrait-v7-native-data";
const NATIVE_EDGE_CACHE_NAME = "rtg-3d-portrait-v11-native-material-parser";
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
  if (value === "native-edge" || value === "edge2" || value === "v8" || value === "v9" || value === "v10" || value === "v11") return "native-edge";
  if (value === "native" || value === "v7") return "native";
  return value === "g4" || value === "v6" ? "g4" : "legacy";
}

function compareEnabled() {
  const value = String(new URLSearchParams(globalThis.location?.search || "").get("rtg3dCompare") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "g4-native";
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
  const version = shaderMode === "native-edge"
    ? "v11-native-material-parser"
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

function nieMaterialExtras(gltf, sourceMaterial) {
  const direct = sourceMaterial?.userData?.nie;
  if (direct && typeof direct === "object") return direct;

  const association = gltf?.parser?.associations?.get?.(sourceMaterial);
  const materialIndex = Number(association?.materials);
  if (!Number.isInteger(materialIndex) || materialIndex < 0) return null;

  const fromJson = gltf?.parser?.json?.materials?.[materialIndex]?.extras?.nie;
  return fromJson && typeof fromJson === "object" ? fromJson : null;
}

async function loadNieAuxTextures(gltf, sourceMaterial) {
  const descriptors = nieMaterialExtras(gltf, sourceMaterial)?.textures;
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

function readNieNativeMaterial(gltf, sourceMaterial) {
  const nie = nieMaterialExtras(gltf, sourceMaterial);
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


function buildNativeGradientTexture() {
  // Exact RGBA alpha rows decoded from the user's untouched
  // data/dx11/chr/shader/texture/chr_tex.g4tx -> chrGrd_01 (512x256 DXT5).
  // Native shaderParam2 selects rows 254 and 250; RGB is pure white on both.
  const width = 512;
  const pixels = new Uint8Array(width * 2 * 4);
  const row0 = new Uint8Array(width);
  const row1 = new Uint8Array(width);
  row0.fill(0);
  row1.fill(0);
  row0.fill(255, 0, 381);
  row0.fill(254, 381, 384);
  row0[384] = 255;
  row0[385] = 225;
  row0[386] = 135;
  row0[387] = 45;
  row0[392] = 3;
  row0[393] = 1;
  row1.fill(255, 0, 270);
  row1[270] = 230;
  row1[271] = 139;
  row1[272] = 37;

  for (let y = 0; y < 2; y += 1) {
    const alpha = y === 0 ? row0 : row1;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha[x];
    }
  }

  const texture = new THREE.DataTexture(pixels, width, 2, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function buildG4NativeDataMaterial(sourceMaterial, aux, profile = "general", nativeMaterial = null) {
  const gradient = buildNativeGradientTexture();
  const useCaptureProfile = profile === "capture";
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
    rtgShaderMode: useCaptureProfile ? "native-edge" : "native",
    rtgNativeLightData: nativeLightData,
  };

  material.onBeforeCompile = (shader) => {
    const hasOcclusion = !!aux.occlusion;
    const hasSpecularShape = !!aux.specular;
    const hasSpecularMask = !!aux.specular_mask;

    shader.uniforms.g4OcclusionMap = { value: aux.occlusion || null };
    shader.uniforms.g4SpecularShapeMap = { value: aux.specular || null };
    shader.uniforms.g4SpecularMaskMap = { value: aux.specular_mask || null };
    shader.uniforms.g4NativeGradientMap = { value: gradient };
    shader.uniforms.g4LightDirView = { value: new THREE.Vector3(...nativeLightData.charaLightDir).normalize() };

    const declarations = [
      "uniform vec3 g4LightDirView;",
      "uniform sampler2D g4NativeGradientMap;",
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

    const nativeComposite = [
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
      "  float g4Grad1 = g4Second - 0.55 + 0.50;",
      "  float g4Cover0 = texture2D(g4NativeGradientMap, vec2(clamp(g4Grad0, 0.0, 1.0), 0.25)).a;",
      "  float g4Cover1 = texture2D(g4NativeGradientMap, vec2(clamp(g4Grad1, 0.0, 1.0), 0.75)).a;",
      "  vec3 g4Shadow0 = vec3(" + nativeLightData.charaShadowColor1.slice(0, 3).join(", ") + ");",
      "  vec3 g4Shadow1 = vec3(" + nativeLightData.charaShadowColor2.slice(0, 3).join(", ") + ");",
      "  vec3 g4ShadowMix = mix(g4Shadow0, g4Shadow1, g4Cover1);",
      "  vec3 g4Base = g4LinearToUnorm(diffuseColor.rgb);",
      "  float g4Lum = dot(g4Base, vec3(0.29891, 0.58661, 0.11448));",
      "  vec3 g4Shade = g4ShadowMix + vec3(g4Lum * 0.10);",
      "  vec3 g4AmbientColor = vec3(1.0);",
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
      "  float g4High = clamp((g4HighSignal - 1.50) * 10000.0, 0.0, 1.0);",
      "  float g4Under = clamp(-g4Signed, 0.0, 1.0) * g4Grazing;",
      "  g4Under = clamp((g4Under + 1.0 - 1.45) * 300.0, 0.0, 1.0);",
      "  g4Color += vec3(0.10) * g4High;",
      "  g4Color += vec3(0.07) * g4Under;",
      "  outgoingLight = g4UnormToLinear(max(g4Color, vec3(0.0)));",
    ].filter(Boolean).join("\n");

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      nativeComposite + "\n#include <opaque_fragment>",
    );
  };

  material.customProgramCacheKey = () => [
    useCaptureProfile ? "rtg-g4-native-capture-v9" : "rtg-g4-native-data-v7",
    nativeMaterial?.shaderHashHex || "no-native-hash",
    aux.occlusion ? "oc" : "",
    aux.specular ? "sp" : "",
    aux.specular_mask ? "spm" : "",
  ].join("-");

  return material;
}

async function applyCharacterShader(gltf, shaderMode = "legacy") {
  const converted = new Map();
  const replacements = [];
  const nativeSourceUuids = new Set();
  const nativeShaderHashes = new Set();
  let nativeMaterials = 0;
  let missingNativeMaterials = 0;

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
        const native = (shaderMode === "native" || shaderMode === "native-edge")
          ? readNieNativeMaterial(gltf, source)
          : null;
        if (!nativeSourceUuids.has(source.uuid) && (shaderMode === "native" || shaderMode === "native-edge")) {
          nativeSourceUuids.add(source.uuid);
          if (native) {
            nativeMaterials += 1;
            if (native.shaderHashHex) nativeShaderHashes.add(native.shaderHashHex);
          } else {
            missingNativeMaterials += 1;
          }
        }
        if (!converted.has(source.uuid)) {
          converted.set(source.uuid, (async () => {
            const aux = await loadNieAuxTextures(gltf, source);
            return shaderMode === "native-edge"
              ? buildG4NativeDataMaterial(source, aux, "capture", native)
              : shaderMode === "native"
                ? buildG4NativeDataMaterial(source, aux, "general", native)
                : shaderMode === "g4"
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
  return {
    materials: nativeMaterials,
    missing: missingNativeMaterials,
    shaderHashes: [...nativeShaderHashes].sort(),
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
  // light_2d_capture.cfg.bin supplies edge2OutlineScale=2.5.
  // The depth pair is the inherited edge2 default observed across the extracted
  // EventMap profiles and in the native-shader reconstruction; the capture file
  // does not override it.
  depthScaleMax: 7.0,
  depthScaleOffset: 0.10,
  edgeScale: 2.5,
  shaderParam7: Object.freeze([0.30, 0.30, 0.30, 1.0]),
});

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

  const nativeMaterials = await applyCharacterShader(gltf, shaderMode);
  scene.add(gltf.scene);
  fitFrontCamera(camera, gltf.scene);

  const renderStart = performance.now();
  let edge2 = null;
  if (shaderMode === "native-edge") {
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      edge2 = renderNativeEdge2Pass(renderer, scene, camera, gltf.scene);
    } finally {
      renderer.autoClear = previousAutoClear;
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

  return { blob, parseMs, renderMs, animations: Number(gltf.animations?.length || 0), edge2, nativeMaterials };
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
    edge2: rendered.edge2,
    nativeMaterials: rendered.nativeMaterials,
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
      ? "NATIVE+EDGE2 V11"
      : result.shaderMode === "native"
        ? "NATIVE"
        : result.shaderMode === "g4"
          ? "G4"
          : "3D";
    const nativeMaterialLabel = result.nativeMaterials
      ? " · MAT " + result.nativeMaterials.materials
        + "/" + (result.nativeMaterials.materials + result.nativeMaterials.missing)
      : "";
    status.textContent = result.cache === "miss"
      ? shaderLabel + nativeMaterialLabel + " · " + Math.round(result.totalMs) + " ms · " + (result.isKeeper ? "GK" : "campo")
      : shaderLabel + nativeMaterialLabel + " · cache " + result.cache + " · " + (result.isKeeper ? "GK" : "campo");
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
