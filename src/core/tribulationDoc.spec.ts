/**
 * Phase 39 设计记录 · 历史口径冻结
 *
 * docs/superpowers/specs 里那一份记录写下了这一版的全部落点与两段界膜谶。
 * 文案最容易与代码脱节:回头把常数一改,记录就变成一份"曾经如此"的谎话,
 * 而没有任何地方会报错 —— 这类漂移在这个仓库里被反复踩过(见 singleSourceAudit)。
 *
 * Phase 40 又调了界外与渡劫曲线,但那一页仍是 2026-09-17 的历史记录,
 * 不能被今天的常数改写。故这里的“改动后”读数是冻结值;当前节奏由
 * progressionSim.spec / realPacing.spec 现算,两条账不能混。
 *
 * 「改动前」那一列不参与比对:它是当时的读数,冻结存档,本就不该随代码变化。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CULT_BASE_SPEED,
  EXP_MAJOR_GROWTH,
  INSTANT_EXP_LAYER_CAP,
  QI_BASE_REGEN,
  TRIB_DEF_RESIST_CAP,
  TRIB_DEF_RESIST_PER_SURPLUS,
  TRIB_HP_GUARD_CAP,
  TRIB_WAVE_BASE,
  TRIB_WAVE_MAJOR,
  TRIB_WAVE_STEP,
  TRIB_WORLD_STEP_STAT_FOLD,
  WORLD_STEP_EXP_MULT,
} from "@/data/constants";

const DOC = resolve(
  __dirname,
  "../../docs/superpowers/specs/2026-09-17-boundary-walls-phase39-design.md",
);
const doc = readFileSync(DOC, "utf8");

describe("Phase 39 记录 · 历史口径冻结", () => {
  it("两段界膜谶都在,且一古一今", () => {
    expect(doc, "改动前那一段(昔者)不见了").toContain("昔者道在眼前,今者道隔重渊");
    expect(doc, "改动后那一段(今者)不见了").toContain("壁已非壁,天已非天");
    expect(doc, "两段谶的定位说明不见了").toContain("## 一 两段谶:改动前后的世界");
  });

  it("落点表逐行对着 Phase 39 当时的常数", () => {
    const rows = [
      `| 基础修为/秒 | 1.6 | ${CULT_BASE_SPEED} |`,
      `| 基础灵气回复/秒 | 1.2 | ${QI_BASE_REGEN} |`,
      `| 修为需求/境(人间) | ×18 | ×${EXP_MAJOR_GROWTH} |`,
      "| 修为需求/境(界外) | ×4.4 | ×4.6 |",
      `| 界末圆满 | ×1.32(自然) | ×${WORLD_STEP_EXP_MULT}(加墙) |`,
      `| 天劫单波伤害 | 0.15 + 0.02×境界 + 0.03×第几道 | ${TRIB_WAVE_BASE} + ${TRIB_WAVE_MAJOR}×境界 + ${TRIB_WAVE_STEP}×第几道 |`,
      `| 三维折算率(防御/气血) | 每倍 5% | 每倍 ${Math.round(TRIB_DEF_RESIST_PER_SURPLUS * 100)}% |`,
      `| 三维折算上限(抗性 / 水位) | 30% / 60% | ${Math.round(TRIB_DEF_RESIST_CAP * 100)}% / ${Math.round(TRIB_HP_GUARD_CAP * 100)}% |`,
      `| 界膜那一劫的三维折算 | 照常吃 | 作废(${TRIB_WORLD_STEP_STAT_FOLD}) |`,
      `| 单枚修为丹的药力 | 当前一层需求的 7%~62% | 等效闭关时长,封顶不满一层(${INSTANT_EXP_LAYER_CAP}) |`,
    ];
    for (const row of rows) {
      expect(doc, `记录里的这一行与常数对不上:\n  ${row}`).toContain(row);
    }
  });

  it("里程碑留作 Phase 39 的历史读数,不再被 Phase 40 曲线改写", () => {
    for (const row of [
      "| 筑基 | 6.5 分 | 8.0 分 |",
      "| 金丹 | 26.8 分 | 34.4 分 |",
      "| 元婴 | 1.5 时 | 2.0 时 |",
      "| 化神 | 4.9 时 | 7.0 时 |",
      "| 炼虚 | 15.8 时 | 23.6 时 |",
      "| 合体 | 2.1 天 | 3.3 天 |",
      "| 大乘 | 6.8 天 | 11.4 天 |",
      "| 渡劫 | 22.1 天 | 38.9 天 |",
      "| 真仙 | 72.9 天 | 156.4 天 |",
      "| 混沌道祖 | 11671.1 天 | 34126.3 天 |",
    ]) {
      expect(doc, `Phase 39 的历史里程碑不见了:\n  ${row}`).toContain(row);
    }
  });
});
