import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/*
 * 视觉节奏的两条硬底线 —— 都不看图也能查，且改坏了会直接红。
 *
 * 1) 页面外壳:所有常规页共用同一套内边距与纵向节奏(.folio-page)。
 *    新页若自带一套间距,滚动到第二屏就会「跳格」—— 每个页面都对,合起来不对。
 * 2) 颜色:组件里不写裸十六进制色;调色板的单一来源是 style.css 的 token。
 *    裸色最麻烦的不是写错,而是换肤(夜间主题)时它不会跟着变。
 */

const VIEWS = resolve(__dirname, "../views");
const COMPONENTS = resolve(__dirname, "../components");

/** 开局两页是单屏版式,库存页按栏目自带分节,均不套常规外壳 */
const SHELL_EXEMPT = new Set(["CreateView.vue", "WelcomeView.vue", "InventoryView.vue"]);
const SHELL = /class="[^"]*\bfolio-page\b[^"]*"/;
const STACK = /class="[^"]*\bfolio-page--stack\b[^"]*"/;
const COMMAND_DECK = /data-page-rhythm="command-deck"/;

/** 两处裸色都有明确理由:canvas 画不了 CSS 变量;传送门是独立艺术块(见各自注释) */
const HEX_EXEMPT: Array<{ file: string; why: string }> = [
  { file: "common/SpiritRootReveal.vue", why: "canvas 2D 取不到 CSS 变量,金色按常量传" },
  { file: "common/WarpPortal.vue", why: "传送门是独立艺术块,渐变两端是刻意的暗场色" },
];

const walk = (dir: string, base = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(resolve(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`],
  );

describe("视觉节奏 · 页面外壳与配色来源", () => {
  it("常规页共用同一套外壳内边距", () => {
    const bad = readdirSync(VIEWS)
      .filter((f) => f.endsWith(".vue") && !SHELL_EXEMPT.has(f))
      .filter((f) => !SHELL.test(readFileSync(resolve(VIEWS, f), "utf8")));
    expect(bad, "这些页面没套标准外壳 —— 滚动时会跳格").toEqual([]);
  });

  it("常规页的纵向节奏也走同一个页框,不再逐页手拼 space-y", () => {
    const bad = readdirSync(VIEWS)
      .filter((f) => f.endsWith(".vue") && !SHELL_EXEMPT.has(f))
      .filter((f) => {
        const src = readFileSync(resolve(VIEWS, f), "utf8");
        return !STACK.test(src) && !COMMAND_DECK.test(src);
      });
    expect(bad, "这些页面没接页框纵向节奏").toEqual([]);
  });

  it("首页指挥台自排节奏,但必须显式标记并由页面样式承担间隔", () => {
    const home = readFileSync(resolve(VIEWS, "HomeView.vue"), "utf8");
    const css = readFileSync(resolve(__dirname, "../styles/pages/home.css"), "utf8");

    expect(home).toContain('data-page-rhythm="command-deck"');
    expect(css, "首页不能用标记逃过节奏,实际间隔仍要在样式里成立").toMatch(
      /\.home-deck \{[\s\S]{0,120}?display: flex;[\s\S]{0,80}?flex-direction: column;[\s\S]{0,80}?gap: 1rem;/,
    );
  });

  it("组件里不写裸十六进制色(两处已注明的例外除外)", () => {
    const allowed = new Set(HEX_EXEMPT.map((e) => e.file));
    const offenders: string[] = [];
    for (const rel of walk(COMPONENTS)) {
      if (!rel.endsWith(".vue") || allowed.has(rel)) continue;
      const hits = readFileSync(resolve(COMPONENTS, rel), "utf8").match(/#[0-9a-fA-F]{6}\b/g);
      if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(",")}`);
    }
    expect(offenders, "裸色在夜间主题下不会跟着换肤").toEqual([]);
  });

  it("豁免名单自身也要有据:文件确实存在且确实用了裸色", () => {
    for (const e of HEX_EXEMPT) {
      const src = readFileSync(resolve(COMPONENTS, e.file), "utf8");
      expect(src, `${e.file} 已不再用裸色,把豁免删掉(${e.why})`).toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
