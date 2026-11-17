/**
 * 逆旅契「禁丹药」的消费侧行为。
 *
 * ## 为什么这条在 ui/ 而不在 core/
 *
 * 它要 store（签契状态存在 `player.reincarnation.trial`）。
 * `layeringAudit` 的 `CORE_PINIA_SPECS = 119` 是**只许减**的硬上限，
 * 故这类「接线后的行为」放 ui/ 层。
 *
 * core 侧那一份（`pillBanWiring.spec`）只扫源码，验的是「两档都有调用方」。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { lifeTrialBansItem } from "@/core/lifeTrialService";

describe("逆旅契禁丹药 · 消费侧", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("① 未立契时两档都不禁", () => {
    expect(lifeTrialBansItem("artifact"), "没签契却禁了法宝").toBe(false);
    expect(lifeTrialBansItem("pill"), "没签契却禁了丹药").toBe(false);
  });

  it("② 签下断粮契之后，丹药被禁，而法宝不受影响", () => {
    const player = usePlayerStore();
    player.reincarnation.trial = { trialId: "tr_duanliang", at: Date.now(), paid: 36 };
    expect(lifeTrialBansItem("pill"), "签了断粮契，丹药却没被禁").toBe(true);
    expect(lifeTrialBansItem("artifact"), "断粮契顺手把法宝也禁了").toBe(false);
  });

  it("③ 签下弃器契之后，法宝被禁，而丹药不受影响", () => {
    const player = usePlayerStore();
    player.reincarnation.trial = { trialId: "tr_qiqi", at: Date.now(), paid: 30 };
    expect(lifeTrialBansItem("artifact"), "签了弃器契，法宝却没被禁").toBe(true);
    expect(lifeTrialBansItem("pill"), "弃器契顺手把丹药也禁了").toBe(false);
  });
});
