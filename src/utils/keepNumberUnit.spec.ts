import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, walkFiles } from "@/test/readSource";
import { keepNumberUnit } from "./keepNumberUnit";

/** U+00A0 在源码里肉眼不可见,断言里显式写出来 */
const NBSP = "\u00a0";

describe("keepNumberUnit · 数字不许与量词分家", () => {
  it("数字与紧随其后的量词之间换成不换行空格", () => {
    expect(keepNumberUnit("灵石 998 万")).toBe(`灵石 998${NBSP}万`);
    expect(keepNumberUnit("3 次")).toBe(`3${NBSP}次`);
    expect(keepNumberUnit("12 层")).toBe(`12${NBSP}层`);
  });

  it("单位的「万/亿/兆」跟在数字后面时也一起锁住", () => {
    // 这条正是两份实现漂移的地方:洞府那份带换算单位,首页那份没有
    expect(keepNumberUnit("耗 1.5 万 石")).toBe(`耗 1.5${NBSP}万 石`);
    expect(keepNumberUnit("耗 1200 亿 灵石")).toBe(`耗 1200${NBSP}亿 灵石`);
  });

  it("不在量词表里的字不锁 —— 别把整句都变成不换行", () => {
    expect(keepNumberUnit("第 3 重")).toBe("第 3 重");
    expect(keepNumberUnit("境界 5 之上")).toBe("境界 5 之上");
  });

  it("没有空格就不动", () => {
    expect(keepNumberUnit("998万")).toBe("998万");
    expect(keepNumberUnit("余 3 次 · 尚差 12 石")).toBe(`余 3${NBSP}次 · 尚差 12${NBSP}石`);
  });
});

describe("不换行锁定 · 只有一个出处", () => {
  it("界面里不再自己写一份数字+量词锁", () => {
    const offenders: string[] = [];
    /* 防空转:一个文件都没扫到时,"没有违规"是假绿 —— 见下面的数量断言 */
    let scanned = 0;
    for (const file of walkFiles(
      resolve(ROOT, "src"),
      (n) => n.endsWith(".vue") || n.endsWith(".ts"),
    )) {
      if (file.endsWith("keepNumberUnit.ts") || file.endsWith(".spec.ts")) continue;
      scanned += 1;
      const src = readFileSync(file, "utf8");
      /*
       * 特征是把空格换成不换行空格。源码里两种写法都算:
       *   ① 直接写那个字符(U+00A0,肉眼不可见);
       *   ② 写成转义序列 \u00a0(运行时同样是 NBSP)。
       * 只匹配 ① 会漏掉 ② —— 实测就漏过一次。
       */
      if (src.includes(String.fromCharCode(0xa0)) || /\\u00a0/i.test(src)) {
        offenders.push(file);
      }
    }
    expect(scanned, "一个源文件都没扫到 —— 过滤条件或路径写错了,上面的空集不算数").toBeGreaterThan(
      100,
    );
    expect(offenders, "这些文件又手写了一份不换行锁定 —— 改用 @/utils/keepNumberUnit").toEqual([]);
  });
});
