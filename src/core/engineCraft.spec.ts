/**
 * 炼丹执行的三条契约 —— 文件头列了,此前没有判据。
 *
 * ## 缺口(第 111 轮实测)
 *
 * `engineCraft.ts` 的文件头写着「这里定三件事」:
 *
 * ```text
 *   ·「没开炉」与「开炉失败」分开:门槛没过 / 材料不足都走 fired: false
 *     (不扣料、不掷骰、不计失败);
 *   · 失败时灵草按技艺保下一部分、灵石不退;
 *   · 双成在成功之后再掷一次,且夹在 0.8。
 * ```
 *
 * 而这个模块**没有同名 spec**。契约本身是对的(逐条查过实现),缺的是守卫。
 *
 * ## 三条各自的落点
 *
 * 前两条已经把实现推进了库(`wanxiang-engine` 的 recipes),本作只剩参数:
 *
 * ```text
 *  blocked()      门槛没过     → 库据此走 fired: false
 *  affordable()   材料不足     → 同上
 *  spentOnFail()  失败时的花费  → 灵草按比例保、灵石不退
 *  ALCHEMY_BONUS_CAP = 0.8      → 双成夹在 0.8
 * ```
 *
 * 所以判据不测库的行为(那是库自己的用例),只守**本作这一侧的四件事**还在。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { ALCHEMY_BONUS_CAP } from "./engineCraft";

const SRC = readFileSync(join(ROOT, "src/core/engineCraft.ts"), "utf8");

describe("炼丹执行 · 三条契约", () => {
  it("① 「没开炉」与「开炉失败」分开 —— blocked 与 affordable 是两个参数", () => {
    /*
     * 这条契约的实质:门槛没过(不知道怎么炼)与材料不足(知道怎么炼但没料)
     * 都该走 `fired: false`,而**两者的措辞不同**——前者说「不知此方」、
     * 后者说「灵草或灵石不足」。若把它们合成一个参数,玩家就分不清该去补什么。
     */
    expect(SRC, "找不到 blocked 参数 —— 「没开炉」可能被并进了 affordable").toContain("blocked:");
    expect(SRC, "找不到 affordable 参数").toContain("affordable:");
    // 两者都返回「为什么不开炉」的文案,正是这条契约的产物
    expect(SRC, "blocked 不再返回 blockers[0] —— 门槛档的措辞丢了").toContain("blockers[0]");
    expect(SRC, "affordable 的文案不见了").toMatch(/灵草或灵石不足/);
  });

  it("② 失败时灵草保一部分、灵石不退 —— spentOnFail 按 key 分支", () => {
    /*
     * 源码里的形状:
     *
     * ```ts
     * spentOnFail: (cost, _id, ctx) => {
     *   if (cost.key === "herb") { ... 按技艺保下一部分 ... }
     *   ... 灵石那条不退
     * }
     * ```
     *
     * 判据只查「按 key 分支」这个结构还在 —— 具体保多少由 `salvageRatio` 决定,
     * 那有 `pillCraftNumbers` 的用例。
     */
    expect(SRC, "找不到 spentOnFail —— 失败时的花费口径没了").toContain("spentOnFail:");
    expect(SRC, "spentOnFail 不再按 cost.key 分支 —— 灵草与灵石会被同等对待").toContain(
      'cost.key === "herb"',
    );
  });

  it("③ 双成夹在 0.8 —— 常量仍是 0.8,且上限函数真的夹了", () => {
    expect(ALCHEMY_BONUS_CAP, "双成上限不再是 0.8 —— 注释与文档都要一起复查").toBe(0.8);
    // 夹的动作必须在上限函数里,不能只在文档里写着
    expect(SRC, "找不到 alchemyBonusCapped —— 夹的动作不见了").toContain("alchemyBonusCapped");
    expect(SRC, "上限函数里没有 Math.min —— 加成再高也可能必双").toContain(
      "Math.min(ALCHEMY_BONUS_CAP",
    );
    /*
     * 地板也要有:注释里写着「引擎带 max(0,·) 地板:将来若出负产出 debuff,
     * 界面不许报出负双成」。少了这个 max,界面会显示负数。
     */
    expect(SRC, "上限函数里没有 Math.max —— 负加成时会报出负双成").toContain("Math.max(0,");
  });

  it("反空转:源码读得到,三条契约的关键 token 都在", () => {
    expect(SRC.length, "engineCraft.ts 读不到").toBeGreaterThan(1000);
    for (const token of ["ALCHEMY_BONUS_CAP", "spentOnFail", "blocked", "affordable"]) {
      expect(SRC.includes(token), `源码里找不到 ${token} —— 结构变了,这条判据要重写`).toBe(true);
    }
  });
});
