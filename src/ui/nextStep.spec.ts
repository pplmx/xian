/**
 * 此刻最该做的一件事 —— 只吐一条。
 *
 * 判据七组:
 *   一 只吐一条:九种状态任意组合,输出都是一条或 null;
 *   二 优先级:卡住的排在"做了更好"之前 —— 逐条核那个顺序;
 *   三 不重复:指向本页的那句不在本页说;
 *   四 一条都不成立时闭嘴 —— 不说废话;
 *   五 措辞是「去哪」不是「是什么」;
 *   六 纯函数:不 import 任何 store,可直接测;
 *   七 真接线:卷首眉批位置读它。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { nextStepForPage, nextStepOf, type NextStepInput } from "./nextStep";

const base: NextStepInput = {
  major: 3,
  expFull: false,
  breakthroughReady: false,
  breakthroughReason: "",
  exploring: false,
  pendingEvent: false,
  dongfuAffordable: false,
  betterEquipAvailable: false,
  artifactSeatOpen: false,
  rewardReady: false,
  endgameReached: false,
};

const withX = (patch: Partial<NextStepInput>): NextStepInput => ({ ...base, ...patch });

describe("此刻最该做的一件事 · 优先级", () => {
  it("挂着的际遇最先 —— 它挡着历练往前走", () => {
    const step = nextStepOf(withX({ pendingEvent: true, expFull: true, breakthroughReady: true }));
    expect(step?.id).toBe("event");
    expect(step?.route).toBe("adventure");
  });

  it("正在历练排第二 —— 这一程没了结,别的都靠后", () => {
    const step = nextStepOf(withX({ exploring: true, expFull: true, breakthroughReady: true }));
    expect(step?.id).toBe("explore");
  });

  it("破境条件齐排在终点之前", () => {
    const step = nextStepOf(
      withX({ expFull: true, breakthroughReady: true, endgameReached: true }),
    );
    expect(step?.id).toBe("breakthrough");
  });

  it("终点已至排在未领的赏之前 —— 该谋来世,不是继续攒", () => {
    const step = nextStepOf(withX({ endgameReached: true, rewardReady: true }));
    expect(step?.id).toBe("endgame");
    expect(step?.route).toBe("legacy");
  });

  it("未领的赏排在洞府收账之前", () => {
    const step = nextStepOf(withX({ rewardReady: true, dongfuAffordable: true }));
    expect(step?.id).toBe("reward");
  });

  it("洞府收账排在法宝空位之前", () => {
    const step = nextStepOf(withX({ dongfuAffordable: true, artifactSeatOpen: true }));
    expect(step?.id).toBe("dongfu");
  });

  it("法宝空位排在更好的装备之前", () => {
    const step = nextStepOf(withX({ artifactSeatOpen: true, betterEquipAvailable: true }));
    expect(step?.id).toBe("artifact");
  });

  it("修为满了但条件未齐 —— 说清缺哪一关", () => {
    const step = nextStepOf(withX({ expFull: true, breakthroughReason: "筑基丹" }));
    expect(step?.id).toBe("gate");
    expect(step?.text).toContain("筑基丹");
  });
});

describe("此刻最该做的一件事 · 只吐一条", () => {
  it("九项全开时也只有一条", () => {
    const step = nextStepOf({
      major: 9,
      expFull: true,
      breakthroughReady: true,
      breakthroughReason: "某关",
      exploring: true,
      pendingEvent: true,
      dongfuAffordable: true,
      betterEquipAvailable: true,
      artifactSeatOpen: true,
      rewardReady: true,
      endgameReached: true,
    });
    expect(step).not.toBeNull();
    // 输出是一个对象,不是数组 —— 结构上就决定了只有一条
    expect(Array.isArray(step)).toBe(false);
  });

  it("一条都不成立时闭嘴 —— 不说废话", () => {
    expect(nextStepOf(base)).toBeNull();
  });

  it("修为满了但 reason 是空的,也不硬凑一句", () => {
    expect(nextStepOf(withX({ expFull: true, breakthroughReason: "  " }))).toBeNull();
  });
});

describe("此刻最该做的一件事 · 不在本页说", () => {
  it("指向本页的那句被滤掉 —— 玩家已经站在那儿了", () => {
    const step = nextStepOf(withX({ dongfuAffordable: true }));
    expect(step?.route).toBe("dongfu");
    expect(nextStepForPage(step, "dongfu")).toBeNull();
    expect(nextStepForPage(step, "adventure")).toEqual(step);
  });

  it("null 进 null 出", () => {
    expect(nextStepForPage(null, "adventure")).toBeNull();
  });
});

describe("此刻最该做的一件事 · 措辞", () => {
  it("每一条都指向一个去处,没有一条是纯形容词", () => {
    const inputs: NextStepInput[] = [
      withX({ pendingEvent: true }),
      withX({ exploring: true }),
      withX({ expFull: true, breakthroughReady: true }),
      withX({ endgameReached: true }),
      withX({ rewardReady: true }),
      withX({ dongfuAffordable: true }),
      withX({ artifactSeatOpen: true }),
      withX({ betterEquipAvailable: true }),
      withX({ expFull: true, breakthroughReason: "某关" }),
    ];
    for (const input of inputs) {
      const step = nextStepOf(input)!;
      expect(step, "每一种状态都该给出建议").not.toBeNull();
      expect(step.text.length, `「${step.text}」太长了`).toBeLessThanOrEqual(20);
      expect(step.text.trim()).toBe(step.text);
      // 去处在路由枚举里
      expect(["cultivation", "adventure", "dongfu", "inventory", "legacy", "collection"]).toContain(
        step.route,
      );
    }
  });
});

describe("此刻最该做的一件事 · 纯函数", () => {
  it("不 import 任何 store —— 规则可直接测", () => {
    const src = readSource("src/ui/nextStep.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "不该够到 store").not.toMatch(/from ["']@\/stores\//);
    expect(src, "不该够到 core").not.toMatch(/from ["']@\/core\//);
  });
});

describe("此刻最该做的一件事 · 真接线", () => {
  it("卷首有一处稳定的落点", () => {
    const header = readSource("src/components/common/FolioPageHeader.vue");
    expect(header, "卷首要能接这句话").toContain("data-folio-next-step");
  });

  it("那句话由真实状态推出来,不在模板里手写", () => {
    // 卷首只读一个 computed;取数与「不在本页说」的判定都在 ui/useNextStep 里
    const header = readSource("src/components/common/FolioPageHeader.vue");
    expect(header, "卷首读共享判定").toContain("useNextStep(");
    // 去注释再查:模板里有条注释正当解释着「这一句说的是眼下该去哪」
    const headerCode = header
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\//gm, "");
    expect(headerCode, "模板里不许手写建议文案").not.toMatch(/该去|先走完|可去破境/);
    const hook = readSource("src/ui/useNextStep.ts");
    expect(hook, "不在本页说的判定要走共享函数").toContain("nextStepForPage(");
  });
});
