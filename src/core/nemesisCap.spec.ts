/**
 * 宿敌列表最多记几个 —— 又一个写在两处的差一裸数。
 *
 * ## 由来（第 194 轮，顺着上一轮那条线扫 `slice(-N)`）
 *
 * `core/worldMemory` 里有两处:
 *
 * ```text
 * 156  list: [...nemeses.slice(-49), created]     ← 单场败北
 * 195  : [...nemeses.slice(-49), next]            ← 离线整段结算
 * ```
 *
 * `-49` 加一条 = 上限 **50**。实测连记 60 个不同的宿敌后，列表停在 50，
 * 最旧的 10 个被静默丢掉 —— 行为是对的，但它:
 *
 * 1. **没有名字** —— `-49` 读起来像「49 个」，实际是「留 49 加 1 = 50」;
 * 2. **没有来由** —— 为什么是 50 而不是 20 或 200，一句解释也没有;
 * 3. **写在两处** —— 改一处漏一处，两条路径（在线单场 / 离线整段）就会
 *    给出不同长度的列表，而玩家看到的是同一个「宿敌」栏。
 *
 * ## 为什么这个数对玩家可见
 *
 * 宿敌列表渲染在**修仙录**里（`LegacyView` 的「宿敌」栏）。超出上限的会被丢，
 * 而丢的时候没有任何提示 —— 玩家只会发现「上次那个宿敌怎么不见了」。
 * 这是可接受的取舍（列表不能无限长），但那个数该有名字、有来由、只写一处。
 *
 * ## 这条判据守什么
 *
 * ① 上限是具名常量;
 * ② 两处都读它，不许再有裸 `-49`;
 * ③ 常量旁边写清来由;
 * ④ 上限是个正数且在合理区间（防空转 + 防手滑）。
 *
 * ## 故障注入
 *
 * 把一处换回裸数 `slice(-49)` → 「是具名常量」那条红。
 * 只改一处（让离线整段用 -29）→ 同上那条红（两条路径分叉）。
 * 把 slice 的方向反过来（留最旧而非最新）→ 「保留的是最近的那些」那条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { recordLoss, NEMESIS_THRESHOLD } from "./worldMemory";

const SRC = "src/core/worldMemory.ts";

describe("宿敌列表 · 最多记几个", () => {
  it("上限是具名常量，两处都读它", () => {
    const src = stripComments(readSource(SRC));
    expect(
      /nemeses\.slice\(-\d+\)/.test(src),
      "宿敌上限还是裸数 `slice(-49)` —— 读起来像「49 个」，实际是「留 49 加 1 = 50」；" +
        "而且它写在两处（在线单场 / 离线整段），改一处漏一处两条路径就会给出不同长度",
    ).toBe(false);

    const m = /const NEMESIS_MAX\w*\s*=\s*(\d+)/.exec(src);
    expect(m, "没有给宿敌上限起名字").not.toBeNull();

    const name = m![1] ? "NEMESIS_MAX" : "";
    void name;
    const uses = [...src.matchAll(/\bNEMESIS_MAX\w*\b/g)].length;
    /* 声明 1 次 + 两处使用 */
    expect(uses, "上限常量只有声明、没被那两处读到").toBeGreaterThanOrEqual(3);
  });

  it("上限是正数且在合理区间", () => {
    const src = stripComments(readSource(SRC));
    const m = /const NEMESIS_MAX\w*\s*=\s*(\d+)/.exec(src);
    expect(m, "找不到常量").not.toBeNull();
    const n = Number(m![1]);
    /*
     * 少于 10 会让常见玩家很快撞上限（一场历练能记好几个）;
     * 多于 200 则该栏滚不到底，而玩家不会翻那么远。
     */
    expect(n, "宿敌上限太小 —— 常见玩家很快撞上限，而撞上限是静默丢弃").toBeGreaterThanOrEqual(10);
    expect(n, "宿敌上限太大 —— 修仙录那一栏滚不到底，没人会翻那么远").toBeLessThanOrEqual(200);
  });

  it("行为:记到上限之后列表停住，且保留的是最近的那些", () => {
    /*
     * 这条核**行为**，不只是源码形状 —— 上一条只管「有个常量」,
     * 而这里证明那个常量真的被用上了。
     */
    let list: ReturnType<typeof recordLoss>["list"] = [];
    const N = 60;
    for (let i = 0; i < N; i += 1) {
      const r = recordLoss(list, `e${i}`, `敌${i}`, "r1", 1000 + i, NEMESIS_THRESHOLD);
      list = r.list;
    }
    const cap = Number(/const NEMESIS_MAX\w*\s*=\s*(\d+)/.exec(stripComments(readSource(SRC)))![1]);
    expect(list.length, `记了 ${N} 个宿敌，列表该停在上限 ${cap}`).toBe(cap);
    // 保留的必须是**最近**的那一批 —— 丢掉的该是最旧的
    expect(list[0]!.enemyId, "留下的第一个不是最近的那批 —— 丢错了方向").toBe(`e${N - cap}`);
    expect(list[list.length - 1]!.enemyId, "最后一个不是刚记的那个").toBe(`e${N - 1}`);
  });

  it("常量旁边写清了来由", () => {
    const src = readSource(SRC);
    const decl = src.indexOf("const NEMESIS_MAX");
    expect(decl, "找不到常量").toBeGreaterThan(-1);
    const docStart = src.lastIndexOf("/**", decl);
    expect(docStart, "常量上方没有注释块").toBeGreaterThan(-1);
    const between = src.slice(docStart, decl);
    /*
     * 注释块与常量之间可以有的东西:**只有空白，与 `export`** ——
     * 声明写成 `export const NEMESIS_MAX`,而 `decl` 指向 `const` 那一截。
     * 第一版要求「trimEnd 后就是闭注释」，于是被那个 `export ` 判成「隔着别的代码」（实测）。
     */
    const gap = between.slice(between.lastIndexOf("*/") + 2).trim();
    expect(gap, `注释块与常量之间隔着别的代码:«${gap}»`).toMatch(/^(export)?$/);
    expect(between, "上限旁边没有一句来由 —— 下一个人改它时只能猜「为什么是 50」").toMatch(
      /为什么/,
    );
  });
});
