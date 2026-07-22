const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const appJs = read("js/app.js");
const css = read("css/game.css");
const readmePath = path.join(root, "assets/backgrounds/README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const mobileName = "inazuma-background-mobile-light.jpeg";
const desktopName = "inazuma-background-desktop-light.jpeg";
const mobilePath = `/assets/backgrounds/${mobileName}`;
const desktopPath = `/assets/backgrounds/${desktopName}`;

assert(fs.existsSync(readmePath), "background README must exist");
assert(readme.includes(mobileName) && readme.includes(desktopName), "README documents exact future JPEG names");
assert(readme.includes("mobile") && readme.includes("desktop"), "README identifies mobile and desktop assets");
assert(readme.includes("fallback"), "README documents the light fallback when assets are absent");
assert(appJs.includes(mobilePath) && appJs.includes(desktopPath), "JavaScript uses exact absolute Vercel-safe asset paths");
assert(appJs.includes("APP_BACKGROUND_BREAKPOINT = 1024"), "desktop breakpoint is centralized at 1024 px");
assert(appJs.includes('mode === "desktop"') && appJs.includes('mode === "mobile"'), "mobile and desktop modes are selected around the breakpoint");
assert(appJs.includes("new Image()") && appJs.includes("image.onload") && appJs.includes("image.onerror"), "missing images are handled through vanilla preload callbacks");
assert(appJs.includes("state.pending.has(mode)") && appJs.includes("state.failed.has(mode)"), "duplicate and failed preloads are cached per breakpoint without retry loops");
assert(appJs.includes('query.addEventListener("change", refresh)') && !appJs.includes('addEventListener("scroll"'), "background helper reacts to breakpoint changes and does not listen to scroll");
assert(!/localStorage[\s\S]{0,120}APP_BACKGROUND|APP_BACKGROUND[\s\S]{0,120}localStorage/.test(appJs), "background helper must not use localStorage");
assert(css.includes("--app-fallback-start: #dff3ff") && css.includes("--app-fallback-middle: #eef8ff") && css.includes("--app-fallback-end: #cfe8fa"), "light blue fallback variables are present");
assert(css.includes("--surface-panel") && css.includes("--text-primary") && css.includes("--border-soft"), "centralized light theme surface variables are present");
assert(css.includes(".app-shell::before") && css.includes("pointer-events: none") && css.includes("background-size: cover"), "single stable global background layer covers viewport and does not intercept clicks");
assert(css.includes(".app-shell.app-shell--background-loaded::before") && css.includes("--app-background-image"), "loaded background is applied only after successful preload");
assert(!css.includes(mobilePath) && !css.includes(desktopPath), "CSS must not reference absent JPEGs directly");
assert(!/\/mnt\/data/.test(appJs + css + readme), "no /mnt/data references are allowed");
const backgroundHelper = appJs.match(/const APP_BACKGROUND_BREAKPOINT[\s\S]*?global.InazumaBackgrounds[\s\S]*?;\n/)?.[0] || "";
assert(!/data:image|base64/.test(backgroundHelper + css + readme), "background implementation must not add base64 or inline image data");
assert(!/https?:\/\//.test(appJs.match(/APP_BACKGROUND_PATHS[\s\S]*?\}\);/)?.[0] || ""), "background paths are local, not remote URLs");
assert(!fs.existsSync(path.join(root, "assets/backgrounds", mobileName)) && !fs.existsSync(path.join(root, "assets/backgrounds", desktopName)), "future JPEG files must not exist in this commit");

const changed = require("child_process").execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" }).trim().split(/\n/).filter(Boolean);
assert(changed.every((file) => !/\.(jpe?g|png|webp|gif|zip|ico|woff2?|ttf|otf)$/i.test(file)), "diff must not contain binary asset filenames");
assert(!changed.some((file) => file.startsWith("data/")), "player/game data files must not be modified");
assert(!appJs.includes("/mnt/data") && !css.includes(".png") && !css.includes(".webp"), "background implementation avoids temporary paths and non-JPEG formats");

console.log("Responsive background readiness checks passed");
