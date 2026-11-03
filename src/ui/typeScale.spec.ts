import { describe, expect, it } from "vite-plus/test";
import { ROOT, isSourceFile, walkFiles } from "@/test/readSource";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const SRC = resolve(ROOT, "src");
const STYLE = readStyleCss();
const TAILWIND = readFileSync(resolve(ROOT, "tailwind.config.js"), "utf8");

const TIERS = ["note", "body", "title", "section", "heading"] as const;
const MOBILE = { note: 10, body: 11, title: 14, section: 15, heading: 18 };
const DESKTOP_COMPACT = { note: 11, body: 12, title: 15, section: 16, heading: 20 };
const DESKTOP_READING = { note: 12, body: 14, title: 16, section: 18, heading: 24 };

function tierValues(block: string): Record<(typeof TIERS)[number], number> {
  return Object.fromEntries(
    TIERS.map((tier) => {
      const value = new RegExp(`--type-${tier}:\\s*(\\d+)px`).exec(block)?.[1];
      return [tier, Number(value)];
    }),
  ) as Record<(typeof TIERS)[number], number>;
}

describe("桌面阅读字阶 · 手机与宽屏共用一套语义刻度", () => {
  it("手机维持原五档；书桌先紧凑，完整书脊展开后再抬到阅读档", () => {
    const mobile = /:root \{([\s\S]*?)\n\}/.exec(STYLE)?.[1] ?? "";
    const compact =
      /@media \(min-width: 960px\) \{\s*:root \{([\s\S]*?)\n  \}\s*\}/.exec(STYLE)?.[1] ?? "";
    const reading =
      /@media \(min-width: 1100px\) \{\s*:root \{([\s\S]*?)\n  \}\s*\}/.exec(STYLE)?.[1] ?? "";

    expect(tierValues(mobile), "手机阅读档被改了").toEqual(MOBILE);
    expect(tierValues(compact), "960px 紧凑桌面档被改了").toEqual(DESKTOP_COMPACT);
    expect(tierValues(reading), "1100px 完整书桌没有切到阅读档").toEqual(DESKTOP_READING);
  });

  it("六个语义字号都由 Tailwind 转发到同一组变量", () => {
    for (const tier of [...TIERS, "display"] as const) {
      expect(TAILWIND, `缺 text-${tier} → --type-${tier} 的映射`).toContain(
        `${tier}: "var(--type-${tier})"`,
      );
    }
  });

  it("常规界面不再写回裸像素档 —— 包括恰好等于某一档的那几个数", () => {
    /*
     * 拦的是「本该读变量却写死数字」。12 与 16 曾经不在拦截名单里,因为
     * 它们正好等于**中档**的 body 与 section —— 可字阶分三档:手机 11/15、
     * 中档 12/16、宽屏阅读 14/18。写死 16 的段落于是永远停在 16,
     * 手机档该是 15、宽屏该是 18,它一处都不跟。
     *
     * 实测抓到的两处:破境结果那句「突破成功」(手机 15 / 宽屏 18 都写成了 16)、
     * 灵脉投入按钮(宽屏该 14,写死 12)。
     *
     * 放行 input / textarea 上的 16:那是 iOS 聚焦不缩放的硬要求,
     * 与阅读字阶无关,换成 15/18 反而会触发缩放。
     */
    const offenders: string[] = [];
    for (const file of walkFiles(SRC, isSourceFile)) {
      const code = readFileSync(file, "utf8")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const m of code.matchAll(/text-\[(8|9|10|11|12|13|14|15|16|18)px\]/g)) {
        /*
         * 8 / 9 是徽标与印面的字:它们要塞进 13px 见方的方块里,
         * 用正文档位会直接撑破。这类「尺寸由容器决定」的字不读阅读字阶。
         */
        if (m[1] === "8" || m[1] === "9") continue;
        if (m[1] === "16") {
          // 只有当它落在 input / textarea 的开标签里才放行
          const before = code.slice(0, m.index);
          const tagStart = before.lastIndexOf("<");
          const tag = before.slice(tagStart).split("\n").slice(0, 12).join("\n");
          if (/^<(?:input|textarea)\b/.test(tag.trim())) continue;
        }
        offenders.push(relative(ROOT, file).replace(/\\/g, "/"));
        break;
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
