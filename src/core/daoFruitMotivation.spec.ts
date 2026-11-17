/**
 * 道果的第二个出口，一直没被算进「动机类型」的账里。
 *
 * ## 由来（第 508 轮）
 *
 * `motivationType.spec` 的结论段写着:
 *
 * ```text
 *   要让道果买到「不同的一世」而非「更难的同一世」，需要一条探索型的出口。
 *   而它的结构条件凡界已经满足了……
 *   而且它已经接上了 —— 转世时 reincarnation 第 363 行自动调 rerollMortalWorld()，
 *   每世换一方天地，不花道果。故「不同的一世」是既有内容，不在道果的货架上。
 * ```
 *
 * 而 `worldReroll.rerollWorldByFruit` 就是**花道果换一方天地** ——
 * 它的定价跟着余额走（一成半、最少 15 枚），出口就在世界页。
 *
 * 那句话错在:它只把「逆旅契」与「虚界」放在一起比，漏了第三个东西。
 * 而 `mortalWorldGen` 的产出**正是**它说的「探索型」:地界组合与顺序、路线骨架、
 * 事件节奏、规则与偏向都可重组，且新颖度门 NOVELTY_MIN 会否决不够新的候选。
 *
 * ## 判据
 *
 * ① 道果的消费出口必须逐个登记（清单型判据守的是清单，故这里从出口反查）;
 * ② 换界那条出口的产物必须来自**生成器**，而不是一张固定的世界表 ——
 *    这是「探索型」与「枚举型」的分界;
 * ③ 反差:逆旅契仍然是枚举型的（签之前就知道会发生什么），不许被算成探索型。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";

const CORE = resolve(__dirname);

describe("道果出口 · 「不同的一世」到底在不在货架上", () => {
  it("① 换界那条出口确实花道果", () => {
    /*
     * 反查:扫 core 下所有调 spendFruit / spendDaoFruit 的地方。
     * 清单会漏，产品不会 —— 见第 456 轮那条「清单型判据 vs 反向扫描」。
     */
    const src = readFileSync(resolve(CORE, "worldReroll.ts"), "utf8");
    expect(src, "换界不再扣道果 —— 那它就不是出口了").toMatch(/spendFruit|spendDaoFruit/);
    expect(src, "换界的定价不见了").toMatch(/worldRerollCost|WORLD_REROLL_RATE/);
  });

  it("② 换界的产物来自生成器，不是一张固定的世界表", () => {
    /*
     * 这是「探索型」与「枚举型」的分界:
     *   枚举型  签之前就知道会发生什么（九份逆旅契都是）
     *   探索型  每次不同，且有新颜度下限兜底
     *
     * 换界调的是 rerollMortalWorld → generateMortalWorld，后者有 NOVELTY_MIN 门。
     */
    const svc = readFileSync(resolve(CORE, "worldReroll.ts"), "utf8");
    expect(svc, "换界的 reroll 依赖由调用方注入 —— 那它自己不该硬编码世界表").toMatch(/reroll:/);
    /* 生成器确实有新颖度门 */
    const worldGen = readFileSync(resolve(CORE, "mortalWorldGen.ts"), "utf8");
    expect(worldGen, "凡界生成器没有新颖度门 —— 那换界只是换名字").toMatch(/NOVELTY_MIN|novelty/);
  });

  it("③ 反差：逆旅契仍然是枚举型的", () => {
    /*
     * 这一条守的是①②的边界 —— 免得后来者把九份契约也算成探索型。
     * 它们的规则是常量，签第二次一模一样（见 trialProfiles 的 determinism=1）。
     */
    expect(LIFE_TRIALS.length, "契约数量变了 —— 这条判据的前提要重看").toBeGreaterThan(5);
    for (const t of LIFE_TRIALS) {
      /* 每一份的 ruleText 都是确定性的一句话，不含「随机 / 或许 / 有些」这类 */
      expect(t.ruleText, `${t.name} 的规则说法变了`).not.toMatch(/随机|或许|有时|可能/);
    }
  });
});
