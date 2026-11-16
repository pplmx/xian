/* oxlint-disable no-console */
/**
 * 道果消费的动机类型审计
 *
 * 逆旅契已证明规则型消费能改变构筑。但要问的下一个问题不是
 * 「还能设计什么限制」,而是:
 *
 *   **什么样的道果消费,会让玩家产生「我想看看这一世会发生什么」的欲望?**
 *
 * 挑战型(我想挑战自己)与探索型(我想看看会怎样)看着只差一点,
 * 动机却完全不同。区别可以量化 —— 核心是「第二次买还有没有未知」。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  CONDITIONS,
  NOVELTY_MIN,
  PLAIN_LIFE,
  classify,
  conditionsMetBy,
  hostReadyCount,
  poolExhaustion,
  ruleDistance,
  trialPairDistances,
  trialProfiles,
  voidWorldProfile,
} from "./motivationType";
import { LIFE_TRIALS } from "@/data/lifeTrials";

describe("动机类型 · 逆旅契属于哪一种", () => {
  it("四份契的规则确实偏离了平常的一世 —— 它不是换皮", () => {
    for (const p of trialProfiles()) {
      expect(p.deviation).toBeGreaterThan(0);
    }
    const worst = trialProfiles().reduce((a, b) => (b.deviation > a.deviation ? b : a));
    console.log(
      `\n偏离最大的是「${worst.name}」(${worst.deviation.toFixed(3)}) ——` +
        `\n配合上一轮实测(四契皆改构筑排序),规则型消费的有效性已经坐实`,
    );
  });

  it("但四份契全部是挑战型:签之前就知道会发生什么", () => {
    const ps = trialProfiles();
    for (const p of ps) {
      expect(p.determinism).toBe(1);
      expect(p.replayDelta).toBe(0);
      expect(p.type).toBe("challenge");
    }
    console.log(
      "\n规则是 LIFE_TRIALS 里的常量:签之前完全可预知,签第二次一模一样。" +
        "\n故动机只能是「我想做到」,不可能是「我想看看」",
    );
  });

  it("挑战型天然是一次性的:契约池会见底", () => {
    const { total, livesToExhaust } = poolExhaustion();
    expect(livesToExhaust).toBe(total);
    console.log("\n契约两两之间的规则距离:");
    for (const d of trialPairDistances()) {
      console.log(`  ${d.a} ↔ ${d.b}  ${d.d.toFixed(3)}`);
    }
    console.log(
      `\n枚举式内容的信息量有上限:${total} 份契签完就见底。` +
        `\n之后再签只是重复执行已知的东西 —— 这正是挑战型的边界`,
    );
  });
});

describe("动机类型 · 探索型长什么样", () => {
  it("虚界是现成的对照:同一个入口,每次不同的世界", () => {
    const v = voidWorldProfile();
    expect(v.type).toBe("discovery");
    expect(v.replayDelta).toBeGreaterThan(0);
    expect(v.determinism).toBeLessThan(1);
    console.log(`\n虚界:${v.evidence}`);
  });

  it("关键不在「随机」,而在新颖度有下限保证", () => {
    // 随机换皮也能做到「每次不同」,但玩家很快会发现是同一批东西重排。
    // worldGen 的做法是设硬门槛:不够新就换种子重来
    expect(NOVELTY_MIN).toBeGreaterThan(0);
    expect(classify(0, NOVELTY_MIN)).toBe("discovery");
    // 而随机但无门槛的情形仍可能退化 —— 判据要求 replayDelta > 0 是**保证**
    expect(classify(0, 0)).toBe("challenge");
    console.log(
      `\n「每次不同」不等于探索型。若不同只是概率,玩家迟早看穿是同一批素材重排。` +
        `\nworldGen 的 NOVELTY_MIN=${NOVELTY_MIN} 是结构性保证:规则向量、敌人机制、` +
        `\n可行流派三维加权后不够新,直接弃用重生成`,
    );
  });
});

describe("动机类型 · 探索型消费的三个结构条件", () => {
  it("三条虚界全满足,逆旅契一条都不满足", () => {
    expect(conditionsMetBy("void")).toHaveLength(CONDITIONS.length);
    expect(conditionsMetBy("trial")).toHaveLength(0);
    console.log(
      `\n虚界 ${CONDITIONS.length}/${CONDITIONS.length},逆旅契 0/${CONDITIONS.length} ——` +
        `\n差距不在契约设计得好不好,在于它是枚举式的`,
    );
  });

  it("这三条凡界也全部满足了 —— mortalWorldGen 把它们补齐了", () => {
    /*
     * ## 这条断言改过一次（第 444 轮）
     *
     * 原先它写的是 `expect(ready).toBeLessThan(CONDITIONS.length)` ——
     * 断言「凡界只满足一部分」，并配一句「凡界的区域/敌人/事件都是静态定义，
     * 没有可重组的内容层」。
     *
     * 而 `mortalWorldGen` 早把这件事做了:每一世换的是
     * **地界组合与顺序、路线骨架、事件节奏、规则与资源偏向**。实测六世:
     *
     * ```text
     *   骨架 short_weave / brisk / lateclimb / weave ×2
     *   节奏 front / back ×2 / flat / twin ×2
     *   规则 heaven_wrath ×2 / foe_swift / foe_onslaught / foe_combo ×2
     *   地界序  5 段、4 段、6 段、6 段、6 段、4 段 —— 无一重复
     * ```
     *
     * 而那两条 `hostReady: false` 的 `note` 也一直写着「凡界目前都是静态定义」——
     * **判据与它守的数据一起过时了**，两者互相印证，于是谁也没红。
     *
     * 现在这条改成正向断言:凡界三条全满足。若哪天有人把 `mortalWorldGen`
     * 摘掉、或把某条 `hostReady` 改回 false，它会红。
     */
    const ready = hostReadyCount();
    expect(
      ready,
      `凡界只满足 ${ready}/${CONDITIONS.length} 条 —— ` +
        "若这是有意的退步，请连同这条断言与本文件的 note 一起改；" +
        "若是误改，mortalWorldGen 那条链断了",
    ).toBe(CONDITIONS.length);
    console.log(
      `\n凡界 ${ready}/${CONDITIONS.length} 条全满足 —— mortalWorldGen 提供了可重组的内容层` +
        `\n(地界组合与顺序 · 路线骨架 · 事件节奏 · 规则与偏向)`,
    );
  });

  it("结论:动机类型的转换需要内容生成能力,不是再设计几份契", () => {
    // 沿着「还能设计什么限制」走下去,得到的仍然是挑战型:
    // 禁丹、独器、异途都是已知的限制,签之前就知道会发生什么
    const trials = trialProfiles();
    expect(trials.every((t) => t.type === "challenge")).toBe(true);
    expect(voidWorldProfile().type).toBe("discovery");
    console.log(
      "\n禁丹 / 独器 / 异途沿的仍是同一条路:限制是已知的," +
        "\n签之前就知道会发生什么 —— 扩的是范围,不是动机类型。" +
        "\n\n要让道果买到「不同的一世」而非「更难的同一世」,需要一条探索型的出口。" +
        "\n而它的**结构条件凡界已经满足了**(mortalWorldGen 提供可重组的内容层," +
        "\n新颖度门 NOVELTY_MIN 在 mortalGate 里否决不够新的候选)。" +
        "\n而且它**已经接上了** —— 转世时 reincarnation 第 363 行自动调 rerollMortalWorld()," +
        "\n每世换一方天地,不花道果。故「不同的一世」是既有内容,不在道果的货架上。" +
        "\n\n逆旅契作为挑战型内容仍然是成立的,不该被硬塞奖励去充当长期动力",
    );
  });
});

describe("动机类型 · 判据自身的可靠性", () => {
  it("规则距离对「无变化」给零,对「有变化」给正值", () => {
    expect(ruleDistance(PLAIN_LIFE, PLAIN_LIFE)).toBe(0);
    for (const t of LIFE_TRIALS) {
      expect(ruleDistance(t.rules, PLAIN_LIFE)).toBeGreaterThan(0);
      // 自己与自己距离为零 —— 这正是 replayDelta = 0 的算式依据
      expect(ruleDistance(t.rules, t.rules)).toBe(0);
    }
    console.log("\n同一份契签两次,规则距离为 0 —— 重玩增量为零由此得出,不是主观判断");
  });

  it("分类函数在边界上表现正确", () => {
    expect(classify(1, 0)).toBe("challenge");
    expect(classify(1, 0.5)).toBe("challenge");
    expect(classify(0, 0)).toBe("challenge");
    expect(classify(0.5, 0.3)).toBe("discovery");
    console.log("\n两个条件缺一不可:可预知或无重玩增量,都归入挑战型");
  });
});
