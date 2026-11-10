/**
 * 剑意纯度的两侧读数 —— 数据早就把答案算好了,视图只印了一半。
 *
 * ## 缺口
 *
 * `core/daoDepth` 的 `SwordPurity.checks` 每项都产出 `{ name, ok }`,
 * 类型注释里就写着「供 UI 解释『为什么是这几层』」。而天界页的剑意面板写的是
 *
 * ```ts
 * swordInfo.checks.filter((c) => c.ok).map((c) => c.name).join("、") || "尚无一纯"
 * ```
 *
 * 即:只印通过的那些,不通过时退回一句「尚无一纯」。
 * 玩家看到「当前剑意 1/4 层」,想知道差哪三项 —— 界面上一个字都没有。
 * 而这一屏正是他决定「要不要先卸一件法宝、要不要停掉吸血功法」的地方。
 *
 * 这是本仓点名的「只说不行」:报了结果、没报怎么来的。
 * 与 `ui/mentorBehaviorAxes`(师承「相亲 / 相左」)完全同构 ——
 * 那边解决的是「报了 0.35,看不到是什么扣的」,形状照抄。
 *
 * ## 判据守什么
 *
 * 一 两侧都算出来,且**直接来自 core 的 checks**(不重写判定、不重排);
 * 二 空侧不出(全达标时不许印一条空的「未达」);
 * 三 顺序与判定一致(改判定顺序,界面跟着变);
 * 四 视图不许再 `filter((c) => c.ok)` 一遍 —— 那是这条缺口回来最短的路;
 * 五 一句摘要能替两列说话(窄屏 / 读屏用)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { purityAxes, purityAxesSummary } from "./swordPurityAxes";
import type { SwordPurity } from "@/core/daoDepth";

const purity = (oks: boolean[]): SwordPurity => ({
  layers: oks.filter(Boolean).length,
  checks: oks.map((ok, i) => ({ name: `第${i + 1}项`, ok })),
});

describe("剑意纯度 · 两侧读数", () => {
  it("两侧都算出来,且与 core 的 checks 一一对应", () => {
    const axes = purityAxes(purity([true, false, false, false]))!;
    expect(axes.toward).toEqual(["第1项"]);
    expect(axes.against).toEqual(["第2项", "第3项", "第4项"]);
    // 两侧加起来就是全部判据 —— 一条都不许丢
    expect(axes.toward.length + axes.against.length).toBe(4);
  });

  it("顺序与判定一致 —— 不在这里重排", () => {
    const axes = purityAxes(purity([false, true, false]))!;
    expect(axes.toward).toEqual(["第2项"]);
    expect(axes.against).toEqual(["第1项", "第3项"]);
  });

  it("空侧是空数组而不是编一句占位 —— 视图据此决定整行不出", () => {
    expect(purityAxes(purity([true, true]))!.against).toEqual([]);
    expect(purityAxes(purity([false, false]))!.toward).toEqual([]);
  });

  it("四项全达 / 全未达都不抛错,且不返回 null", () => {
    expect(purityAxes(purity([true, true, true, true]))).not.toBeNull();
    expect(purityAxes(purity([false, false, false, false]))).not.toBeNull();
    // 没有剑道(非剑道道途)时才返回 null —— 那是「不适用」,不是「零层」
    expect(purityAxes(null)).toBeNull();
    expect(purityAxes(undefined)).toBeNull();
  });

  it("摘要能替两列说话:报数不报项名(项名两列已经说全)", () => {
    expect(purityAxesSummary(purityAxes(purity([true, false, false, false])))).toBe(
      "已达 1 项,另 3 项未达",
    );
    // 全达标:不再提「未达」
    const all = purityAxesSummary(purityAxes(purity([true, true, true, true])));
    expect(all).toContain("皆纯");
    expect(all).not.toContain("未达");
    // 全未达:说清一项都没有,而不是编一个「已达 0 项」
    const none = purityAxesSummary(purityAxes(purity([false, false, false, false])));
    expect(none).toContain("尚无一项");
    expect(none).not.toContain("已达 0");
    // 不适用时是空串,视图据此不出
    expect(purityAxesSummary(null)).toBe("");
  });

  it("视图不再自己 filter(c => c.ok) —— 那是这条缺口回来最短的路", () => {
    /*
     * 源码层判据:视图必须读 `purityAxes(...)`,并且**不许**再出现
     * `filter((c) => c.ok)` 这种只取一半的写法。
     * 行为判据核不到这件事 —— 视图少印一半时,页面照样渲染、单测照样绿。
     */
    const raw = readFileSync(resolve(__dirname, "../views/CelestialView.vue"), "utf8");
    /*
     * 断言前先剥掉注释 —— 注释里为了讲清来龙去脉会引用用户这两个字眼,
     * 不剥就会像上一轮那样:注释让判据永远通过(或永远报红)。
     */
    const view = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(view, "天界页要读两侧读数").toContain("purityAxes(");
    expect(view, "两侧读数要真的接到模板上").toContain("data-dao-purity-axes");
    expect(view, "「已达」那侧要有落点").toContain("data-dao-purity-toward");
    expect(view, "「未达」那侧要有落点").toContain("data-dao-purity-against");
    expect(view, "视图又在只取通过的那些 —— 「未达」那半会再次消失").not.toMatch(
      /checks\s*\.\s*filter\(\s*\(?\s*c\s*\)?\s*=>\s*c\.ok/,
    );
    expect(view, "「尚无一纯」那半兜底已被两侧读数取代").not.toContain("尚无一纯");
    // 防空转:视图真的读到了这个文件
    expect(view.length, "剥完注释视图几乎是空的 —— 路径或正则写错了").toBeGreaterThan(1000);
  });

  it("判据本身不空转:core 的判据条数与常量一致", () => {
    /*
     * `SWORD_PURITY_MAX_LAYERS` 是「/N 层」的分母,它由 PURITY_CHECKS 的长度推出。
     * 两侧读数加起来必须等于这个分母 —— 否则界面会报「/4 层」却只列出 3 项。
     */
    const checks = purity([true, true, true, true]);
    const axes = purityAxes(checks)!;
    expect(axes.toward.length + axes.against.length).toBe(checks.layers);
  });
});
