import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const PAGE_DIR = "src/styles/pages";
const PAGES = [
  "world.css",
  "build.css",
  "home.css",
  "cultivation.css",
  "adventure.css",
  "inventory.css",
  "dongfu.css",
  "market.css",
  "apprentice.css",
  "realm-codex.css",
  "titles.css",
  "legacy.css",
  "character.css",
  "celestial.css",
  "collection.css",
  "souls.css",
  "settings.css",
];

/**
 * 测试读的是“逻辑上的整份样式”。
 *
 * 运行时为了首屏把页面样式拆进各自的路由分片；契约测试仍要按原顺序看到
 * 卷首到页尾的完整规则，故这里把 base 与分页样式重新拼回同一份文本。
 */
export function readStyleCss(): string {
  const base = readFileSync(resolve(ROOT, "src/style.css"), "utf8");
  const tailMarker = "/*\n * 开关(.toggle-ink)";
  const tailAt = base.indexOf(tailMarker);
  if (tailAt < 0) throw new Error("style.css 里找不到共享尾段标记");

  const pages = PAGES.map((file) => {
    const text = readFileSync(resolve(ROOT, PAGE_DIR, file), "utf8");
    return layerBlock(text, "@layer page {", file);
  }).join("\n\n");

  // style.css 的共享规则原本包在一层里；测试拼接时先合上，再让页面层独立出现，
  // 最后为尾段重新开一层，既保留原顺序，也不会把页面规则误读成共享层。
  return `${base.slice(0, tailAt).trimEnd()}\n}\n${pages}\n@layer shared {\n${base.slice(tailAt)}`;
}

function layerBlock(text: string, marker: string, file: string): string {
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${file} 里找不到 ${marker}`);

  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  throw new Error(`${file} 里的 ${marker} 没有配平的花括号`);
}
