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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".spec.ts")) out.push(full);
  }
  return out;
}

const SPECS = walk(resolve(ROOT, "src")).map((full) => ({
  path: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
  src: readFileSync(full, "utf8"),
}));

describe("界面契约测试 · 读源只有一种写法", () => {
  it("没有 spec 自己再定义一份 source(rel)", () => {
    const offenders = SPECS.filter((s) => /function source\(\s*rel/.test(s.src)).map((s) => s.path);
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
});
