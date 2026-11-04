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
  it("每一条都用这本书自己的话说 —— 不是通知体", () => {
    /*
     * 初版是通知体:「有一桩际遇正等你决断」「洞府有可收的一笔」——
     * 意思没错,但那是系统在播报,不是这本书在跟你说话。
     * 这一条把八句的最终措辞钉住:改文案时若退回通知体,判据会红。
     */
    const EXPECTED: Record<string, string> = {
      event: "一桩际遇候你决断",
      explore: "此程未完,且先走完",
      breakthrough: "关隘已开,可去破境",
      endgame: "此生道途已定,可谋来世",
      reward: "有赏未领",
      dongfu: "洞府有可收的一笔",
      artifact: "法宝有位,尚缺一件上阵",
      equip: "行囊里有未上阵的一件",
      gate: "修为已满,还需过「某关」",
    };
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
      expect(step.text, `${step.id} 的文案变了`).toBe(EXPECTED[step.id]);
    }
  });

  it("没有一句带通知体的虚字 —— 「正」「已经」「手里还有」", () => {
    /*
     * 这一条不是文风洁癖:虚字会把一句话撑长,而这句话要在一行之内容下。
     * 磨掉的正是那些能磨的字 —— 意思一个不少,字少了四处。
     */
    const BANNED = ["正等", "已经", "手里还有", "尚未了结", "可进行", "请注意"];
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
      for (const word of BANNED) {
        expect(step.text, `「${step.text}」里还留着通知体的「${word}」`).not.toContain(word);
      }
    }
  });

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
      // 一行之内说得完:眉批与副题同段,长一句就会把下面挤走
      expect(step.text.length, `「${step.text}」太长了`).toBeLessThanOrEqual(14);
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
  it("那行字可以点 —— 它说「该去哪」,就真的能去", () => {
    /*
     * 初版它只是 `<p>`:写着「关隘已开,可去破境」而不能点。
     * 一句话指出去处却不给路,等于让玩家自己去导航里找 —— 那是把成本推回给他。
     * 这一条钉住:那行字是一枚可点的控件,且去向取自同一份 nextStep.route。
     */
    /*
     * 去注释再取块:上面那条注释正当解释着「眉批:此刻最该做的一件事」,
     * 而它排在 <button> 之前 —— 不去注释,切出来的是注释里的那几个字。
     * 本仓这类误伤已出现六次,一律先去注释。
     */
    const header = readSource("src/components/common/FolioPageHeader.vue")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const at = header.indexOf("data-folio-next-step");
    expect(at, "眉批那枚控件不见了").toBeGreaterThan(0);
    /*
     * 从**标签开头**切:`data-folio-next-step` 在属性区,而它是 <button> 还是 <p>
     * 写在标签名上、位于切点之前。向前退到最近的 `<`。
     */
    const tagStart = header.lastIndexOf("<", at);
    const block = header.slice(tagStart, at + 900);
    expect(block, "该是一枚按钮").toMatch(/<(button|a)\b/);
    expect(block, "点击要真的跳").toContain("@click");
    expect(block, "去向取自同一份判定").toContain("nextStep.route");
  });

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
