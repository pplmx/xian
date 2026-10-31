/**
 * 际遇帖 —— 抉择前把门限、代价与可能去向摊开，结算后把这一择的实得收成一张账。
 *
 * 旧弹窗只有事件正文与一串按钮：多分支选项只报一个总花费，玩家不知道四成是丹药、
 * 三成是器物、两成会白花钱；境界门槛被置灰时也只留一句「不可选」。
 * 这里守两件事：
 *   一 去向概率与效果都从 EventChoice 的 weight / effects 现算，不另写一张表；
 *   二 组件确实消费同一份判据，并把不可选原因、默认项与断缘代价露到按钮上。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { eventDef } from "@/data/events";
import { stoneByTier } from "@/core/formulas";
import { choiceAvailable, choiceUnavailableReason } from "@/core/eventEngine";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { formatGN } from "@/utils/format";
import { gn } from "@/utils/gnum";
import { choiceOutcomeForecasts } from "./eventText";

const source = (path: string): string => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("际遇帖 · 去向账", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("多分支选项按引擎权重摊开概率与实得类别", () => {
    const buy = eventDef("ev_merchant")!.choices[0]!;
    const rows = choiceOutcomeForecasts(buy, 3);

    expect(rows.map((row) => row.chance)).toEqual(["40%", "35%", "25%"]);
    expect(rows[0]?.text).toContain("丹药");
    expect(rows[0]?.text).toContain(`灵石 -${formatGN(stoneByTier(3, 30))}`);
    expect(rows[1]?.text).toContain("器物");
    expect(rows[2]?.tone).toBe("risk");
    expect(rows[2]?.text).toContain("灵石");
  });

  it("单分支不冒充概率，只报确定去向", () => {
    const leave = eventDef("ev_merchant")!.choices[1]!;
    expect(choiceOutcomeForecasts(leave, 3)).toEqual([
      { chance: "", text: "无事发生", tone: "neutral" },
    ]);
  });

  it("不可选原因与 choiceAvailable 同源：石头报缺口，境界报差几境", () => {
    const resources = useResourcesStore();
    const player = usePlayerStore();
    const merchant = eventDef("ev_merchant")!;
    const buy = merchant.choices[0]!;
    const need = stoneByTier(3, 30);

    resources.spiritStone = gn(0);
    expect(choiceAvailable(buy, 3)).toBe(false);
    expect(choiceUnavailableReason(buy, 3)).toBe(`尚差 ${formatGN(need)} 石`);

    resources.addStone(gn(need));
    expect(choiceAvailable(buy, 3)).toBe(true);
    expect(choiceUnavailableReason(buy, 3)).toBeNull();

    const realmLocked = eventDef("ev_guyuexi_bu")!.choices[0]!;
    player.major = 14;
    expect(choiceAvailable(realmLocked, 16)).toBe(false);
    expect(choiceUnavailableReason(realmLocked, 16)).toContain("神王");
    expect(choiceUnavailableReason(realmLocked, 16)).toContain("尚差 2 境");
  });
});

describe("际遇帖 · 接线", () => {
  it("抉择前把档位、概率、门限、默认项、断缘与去向都放进同一帖", () => {
    const dialog = source("components/adventure/EventDialog.vue");
    expect(dialog).toContain("data-event-slip");
    expect(dialog).toContain("data-event-choice");
    expect(dialog).toContain("choiceOutcomeForecasts");
    expect(dialog).toContain("choiceUnavailableReason");
    expect(dialog).toContain("choice.endsChain");
    expect(dialog).toContain("choice.isDefault");
    expect(dialog).toContain("event-slip__forecast");
  });

  it("结算后报出这一择，把焦点交给结果卷，并保留逐行实得", () => {
    const dialog = source("components/adventure/EventDialog.vue");
    expect(dialog).toContain("chosenChoiceLabel");
    expect(dialog).toContain('ref="resultSlip"');
    expect(dialog).toContain("resultSlip.value?.focus()");
    expect(dialog).toContain("data-event-result");
    expect(dialog).toContain('class="stagger-in');
  });

  it("手机单列、极窄档不靠横向留白撑版面", () => {
    const css = source("styles/pages/adventure.css");
    expect(css).toMatch(/\.event-slip\s*\{/);
    expect(css).toMatch(/\.event-choice\s*\{/);
    expect(css).toMatch(/\.event-slip__forecast\s*\{/);
    expect(css).toMatch(
      /@media \(max-width: 220px\) \{[\s\S]*?\.event-slip__head[\s\S]*?\.event-choice \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
    );
  });
});
