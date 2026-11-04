/**
 * 战利品里的器灵尘 —— 自动折算掉的那件装备,玩家该看见它变成了什么。
 *
 * ## 缺口:「本次所得」只报两样,而实际进账有三样
 *
 * 历练面板上那一行写着「本次所得 · 灵石 +X · 修为 +Y」。
 * 而一场战斗真正会进账的还有**器灵尘**:行囊满、或智能留取判定把某件判为
 * 不值留时,`acquireEquipment` 会把它折成器灵尘(+ 退灵石),并当场
 * `resources.addSmall("dust", …)` —— 尘是真的进了账,玩家在行囊里看得到。
 *
 * 但这条数**从来不进会话账目**:`AdventureSession` 有 `stoneGain` / `expGain` /
 * `itemGain` / `wudaoGain`,没有 `dustGain`;`afterWin` 的 `DropSummary` 也没有这一栏。
 * 于是「本次所得」少报一样,而少报的恰恰是**玩家自己没看见就已经没了**的那部分 ——
 * 一件被自动折算的装备,唯一能知道它变成了什么的地方就是这一行。
 *
 * 同一份文件里 `wudaoGain` 的注释已经把这条纪律写死了:
 *
 *   > 本场累计所得悟道点(连胜档赏 + 际遇所给 + 重复法宝折化)
 *   > —— 结束总结要报,不能只活在账本里
 *
 * 器灵尘是同一个道理,只是当初漏了。
 *
 * ## 做法:一路加到界面,同一份数
 *
 *   acquireEquipment 的 dust(已有)
 *     → afterWin 累加成 DropSummary.dust
 *     → exploration 的会话 dustGain
 *     → CombatPanel「本次所得」第三格
 *
 * 每一跳都取上一跳的数,不另算 —— 与 stone 那条链同一条纪律
 * (那里的注释写着「本次真正入账的灵石 —— 与上面 addStone 的同一份数,
 * 不是另一处另算的期望值」)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("器灵尘进账 · 数据链", () => {
  it("DropSummary 报得出这一次折算得的尘", () => {
    const src = readSource("src/core/loot.ts");
    const at = src.indexOf("export interface DropSummary");
    expect(at, "DropSummary 要还在").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("}", at) + 1);
    expect(block, "DropSummary 要加尘这一栏").toMatch(/dust:\s*number/);
  });

  it("afterWin 真的把 acquireEquipment 的尘累加进去 —— 不是只加字段不填", () => {
    const src = readSource("src/core/loot.ts");
    // 装备那一条必须把 acquired 的 dust 收下来
    expect(src, "装备掉落那一支要接住 acquireEquipment 的返回值").toMatch(
      /const acquired = acquireEquipment\(inst\)/,
    );
    expect(src, "尘要累加进汇总").toMatch(/dustGain|dust \+=|\bdust\b\s*\+/);
    // 汇总返回值里带上它
    expect(src).toMatch(/return \{[^}]*dust[^}]*\}/);
  });

  it("会话账目有 dustGain —— 与悟道点同一条「不能只活在账本里」", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface AdventureSession");
    const block = types.slice(at, types.indexOf("}", at) + 1);
    expect(block, "会话要记这一场的尘").toMatch(/dustGain:\s*number/);
  });

  it("exploration 把 drops.dust 累加进会话,不自己另算一份", () => {
    const src = readSource("src/core/exploration.ts");
    expect(src).toMatch(/dustGain:\s*s\.dustGain \+ drops\.dust/);
  });

  it("战报「本次所得」报得出这三样", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "要读会话的尘").toMatch(/dustGain/);
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-combat-dust");
  });

  it("反空转:会话初值里也给了这一栏", () => {
    const src = readSource("src/core/exploration.ts");
    expect(src).toMatch(/dustGain:\s*0/);
  });
});
