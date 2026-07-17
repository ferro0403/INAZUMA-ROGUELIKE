"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cssPath = path.join(root, "css/game.css");
const source = fs.readFileSync(cssPath, "utf8");
const relativePath = path.relative(root, cssPath);

function maskCss(css) {
  let output = "";
  let state = "code";
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (state === "comment") {
      if (char === "\n") output += "\n";
      else output += " ";
      if (char === "*" && next === "/") { output += " "; index += 1; state = "code"; }
      continue;
    }
    if (state === "single" || state === "double") {
      output += char === "\n" ? "\n" : " ";
      if (char === "\\") { if (next) { output += next === "\n" ? "\n" : " "; index += 1; } continue; }
      if ((state === "single" && char === "'") || (state === "double" && char === '"')) state = "code";
      continue;
    }
    if (char === "/" && next === "*") { output += "  "; index += 1; state = "comment"; continue; }
    if (char === "'") { output += " "; state = "single"; continue; }
    if (char === '"') { output += " "; state = "double"; continue; }
    output += char;
  }
  return output;
}

function lineOf(css, index) {
  return css.slice(0, index).split("\n").length;
}

function blockName(masked, openIndex) {
  const prefix = masked.slice(Math.max(0, openIndex - 180), openIndex).trimEnd();
  const atRule = prefix.match(/@(media|keyframes|supports|container|font-face|page|layer)[^{;]*$/);
  if (atRule) return `@${atRule[1]} ${prefix.slice(prefix.lastIndexOf(`@${atRule[1]}`) + atRule[1].length + 1).trim()}`.trim();
  const selector = prefix.slice(Math.max(prefix.lastIndexOf("}"), prefix.lastIndexOf(";")) + 1).trim().replace(/\s+/g, " ");
  return selector || "CSS block";
}

const masked = maskCss(source);
const stack = [];
for (let index = 0; index < masked.length; index += 1) {
  const char = masked[index];
  if (char === "{") stack.push({ index, line: lineOf(masked, index), name: blockName(masked, index) });
  if (char === "}") {
    const open = stack.pop();
    assert(open, `${relativePath}:${lineOf(masked, index)} closes a block that was never opened`);
  }
}
assert.equal(stack.length, 0, stack.map((block) => `${relativePath}:${block.line} unclosed ${block.name}`).join("\n"));

for (const rule of masked.matchAll(/@(media|keyframes)\b[^{]*\{/g)) {
  const opening = rule.index + rule[0].length - 1;
  let depth = 0;
  let closed = false;
  for (let index = opening; index < masked.length; index += 1) {
    if (masked[index] === "{") depth += 1;
    if (masked[index] === "}") depth -= 1;
    if (depth === 0) { closed = true; break; }
  }
  assert(closed, `${relativePath}:${lineOf(masked, opening)} unclosed @${rule[1]} block`);
}

assert(!/[^}\s]$/.test(masked.trim()) || /}\s*$/.test(masked), `${relativePath}: stylesheet appears truncated at EOF`);
assert(!/@(?:media|keyframes)\b[^{]*\{[\s\S]*@(?:media|keyframes)\b[^{]*\{[\s\S]*$/.test(masked) || stack.length === 0, `${relativePath}: possible illegally nested at-rules`);

[".modern-home", ".home-hero", ".home-choice-grid", ".home-hub-card", ".home-stat-grid", ".home-avatar", ".home-run-card", ".hall-home-card"].forEach((selector) => {
  assert(source.includes(selector), `${relativePath}: missing modern Home selector ${selector}`);
});

assert(/@keyframes\s+trophy-pop\s*\{[\s\S]*?from\s*\{[\s\S]*?\}[\s\S]*?to\s*\{[\s\S]*?\}[\s\S]*?\}/.test(masked), `${relativePath}: @keyframes trophy-pop must include closed from/to blocks`);
assert(/@media\s*\(max-width:\s*780px\)\s*\{[\s\S]*?\.bottom-nav\s*\{[\s\S]*?\}[\s\S]*?\.bottom-nav button\s*\{[\s\S]*?\}[\s\S]*?\}/.test(masked), `${relativePath}: mobile bottom navigation media block is missing or unclosed`);

console.log("CSS syntax test passed: css/game.css blocks and modern Home selectors are valid.");
