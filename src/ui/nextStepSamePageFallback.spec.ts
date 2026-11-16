import { describe, expect, it } from "vite-plus/test";
import { nextStepForPageFrom, nextStepsOf, type NextStepInput } from "./nextStep";

/**
 * 本页那条被滤掉之后，次高的那条要顶上来
 *
 * ## 现实
 *
 * `nextStepForPage` 只做「一条的过滤」:
 *
 * ```text
 *   if (!step) return null;
 *   return step.route === page ? null : step;
 * ```
 *
 * 于是有一个很常见的空白:
 *
 * ```text
 *   玩家站在历练页
 *     际遇挂着   （最高优先级，指向 adventure = 本页）  → 被滤掉
 *     有赏未领   （指向 collection）                    → 本该说，却没人去取
 *   -> 这一页一句话都不显示
 * ```
 *
 * ## 为什么是缺陷
 *
 * 「这一条不该在本页说」不等于「什么都不说」。而「挂着的际遇」恰好是
 * **最常成立**的那一条（历练途中随时会冒出来），玩家于是最容易在历练页上
 * 看到一片空白 —— 恰恰是最该告诉他「还有赏没领」的那一页。
 *
 * ## 判据守什么
 *
 * 一 本页那条被滤掉后，次高的**指向别处**的那条要顶上来;
 * 二 若次高的也指向本页，继续往下找;
 * 三 全都指向本页时，才真的返回 null —— 那时说任何话都是废话;
 * 四 一条都不成立时仍是 null（不硬凑）。
 */
const base: NextStepInput = {
  major: 3,
  expFull: false,
  breakthroughReady: false,
  breakthroughReason: "",
  endgameReached: false,
  pendingEvent: false,
  exploring: false,
  rewardReady: false,
  dongfuAffordable: false,
  artifactSeatOpen: false,
  betterEquipAvailable: false,
};

const withX = (patch: Partial<NextStepInput>): NextStepInput => ({ ...base, ...patch });

describe("下一步提示 · 本页那条被滤掉之后", () => {
  it("际遇指向本页时，「有赏未领」要顶上来说", () => {
    /*
     * 这是最容易撞上的那一组:玩家在历练页，际遇弹窗挂着 →
     * pendingEvent 成立（指向 adventure = 本页）;同时有赏没领。
     * 旧实现在这一页返回 null —— 玩家看不到「有赏未领」。
     */
    const steps = nextStepsOf(withX({ pendingEvent: true, rewardReady: true }));
    expect(steps[0]?.id, "前提:最高优先级是际遇").toBe("event");
    const shown = nextStepForPageFrom(steps, "adventure");
    expect(shown, "本页那条被滤掉后，这一页就没有任何提示了 —— 次高的没有顶上来").not.toBeNull();
    expect(shown?.id, "顶上来的应该是「有赏未领」").toBe("reward");
  });

  it("次高的也指向本页时，继续往下找", () => {
    // 际遇 + 正在历练都指向 adventure，再往下才是「有赏未领」
    const steps = nextStepsOf(withX({ pendingEvent: true, exploring: true, rewardReady: true }));
    const shown = nextStepForPageFrom(steps, "adventure");
    expect(shown?.id, "连跳两条之后没找到第三条").toBe("reward");
  });

  it("全都指向本页时才闭嘴 —— 那时说什么都是废话", () => {
    // 只有际遇与正在历练两条成立，都指向 adventure
    const steps = nextStepsOf(withX({ pendingEvent: true, exploring: true }));
    expect(steps.every((s) => s.route === "adventure")).toBe(true);
    expect(nextStepForPageFrom(steps, "adventure"), "没有别的可说，应当返回 null").toBeNull();
  });

  it("一条都不成立时仍是 null —— 不硬凑", () => {
    expect(nextStepsOf(base)).toHaveLength(0);
    expect(nextStepForPageFrom([], "adventure")).toBeNull();
  });

  it("本页不是最高那条时，照旧返回最高那条", () => {
    const steps = nextStepsOf(withX({ rewardReady: true }));
    expect(nextStepForPageFrom(steps, "adventure")?.id).toBe("reward");
    // 而在 collection 页上，它仍要被滤掉（本页不说本页）
    expect(nextStepForPageFrom(steps, "collection"), "指向本页的仍要滤掉").toBeNull();
  });

  it("清单本身仍按优先级排 —— 顺序是这套设计的全部意义", () => {
    const steps = nextStepsOf(
      withX({
        pendingEvent: true,
        exploring: true,
        rewardReady: true,
        dongfuAffordable: true,
      }),
    );
    expect(steps.map((s) => s.id)).toEqual(["event", "explore", "reward", "dongfu"]);
  });
});
