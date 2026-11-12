/**
 * 弹窗里的山色也要随世界换 —— Teleport 到 body 之后,那层继承断了。
 *
 * ## 这一条是读代码读出来的
 *
 * `BaseModal` 是 `<Teleport to="body">` 的,而 `--world-mountain` 定义在
 * `.app-shell[data-world=…]` 上(人间=墨、仙界=蓝、神界=紫、混沌=幽蓝)。
 * 于是弹窗**不在** `.app-shell` 的子树里,`InkScene` 里那句
 * `fill: var(--world-mountain, currentColor)` 取不到值,山骨退化成 `currentColor`
 * —— 也就是不管在哪一界,弹窗里的山都是同一种颜色。
 *
 * 全站 21 个「有画 + 用 BaseModal」的组件里,此前只有两处自己补了这个变量
 * (`celestial.css` 的试炼档案、`cultivation.css` 的突破结果)—— 那两处都是
 * 被同一件事咬过之后才补的,补的时候没往上看「还有多少处也一样」。
 *
 * ## 判据守什么
 *
 * 每一个「弹窗 + 画」的组件,它给那片画写的那条 CSS 规则里必须有
 * **自己的 `--world-mountain`**(或它的父级)、或者整幅画的容器不在
 * body 那层(即有别的锚)。判据不去逐个跑浏览器 —— 那要开二十次窗;
 * 改为钉**规则文本**:那些 `.xxx__scene` 规则里得能看见 `--world-mountain`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { walkFiles } from "@/test/readSource";

const ROOT = process.cwd();
const COMPONENTS = join(ROOT, "src/components");
const STYLES = join(ROOT, "src/styles/pages");

/** 弹窗里那些画的类名(如 `.equip-dossier__scene`) */
function sceneClasses(): string[] {
  const out: string[] = [];
  for (const file of walkFiles(COMPONENTS, (n) => n.endsWith(".vue"))) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("BaseModal") || !src.includes("<InkScene")) continue;
    for (const m of src.matchAll(/class="([a-z][a-z0-9-]*__scene[^"]*)"/g)) {
      /*
       * `affix-transfer__scene--source` 这种带修饰的取基名 —— 修饰类与该基名同一条规则。
       */
      out.push(m[1]!.split(/\s+/)[0]!);
    }
  }
  return Array.from(new Set(out));
}

/**
 * 全部样式表拼成一份,用于查规则。
 *
 * 必须把 `src/style.css` 也算进来 —— 玄枢图的 `.atlas-volume__scene` 就写在那里
 * (它不是「某一页」的样式,而是共用外壳的一部分)。第一版只扫 `styles/pages/`,
 * 于是那一条被判成「样式表里找不到规则」(实测漏掉的就是它)。
 */
function allCss(): string {
  /*
   * 两处来源都要读:
   *   · `readStyleCss()` —— `src/style.css` 本体(仓库约定:那份是按路由拆过的残卷,
   *     不许 spec 自己 `readFileSync`;`specReadSource.spec` 会红)
   *   · `styles/pages/*.css` —— 页面层。`readStyleCss()` 虽然也拼了页面层,
   *     但它的 `PAGES` 清单不全,实测在它 64 万字符里找不到 `furnace-row__scene`
   *     这类只在页面文件里出现的规则。
   */
  const pages = readdirSync(STYLES)
    .filter((n) => n.endsWith(".css"))
    .map((n) => readFileSync(join(STYLES, n), "utf8"))
    .join("\n");
  return readStyleCss() + "\n" + pages;
}

describe("弹窗里的山色要随世界换", () => {
  it("每个弹窗画都自己补了 --world-mountain", () => {
    const css = allCss();
    const missing: string[] = [];
    for (const cls of sceneClasses()) {
      /*
       * 取**这一条规则**的整块 —— 非贪婪到最近的 `}`。
       * 不能只查「整份 CSS 里有没有 --world-mountain」:那样任何一条规则补过,
       * 所有类都会判绿(实测:把 decompose-row__scene 那条删掉,判据仍然绿)。
       */
      /*
       * 先**去掉注释**再匹配规则块。
       * 非贪婪到最近的 `}` 会被注释里的 `}` 截断 —— 而我给每一条补的那段说明里
       * 恰好就写着 `var(--world-mountain, currentColor)` 与花括号,于是取到的
       * 只是一段注释,`if (!rule.includes("--world-mountain"))` 永远不成立。
       * 实测:把某条规则里的声明删掉,判据仍然绿 —— 就是这个原因。
       */
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const rule = stripped.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? "";
      if (!rule) {
        /* 样式写在组件内 scoped 块里也算 —— 那些不走 styles/pages */
        const inComponent = walkFiles(COMPONENTS, (n) => n.endsWith(".vue")).some((f) =>
          new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?--world-mountain`).test(readFileSync(f, "utf8")),
        );
        if (!inComponent) missing.push(`${cls}(样式表里找不到规则)`);
        continue;
      }
      if (!rule.includes("--world-mountain")) missing.push(cls);
    }
    expect(
      missing,
      "这些弹窗画没有自己的 --world-mountain —— Teleport 到 body 之后取不到 .app-shell 那一层,山骨退化成 currentColor",
    ).toEqual([]);
  });
});
