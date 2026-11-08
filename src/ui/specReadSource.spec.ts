/**
 * 界面契约测试的读源纪律 —— 读文件这件事只该有一种写法。
 *
 * 由来:32 个 spec 各自写了一份 `source(rel)`,其中 28 份逐字相同,都带着同一条
 * 分支:`src/style.css` 要走 readStyleCss() 拼回整份样式(运行时那几份是按路由
 * 拆掉的,直读 style.css 会漏掉页面层)。这条分支是**约定**,不是可选项。
 *
 * 危险之处不是重复本身,而是「抄漏了还全绿」:拿简版读 style.css,读到的是
 * 一份缺了页面层的样式,判据照样通过,只是它验的不是界面实际用的那份。
 * 现在实现收在 `@/test/readSource` 一处,这份判据守住「别再长回第二份」。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  ROOT,
  isSourceFile,
  isSourceOrScript,
  isSpecFile,
  isTypeScriptOrVue,
  isVueFile,
  walkFiles,
} from "@/test/readSource";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SPECS = walkFiles(resolve(ROOT, "src"), isSpecFile).map((full) => ({
  path: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
  src: readFileSync(full, "utf8"),
}));

describe("界面契约测试 · 读源只有一种写法", () => {
  it("没有 spec 自己再定义一份 source(rel)", () => {
    /*
     * **两种写法都要拦**:函数声明(`function source(rel`)与箭头函数
     * (`const source = (…) => …`)。第一版只认前者,而 `eventDesk.spec` 用的是后者
     * —— 注入 `const source = (rel) => readFileSync(rel, "utf8")` 判据照样绿。
     *
     * 它当时没读 `style.css`,所以无害;但只要这种写法存在,下次有人用它读那份
     * 「按路由拆过的残卷」,就会静默验错对象。
     */
    /*
     * **排除本文件**:下面的注释里为了说清「第二版要拦什么」举了两种写法的例子,
     * 其中就有 `const source = …` —— 判据不分注释与代码,会把自己抓进来。
     * (本会话此前栽过同形的坑:`testDeterminism` / `mechanicsKeyBind` 都因自引用误报。)
     */
    const self = "src/ui/specReadSource.spec.ts";
    const offenders = SPECS.filter(
      (s) =>
        s.path !== self &&
        (/function source\(\s*rel/.test(s.src) || /const source\s*=\s*\(/.test(s.src)),
    ).map((s) => s.path);
    expect(
      offenders,
      "这些 spec 又各自写了一份 source() —— 改用 @/test/readSource 的 readSource,否则抄成简版会静默读错 style.css",
    ).toEqual([]);
  });

  it("直接读 style.css 的地方都得走 readStyleCss()", () => {
    // 拼装逻辑只有 readStyleCss 一份:任何 spec 直接 readFileSync 那份 style.css,
    // 拿到的都是缺页面层的残卷。
    const offenders = SPECS.filter(
      (s) =>
        /readFileSync\([^)]*style\.css/.test(s.src) ||
        /readFileSync\(resolve\(ROOT,\s*["']src\/style\.css["']\)/.test(s.src),
    ).map((s) => s.path);
    expect(offenders, "这些 spec 直接读了 style.css —— 那份是按路由拆过的残卷").toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    // 大部分界面契约测试都靠读源做断言;若 walk 坏了这里会静默通过。
    const readers = SPECS.filter((s) => s.src.includes("@/test/readSource")).length;
    expect(readers, "一个用共享 readSource 的 spec 都没扫到").toBeGreaterThan(20);
  });

  it("没有 spec 自己再定义一份 walk(dir)", () => {
    /*
     * 目录遍历的八份实现彼此只差一行「收哪些扩展名」,而那正是最容易抄错的:
     * `!.endsWith(".spec.ts")` 少个 s、把 `.d.ts` 当源码、或漏掉 `.mjs`,
     * 都会让某个审计悄悄少扫一片而不报错。差异摊到 walkFiles 的谓词参数上,
     * 遍历本身只写一次。
     *
     * 仍在用自己那份 walk 的两个(按需自取相对路径 / 需要 posix 归一)留着,
     * 但它们的形态与本条判据不冲突 —— 判据只拦「重新长出一份通用 walk」。
     */
    const ALLOW = new Set([
      // 返回相对路径而非绝对路径,与 walkFiles 的契约不同,且只有它自己用
      "src/ui/folioChapterHead.spec.ts",
    ]);
    const offenders = SPECS.filter((s) => /function walk\(/.test(s.src) && !ALLOW.has(s.path)).map(
      (s) => s.path,
    );
    expect(
      offenders,
      "这些 spec 又各自写了一份 walk() —— 改用 @/test/readSource 的 walkFiles(dir, 谓词)",
    ).toEqual([]);
  });

  it("walkFiles 的谓词把「收不收 spec」写成了名字", () => {
    // 这一条是上一条的注脚:分界必须显式。查「谁在用某个导出」要把 spec 算进来,
    // 查「界面用了哪份样式」不该算 —— 两类都存在于本仓,靠名字区分而不是各记一个正则。
    expect(isTypeScriptOrVue("a.spec.ts"), "查引用要把用例算进语料").toBe(true);
    expect(isSourceFile("a.spec.ts"), "查样式语料不该收用例").toBe(false);
    expect(isTypeScriptOrVue("a.d.ts"), "类型声明两头都不该收").toBe(false);
    expect(isVueFile("A.vue")).toBe(true);
    expect(isSourceOrScript("scripts/x.mjs")).toBe(true);
    expect(isSourceOrScript("src/x.ts")).toBe(true);
  });
});
