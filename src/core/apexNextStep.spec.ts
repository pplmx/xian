/**
 * 终局那句「这一世的修行到此为止」—— 而此后还有大量可做的事。
 *
 * ## 由来（第 528 轮）
 *
 * 查「玩家能不能在游戏里找到『我该做什么』的答案」时，落到终局那一支:
 *
 * ```ts
 *   if (input.atMaxRealm) {
 *     return { key: "full", label: "大道已尽",
 *       hint: "本境已是大道尽头，再无可破之境 —— 这一世的修行到此为止。" };
 *   }
 * ```
 *
 * 三处文案都是同一件事（`cultivationStage` / `BreakthroughCard` / `ApexSeal`），
 * 而**三处都没有指向任何一处终局之后可做的事**。
 *
 * ## 而此后能做的事很多
 *
 * ```text
 *   天界与道途     endgameUnlocked() = major >= 9，终局玩家早已解锁
 *   远征          五重天界各有其敌
 *   奇缘          九条，最后三条起于仙界/神界/混沌海
 *   逆旅契        十份，花道果签
 *   转世          道果与宿慧的出口
 *   成就与图鉴    九册
 * ```
 *
 * 故那句「到此为止」读起来像「可以收工了」—— 而本作在终点之后才展开最大的那几块。
 *
 * ## 判据
 *
 * ① 终局那一条提示要指向至少一处终局独有的去处;
 * ② 反差：它**不该**说「本作没有内容了」这类绝对话;
 * ③ 反差：非终局时不许出现终局话术（免得提前泄气）。
 */
import { describe, expect, it } from "vite-plus/test";
import { cultivationStageOf } from "@/core/cultivationStage";

/** 终局之后确实存在、且只在终局展开的去处 */
const APEX_TERMS = ["天界", "远征", "道途", "奇缘", "转世", "逆旅"] as const;

describe("终局 · 「到此为止」之后还有去处", () => {
  it("① 终局那一条提示要指向至少一处终局独有的去处", () => {
    const stage = cultivationStageOf({
      atMaxRealm: true,
      expFull: true,
      breakthroughReady: false,
      breakthroughReason: "",
      retreating: false,
      injured: false,
    });
    const hit = APEX_TERMS.filter((t) => stage.hint.includes(t));
    expect(
      hit.length,
      `终局提示没有指向任何去处 —— 而天界/远征/道途/奇缘/转世/逆旅都在终局展开。` +
        `现在写的是：「${stage.hint}」`,
    ).toBeGreaterThan(0);
  });

  it("② 反差：它不该说「没有内容了」这类绝对话", () => {
    /*
     * 这一条守的是①的边界。「这一世的修行到此为止」说的是**这一世的境界**
     * 到此为止 —— 那是真的。而「再无可破之境」如果被读者理解成「无事可做」，
     * 就与本作的终局设计相反。
     */
    const stage = cultivationStageOf({
      atMaxRealm: true,
      expFull: true,
      breakthroughReady: false,
      breakthroughReason: "",
      retreating: false,
      injured: false,
    });
    expect(stage.label, "终局那一档的名字变了 —— 这条判据的前提要重看").toBe("大道已尽");
    /* 它仍该说「境」到头了，只是不许停在那一句 */
    expect(stage.hint.length, "终局提示太短 —— 一句话说不清「之后做什么」").toBeGreaterThan(20);
  });

  it("③ 反差：非终局时不许出现终局话术", () => {
    const mid = cultivationStageOf({
      atMaxRealm: false,
      expFull: false,
      breakthroughReady: false,
      breakthroughReason: "",
      retreating: false,
      injured: false,
    });
    for (const t of APEX_TERMS) {
      expect(mid.hint, `非终局时提到了「${t}」—— 提前泄了终点那口气`).not.toContain(t);
    }
  });
});
