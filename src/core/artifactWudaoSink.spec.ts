/**
 * 界外悟道点的第二个出口 —— 法宝炼化，量出来是功法进修的十倍量级
 *
 * ## 这一处是仓库自己声明过的缺口
 *
 * `core/economySim` 在界外那一格的 `note` 里写着:
 *
 * ```text
 *   界外出口待补法宝炼化(功法进修已计入)—— 悟道点这一格偏低
 * ```
 *
 * 第 883b3706 次提交把它改准过一次（从前写「功法进修 / 法宝炼化未入模型」，
 * 而功法进修一直算着），但**法宝炼化确实还没进模型** —— 那句是真的。
 *
 * ## 而它有多大:量出来比功法进修大一个量级
 *
 * ```text
 *   一件法宝练到 9 重（ARTIFACT_MAX_LEVEL）
 *     rank0（凡品）   ≈ 160 悟道点
 *     rank5（天品）   ≈ 398 悟道点
 *   一期功法进修（GONGFA_UPS_PER_ERA = 6 次）  ≈ 24 悟道点
 * ```
 *
 * 也就是说:**法宝炼化是界外悟道点最大的那个出口，而它整个不在模型里。**
 * 模型因此把 m19/m20 的悟道点判成「瓶颈」(ratio 0.56~0.58) —— 那个读数
 * 把"有出口没算"当成了"出口不足"。
 *
 * ## 这一轮做什么
 *
 * 把法宝炼化计进 `wudaoSinkEra`，并把那条 `note` 销掉 —— 它已经不再是缺口。
 * 判据守两件事:
 *
 * 一 模型里真有法宝炼化那一项（按 `artifactUpCost` 的公式，不手抄系数）
 * 二 界外那一格不再挂「待补」的附注 —— 销账，否则下一个人还会以为它没算
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ARTIFACT_MAX_LEVEL, ARTIFACT_UP_WUDAO_BASE } from "@/data/artifacts";
import { qualityDef } from "@/data/qualities";
import { auditEra } from "./economySim";
import { WORLD_BREAK_MAJOR } from "@/data/realms";

const SRC = readSource("src/core/economySim.ts");

describe("界外悟道点 · 法宝炼化那个出口", () => {
  it("模型里有法宝炼化那一项，且系数取自 artifactUpCost 的同一来源", () => {
    /*
     * 判据不钉"数字等于多少"（那会随平衡调整变），只钉**它被算了**:
     * 源码里要有以 `ARTIFACT_UP_WUDAO_BASE` 为核心的炼化项，并计入 wudao 的 sink。
     */
    expect(SRC, "economySim 没有引用 ARTIFACT_UP_WUDAO_BASE —— 法宝炼化没进模型").toContain(
      "ARTIFACT_UP_WUDAO_BASE",
    );
    expect(SRC, "法宝炼化那一项没有并进 wudao 的 sink").toMatch(
      /wudaoSinkEra\s*=[\s\S]{0,400}(artifactWudao|ARTIFACT_UP_WUDAO_BASE)/,
    );
  });

  it("「待补」的附注已经销账 —— 缺口补齐了就该把话收回", () => {
    /*
     * 这条与 `deadExportAudit` 的「豁免不常驻」同一条纪律:
     * 一张写着"这里还缺东西"的牌子，补上之后必须摘掉 —— 否则下一个人会照着它
     * 再查一遍（第 883b3706 次提交正是为这件事改的）。
     *
     * 判据看的是**运行时的 note 还挂不挂**，而不是源码里还提不提这四个字 ——
     * 那四个字现在活在注释的**来历**里（"原本挂着…本轮摘掉"），那是应该留的记录，
     * 不是招牌。第一版判据写成 `not.toContain`，把它自己的历史说明也判成了违规。
     */
    const f = auditEra(WORLD_BREAK_MAJOR).flows.find((x) => x.resource === "wudao");
    expect(f, "界外第一格的 wudao 读数不见了").toBeTruthy();
    expect(
      f!.note,
      "界外悟道点仍挂着「模型没把握」的附注 —— 而那条出口已经算进去了",
    ).toBeUndefined();
  });

  it("炼化量级确实比功法进修大 —— 这就是为什么要算它", () => {
    /*
     * 这一条是"值得算"的依据，不是实现细节。若哪天炼化变便宜了（或进修变贵了），
     * 它会让这条判断重新被审视 —— 而那时 note 的措辞也该跟着改。
     */
    const oneArtifactToMax = (rank: number): number => {
      let sum = 0;
      for (let lv = 0; lv < ARTIFACT_MAX_LEVEL; lv += 1) {
        sum += Math.ceil(ARTIFACT_UP_WUDAO_BASE * Math.pow(1.6, lv) * (1 + rank * 0.3));
      }
      return sum;
    };
    // 天品（rank 5）一件练满的总量
    const heavenly = oneArtifactToMax(qualityDef("heaven").rank);
    expect(heavenly, "天品法宝练满的悟道点消耗应当上百").toBeGreaterThan(100);
  });

  it("计入之后，界外的悟道点读数不再是「有出口没算」", () => {
    /*
     * 收尾那一条:界外每一格的 wudao 都不该再挂 note（缺口已补）。
     * 内界本来就没有 note，故这一条对全表都成立。
     */
    for (let m = 0; m <= 20; m += 1) {
      const row = auditEra(m).flows.find((f) => f.resource === "wudao");
      if (!row) continue;
      expect(row.note, `第 ${m} 境的悟道点仍挂着「模型没把握」的附注:${row.note}`).toBeUndefined();
    }
  });
});
