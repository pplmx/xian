/* oxlint-disable no-console */
/**
 * Phase 31.0 S1:师承 —— 修行理念与行为叙事
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { mentorVerdict, mentorChoices } from "./mentorService";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { modOf } from "./statsCalc";

describe("师承(mentor)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("数据表完整:四种师承、各有词条与叙事", () => {
    const list = mentorChoices();
    expect(list.length).toBe(4);
    for (const m of list) {
      expect(m.mods).toBeTruthy();
      expect(m.narrative.aligned).toBeTruthy();
      expect(m.narrative.unaligned).toBeTruthy();
    }
  });

  it("师承词条并入最终属性(剑修 → 暴击/伤害加成)", () => {
    const player = usePlayerStore();
    player.adoptMentor("swordsman");
    const crit = modOf(player.finalStats.mods, "critRate");
    expect(crit).toBeGreaterThan(0.02);
  });

  it("师承一经确立不可更改", () => {
    const player = usePlayerStore();
    player.adoptMentor("swordsman");
    player.adoptMentor("alchemist");
    expect(player.mentor).toBe("swordsman");
  });

  it("叙事:行为对齐(大量击杀)→ 契合;未拜师 → 无评价", () => {
    const player = usePlayerStore();
    player.adoptMentor("swordsman");
    const quests = useQuestsStore();
    quests.inc("kills", 500);
    quests.inc("bossKills", 30);
    const verdict = mentorVerdict(player.mentor);
    expect(verdict).not.toBeNull();
    console.log(`[师承叙事] ${verdict!.line}`);
    expect(verdict!.affinity).toBeGreaterThan(0);
    expect(verdict!.line).toContain("剑");
  });

  it("未拜师时无评价", () => {
    expect(mentorVerdict(null)).toBeNull();
  });

  it("行为相左亦可判「未纯」:契合度为负,不再永远非负(未纯叙事可达)", () => {
    const player = usePlayerStore();
    player.adoptMentor("alchemist"); // 丹修
    const quests = useQuestsStore();
    quests.inc("kills", 600); // 却常年杀戮(相左)
    const verdict = mentorVerdict(player.mentor)!;
    expect(verdict.affinity).toBeLessThan(-0.2);
    expect(verdict.line, "应落入「未纯」叙事而非契合").toContain("丹炉");
  });

  it("契合度高者顺手做相左小事,不被拖离契合(饱和保护)", () => {
    const player = usePlayerStore();
    player.adoptMentor("swordsman");
    const quests = useQuestsStore();
    quests.inc("kills", 500);
    quests.inc("bossKills", 30);
    quests.inc("pillsCrafted", 200); // 顺手炼药,不推翻剑心
    const verdict = mentorVerdict(player.mentor)!;
    expect(verdict.affinity).toBeGreaterThan(0.2);
    expect(verdict.line).toContain("剑");
  });
});
