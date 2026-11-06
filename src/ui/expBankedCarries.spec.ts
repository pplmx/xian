/**
 * 「积余……突破时随境界带走,不白攒」—— 这句承诺要有判据守着。
 *
 * ## 现状
 *
 * 修行页的「积余」行写着:
 *
 * ```text
 * 积余  越过本境需求的部分;突破时随境界带走,不白攒
 * ```
 *
 * 实现是对的,而且 `advanceRealm` 里有注释把同一件事又说了一遍:
 *
 * ```ts
 * // 先记下「刚走完的这一境」的需求:突破只该扣这一份,积余随境界带走
 * const spent = expReq.value;
 * ...
 * exp.value = subClamp(exp.value, spent);
 * ```
 *
 * ## 为什么需要判据
 *
 * 这句话是**玩家会据此调整行为**的那种承诺:修为超出本境之后还要不要继续攒?
 * 信了这句就继续攒,不信就停手等突破。一旦哪天突破改成「清零」(一个很自然的
 * 「归一化」写法),玩家白攒的每一次都是一次被欺骗。
 *
 * 而眼下它只活在两句文案与一段注释里 —— 三者说的是一件事,却没一个在验证。
 * 「不改写历练里的战斗」那一处刚补过同类判据:文案有判据、实现没有,是最容易
 * 被一次「看起来更一致」的重构踩空的地方。
 *
 * ## 判据守什么
 *
 * 一条:突破推进境界时,修为按**本境需求**扣(不是清零、不是按新境需求扣)。
 *
 * 这是行为判据 —— 直接搭 store 调 `advanceRealm` 看结果,不读源码猜。
 *
 * 放在 `ui/` 而不是 `core/`:它要搭 Pinia。`core/layeringAudit` 守着「core 用例需要
 * Pinia 的文件数只许减」,第一版放进 core 时当场红了(109 → 110)。这条纪律本身就是对的:
 * core 应当只有纯逻辑,读 state → 算 → 写 state 的编排归 store 或边缘。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore } from "@/stores/player";
import { gn } from "@/utils/gnum";
import { toNum } from "@/utils/gnum";

describe("积余 · 突破时随境界带走", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("修为超过本境需求时,突破只扣本境那一份", () => {
    const player = usePlayerStore();
    // 攒到「本境需求的 2.5 倍」:若按清零写,这里会归零;若按新境需求扣,会不够扣而清零
    const req = player.expReq;
    const extra = 1.5;
    player.exp = gn(toNum(req) * (1 + extra));
    const before = toNum(player.exp);

    player.advanceRealm();

    const after = toNum(player.exp);
    // 扣掉的应当恰好是「突破前那一境的需求」,积余部分留着
    const spent = before - after;
    expect(spent, "突破该扣掉本境那一份需求").toBeCloseTo(
      toNum(req),
      Math.max(0, Math.log10(toNum(req)) - 8),
    );
    expect(after, "积余被清零了 —— 那句「不白攒」就成了假话").toBeGreaterThan(0);
  });

  it("修为刚好够本境需求时,突破后归零(不多也不少)", () => {
    const player = usePlayerStore();
    player.exp = gn(toNum(player.expReq));
    player.advanceRealm();
    expect(toNum(player.exp), "刚好够时应归零").toBeLessThan(toNum(player.expReq) * 0.001);
  });

  it("反空转:advanceRealm 真的推进了境界", () => {
    const player = usePlayerStore();
    const major0 = player.major;
    const sub0 = player.sub;
    player.exp = gn(toNum(player.expReq));
    player.advanceRealm();
    expect(player.major * 100 + player.sub, "境界没动 —— 判据会空转").toBeGreaterThan(
      major0 * 100 + sub0,
    );
  });
});
