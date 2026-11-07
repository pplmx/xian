/**
 * 出行窗「敌势」的两个新字段 —— `dangerTotal` 与 `foeParts`。
 *
 * ## 它们解决什么
 *
 * 从前模式窗只报「敌势 ×2.1」这一个**笼统的乘数**:玩家不知道它从哪来,
 * 也不知道哪几项是自己能改的。选地卡上那行「此地之敌:层级补偿 ×1.25 ·
 * 地界凶险 ×1.05」的注释写着「出行方式与灵兽之性那一半在出行弹窗里摊开」——
 * 而弹窗此前只报了个总数,那一半从没摊开过。
 *
 * 现在:
 *   `dangerTotal` —— 实发总倍率(档位 × 灵兽之性 × 区域事件)
 *   `foeParts`    —— 档位之外那几项的文案(「凶兽之性 ×1.15 · 妖潮 ×1.3」)
 *
 * ## 判据守什么
 *
 * 1. **缺省回退**:不传这两个字段时,`dangerTotal` 必须是档位自己的倍率、
 *    `foeParts` 必须是空数组 —— 旧调用点(包括别的页面)行为不变。
 * 2. **两者不重复**:档位倍率不许出现在 `foeParts` 里。它已经在上一行
 *    「敌势 ×N」里报过一遍,再在下面写一次就是同一件事说两遍。
 * 3. **只有真扰动才列**:比例是 1 的项不列 —— 「灵兽之性 ×1」不是信息。
 */
import { describe, expect, it } from "vite-plus/test";
import { exploreModeRow } from "./exploreModeText";
import { exploreTripPlan } from "@/core/explorationPlan";
import { EXPLORE_MODES } from "@/data/constants";

/** 照搬 bagOverflow.spec 的构造口径,免得两处各写一份参数 */
const row = (over: Partial<Parameters<typeof exploreModeRow>[0]> = {}) =>
  exploreModeRow({
    plan: exploreTripPlan({ mode: "deep", petId: null, mods: {}, eventChance: 0.2 }),
    materialsPerBattle: 1.9,
    equipBattlesPerPiece: 3.2,
    pillBattlesPerPiece: 12.5,
    risk: "小险",
    bagFree: 50,
    ...over,
  });

describe("出行窗的敌势来源", () => {
  it("不传新字段时退回档位倍率,foeParts 为空(旧调用点行为不变)", () => {
    const r = row({});
    const modeMult = EXPLORE_MODES.deep.dangerMult;
    expect(r.dangerTotal, "缺省没退回档位倍率 —— 旧调用点读数会变").toBe(modeMult);
    expect(r.foeParts, "缺省时 foeParts 不是空数组").toEqual([]);
    expect(r.dangerMult, "档位自己的倍率被改掉了").toBe(modeMult);
  });

  it("dangerTotal 与 dangerMult 是两个不同的量,各自可读", () => {
    const r = row({ dangerTotal: 2.1 });
    expect(r.dangerTotal, "实发总数没被采用").toBe(2.1);
    expect(r.dangerMult, "dangerMult 被 dangerTotal 覆盖了 —— 档位倍率与实发总数必须分开报").toBe(
      EXPLORE_MODES.deep.dangerMult,
    );
  });

  it("foeParts 原样透传(它们已经摊好文案)", () => {
    const parts = ["凶兽之性 ×1.15", "妖潮 ×1.3"];
    const r = row({ foeParts: parts, dangerTotal: 2.1 });
    expect(r.foeParts).toEqual(parts);
  });
});
