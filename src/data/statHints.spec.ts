/**
 * 词条要有一句「它到底管什么」—— 有些名字读不出作用
 *
 * ## 由来
 *
 * `STAT_NAMES` 有 45 条词条名，玩家在天赋、装备、增益、灵脉、丹药、天时
 * **十几处**都会看到它们。而它们只有名字，没有一句解释。
 *
 * 多数名字是自明的:「攻击 +12%」「防御 +5%」「修炼速度 +8%」—— 读到就知道。
 * 但有一批不是:
 *
 * ```text
 *   气运         可能是掉落？事件？突破？实际上三样都沾一点
 *   御劫         是减伤？还是提高成功率？—— 是「天劫抗性」，乘在雷伤上
 *   双倍战利     在哪儿双倍？打怪还是采药？
 *   溢疗成盾     治疗溢出转护盾 —— 但那要玩家知道"溢出"是什么
 *   定心护料     炼丹失败时保住材料？听起来像，但「定心」不指向这个
 * ```
 *
 * 这些词条一旦出现在**天赋选择**（一生一次）、**灵脉投点**（不可回收）这类
 * 不可逆的决定里，玩家读到名字却不知道它值多少，就只能靠猜。
 *
 * 本仓对这件事的口径一直很明确（AGENTS.md）:
 *
 * > 给决策前把数字摊开……不能只给定性形容词（「皆有裨益」「更容易」不算数）。
 *
 * 「气运 +10%」是一个**数**，但它不说明**管什么** —— 那和「皆有裨益」离得不远。
 *
 * ## 判据守什么
 *
 * 一 那些**名字读不出作用**的词条，必须有释义（一张显式的清单，不是全表）；
 * 二 释义**短**且**说机制**（不是"提升气运"这种同义反复）;
 * 三 释义与代码对得上 —— 说「气运」影响突破的，`core/breakthrough` 里就得真有
 *    那一项。这一条最要紧:释义写错比不写更糟（它会被当成说明来读）。
 * 四 界面真的读它（不是又一张"写好没人用"的表）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { STAT_HINTS, statHintOf } from "@/data/statNames";

/** 名字读不出作用、必须解释的那一批 —— 不是全表，只收这一批 */
export const NEEDS_HINT = [
  "luck",
  "tribulationResist",
  "doubleDropRate",
  "overhealShield",
  "craftSalvage",
  "eventLuck",
  "breakRefund",
  "beastPct",
  /*
   * 第 369 轮补的四条 —— 同一类问题，但成因不同。
   *
   * 前八条是「名字本身指向不明」（气运、御劫、定心护料）。
   * 这四条是「名字读起来不像概率」:
   *
   * ```text
   *   闪避 +5%     读起来像"闪避能力提升了 5%"——而它是"每次被打有 5% 概率闪掉"
   *   连击 +15%    读起来像"连击伤害 +15%"——而它是"每次出手有 15% 概率再打一次"
   *   震慑 +3%     读起来像"震慑强度"——而它是"每次出手有 3% 概率让对方跳过一回合"
   *   反击概率 +20% 这条**叫对了**（带「概率」二字），留着当对照组
   * ```
   *
   * 五个词条（含 `critRate` 暴击率、`counterRate` 反击概率）都是
   * `core/combat` 里的 `rng.chance(...)` —— 同一件事，三种叫法。
   *
   * **不改名字**:「闪避」「连击」在 41 / 30 处出现，且都是修仙题材里的正词；
   * 改名的代价远大于补一句说明。故走 `STAT_HINTS` 这条路。
   */
  "dodgeRate",
  "comboRate",
  "stunRate",
  "counterRate",
] as const;

describe("词条释义 · 名字读不出作用的那些", () => {
  it("那一批词条都有释义", () => {
    const missing = NEEDS_HINT.filter((k) => !statHintOf(k));
    expect(
      missing,
      `这些词条只给了名字、没给作用 —— 玩家在天赋/灵脉这类不可逆的选择里只能靠猜:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("释义短、说机制，不同义反复", () => {
    /*
     * 判据要挡的是三种坏释义:
     *   太长      超过 30 字，在词条旁边放不下，实际会被截断
     *   同义反复  「气运：提升气运」—— 说了等于没说
     *   空泛      「皆有裨益」这类
     */
    for (const k of NEEDS_HINT) {
      const hint = statHintOf(k);
      if (!hint) continue;
      expect(hint.length, `「${k}」的释义太长（${hint.length} 字）: ${hint}`).toBeLessThanOrEqual(
        30,
      );
      expect(hint.length, `「${k}」的释义太短: ${hint}`).toBeGreaterThan(4);
      // 不许把名字原样塞回去当解释
      const name = (STAT_HINTS as Record<string, string>)[k] ?? "";
      void name;
      expect(hint, `「${k}」的释义只是名字的复述: ${hint}`).not.toMatch(
        /^(提升|增加|提高)?[\u4e00-\u9fa5]{2,3}$/,
      );
    }
  });

  it("释义与代码对得上 —— 写错的释义比不写更糟", () => {
    /*
     * 这是整件事的地基。「御劫」若写成"提高渡劫成功率"，而实际是乘在雷伤上，
     * 玩家会照着它去堆，然后发现没用 —— 那比不解释更糟。
     *
     * 故每一条都要在对应的 core 模块里找得到消费点。
     */
    const CASES: { key: string; file: string }[] = [
      { key: "luck", file: "src/core/breakthrough.ts" }, // 气运 × BT_LUCK_TO_RATE
      { key: "tribulationResist", file: "src/core/tribulationDecision.ts" },
      { key: "doubleDropRate", file: "src/core/loot.ts" },
      { key: "breakRefund", file: "src/core/breakthrough.ts" },
    ];
    for (const c of CASES) {
      const src = readSource(c.file);
      expect(
        src.includes(c.key) || src.includes(JSON.stringify(c.key).slice(1, -1)),
        `「${c.key}」的释义说它管某件事，而 ${c.file} 里找不到这个键 —— 释义与代码对不上`,
      ).toBe(true);
    }
  });

  it("概率类词条要说明「这是概率」，不是「能力值」", () => {
    /*
     * 五个都是 `core/combat` 的 `rng.chance(...)` —— 每次判定掷一次。
     * 而名字里只有「暴击率」「反击概率」两条带"率/概率"，另三条读起来像能力值。
     *
     * 判据:`dodgeRate` / `comboRate` / `stunRate` 的释义里要出现「概率」或「掷」
     * 这类把它说成"一次判定"的词，不能只写"闪掉攻击"这种结果描述 ——
     * 那仍然读不出它是每次掷的。
     */
    for (const k of ["dodgeRate", "comboRate", "stunRate"]) {
      const hint = statHintOf(k);
      expect(hint, `「${k}」没有释义`).toBeTruthy();
      expect(hint!, `「${k}」的释义没有说清它是概率判定: ${hint}`).toMatch(/概率|掷|判定/);
    }
  });

  it("界面真的读它 —— 不是又一张写好没人用的表", () => {
    /*
     * 与 `deadExportAudit` 同一条:一个只被用例读的表就是骨架空转。
     * 这里钉的是「人物页的词条明细要用它」—— 那是玩家查"这条是什么"的地方。
     */
    const view = readSource("src/views/CharacterView.vue");
    expect(view, "人物页的词条明细没有用释义 —— 那这张表等于没接").toContain("statHintOf");
  });
});
