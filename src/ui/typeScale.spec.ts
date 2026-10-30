import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SRC = resolve(ROOT, "src");
const STYLE = readFileSync(resolve(SRC, "style.css"), "utf8");
const TAILWIND = readFileSync(resolve(ROOT, "tailwind.config.js"), "utf8");

const TIERS = ["note", "body", "title", "section", "heading"] as const;
const MOBILE = { note: 10, body: 11, title: 14, section: 15, heading: 18 };
const DESKTOP = { note: 11, body: 12, title: 15, section: 16, heading: 20 };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".vue") || (entry.endsWith(".ts") && !entry.endsWith(".spec.ts"))) {
      out.push(full);
    }
  }
  return out;
}

function tierValues(block: string): Record<(typeof TIERS)[number], number> {
  return Object.fromEntries(
    TIERS.map((tier) => {
      const value = new RegExp(`--type-${tier}:\\s*(\\d+)px`).exec(block)?.[1];
      return [tier, Number(value)];
    }),
  ) as Record<(typeof TIERS)[number], number>;
}

describe("桌面阅读字阶 · 手机与宽屏共用一套语义刻度", () => {
  it("手机维持原五档，960px 以上整体抬一档", () => {
    const mobile = /:root \{([\s\S]*?)\n\}/.exec(STYLE)?.[1] ?? "";
    const desktop =
      /@media \(min-width: 960px\) \{\s*:root \{([\s\S]*?)\n  \}\s*\}/.exec(STYLE)?.[1] ?? "";

    expect(tierValues(mobile), "手机阅读档被改了").toEqual(MOBILE);
    expect(tierValues(desktop), "桌面阅读档没有整体抬升").toEqual(DESKTOP);
  });

  it("六个语义字号都由 Tailwind 转发到同一组变量", () => {
    for (const tier of [...TIERS, "display"] as const) {
      expect(TAILWIND, `缺 text-${tier} → --type-${tier} 的映射`).toContain(
        `${tier}: "var(--type-${tier})"`,
      );
    }
  });

  it("常规界面不再写回五个裸像素档", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const code = readFileSync(file, "utf8")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (/text-\[(?:10|11|14|15|18)px\]/.test(code)) {
        offenders.push(relative(ROOT, file).replace(/\\/g, "/"));
      }
    }
    expect(offenders, "这些文件又把阅读字阶写成了裸像素").toEqual([]);
  });

  it("排版角色也读同一组变量，卷首题字单独走 display", () => {
    for (const [role, tier] of [
      ["t-card", "title"],
      ["t-entry", "title"],
      ["t-item", "title"],
      ["t-body", "body"],
      ["t-note", "note"],
    ] as const) {
      const block = new RegExp(`\\.${role} \\{([\\s\\S]*?)\\}`).exec(STYLE)?.[1] ?? "";
      expect(block, `.${role} 没有跟随 --type-${tier}`).toContain(`font-size: var(--type-${tier})`);
    }

    const header = readFileSync(resolve(SRC, "components/common/FolioPageHeader.vue"), "utf8");
    expect(header, "卷首题字要读 display 档").toContain("text-display");
  });

  it("真浏览器门同时核变量与代表元素的计算字号", () => {
    const layout = readFileSync(resolve(ROOT, "scripts/layout-check.mjs"), "utf8");
    expect(layout, "巡页要读 --type-* 变量").toContain("--type-${tier}");
    expect(layout, "巡页要核位置签 / 说明 / 章节题 / 卷首题").toContain(
      '["位置签", type.note, expected.note]',
    );
    expect(layout, "桌面与手机应各有一套期望值").toContain(
      "{ note: 11, body: 12, title: 15, section: 16, heading: 20, display: 28 }",
    );
  });
});
