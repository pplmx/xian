/**
 * `bossArchetypes` 里那一大块数值**没有消费方** —— 而它与实际战斗用的数值不同。
 *
 * ## 由来（第 210 轮，扫数值层面的「两本账」）
 *
 * 两个文件里都有「狂化」这个 Boss 相位，数值却不同:
 *
 * ```text
 * core/bossArchetypes.ts   hpThreshold 0.5 · damageBonus 0.6 · skill mult 2.6
 * data/enemies.ts          hpThreshold 0.5 · damageBonus 0.5 · skill mult 2.2
 * ```
 *
 * 查下来:
 *
 * ```text
 * ARCHETYPES 的消费者   ui/enemyLore.ts:140 —— 只读 .name 与 .seal（家族名 + 印章）
 * ARCHETYPES 的其余字段 phases / coreMods / coreSkills / statPersonality
 *                       全仓零引用（`grep ARCHETYPES[…].phases` 无结果）
 * ```
 *
 * 也就是说那 137 行里，**只有名字与印章是活的**;`phases` 那一段数值从不参与战斗，
 * 却摆在与实战数据同一个 `BossPhase` 类型下，且值不一样。
 *
 * ## 为什么这算缺陷
 *
 * 后来的人看到 `bossArchetypes.ts` 里写着 `damageBonus: 0.6`，会以为调它就能改狂暴型
 * 的强度。改完跑一遍 —— 什么都没变，也没有任何判据红。而真正的数值在
 * `data/enemies.ts`。
 *
 * 这不是「两套实现」，是**一套实现加一份长得一模一样的陪衬**，后者更有害。
 *
 * ## 这条判据守什么
 *
 * `ARCHETYPES` 每个家族里，凡**除 `id` / `name` / `seal` / `desc` 之外**的字段，
 * 要么有消费者，要么在类型上被标成展示层。
 *
 * 判据不删数据 —— 它只要求「它是什么」被写清楚、且被守住:
 * 若哪天有人真让战斗读 `ARCHETYPES.phases`，这条会红，提醒他把两份合成一份。
 *
 * ## 故障注入
 *
 * 让图鉴去读 `ARCHETYPES[x].phases[0].hpThreshold` → 前两条同时红。
 * 把文件头那段说明换成 `/** Boss 机制家族 *\/` → 第三条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { ARCHETYPES } from "./bossArchetypes";

describe("Boss 机制家族 · 展示数据与战斗数据要分开", () => {
  it("判据的前提还在 —— 那份表与它的消费者", () => {
    expect(Object.keys(ARCHETYPES).length, "ARCHETYPES 空了").toBeGreaterThan(3);
    const lore = stripComments(readSource("src/ui/enemyLore.ts"));
    expect(lore, "图鉴不再读 ARCHETYPES —— 判据要跟着改").toContain("ARCHETYPES");
    // 而它只读 name / seal（这是本判据的事实基础）
    expect(lore, "图鉴开始读 ARCHETYPES 的战斗字段了 —— 那两份数据要合成一份").not.toMatch(
      /ARCHETYPES\[[^\]]*\]\.(phases|coreMods|coreSkills|statPersonality)/,
    );
  });

  it("没有任何战斗代码读 ARCHETYPES 的战斗字段", () => {
    /*
     * 判那件事:那些字段是死数据。若哪天有人接上了，这条会红 ——
     * 那时必须先把 `data/enemies.ts` 与它合成一份，否则两边数值不同，
     * 而「改了没反应」或「改了有反应但和实战不一致」都会发生。
     */
    const offenders: string[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      if (f.endsWith("bossArchetypes.ts")) continue;
      for (const m of src.matchAll(
        /ARCHETYPES\[[^\]]*\]\s*\.\s*(phases|coreMods|coreSkills|statPersonality)|ARCHETYPES\s*\.\s*\w+\s*\.\s*(phases|coreMods|coreSkills|statPersonality)/g,
      )) {
        offenders.push(`${f.replace(/^.*\/src\//, "src/")}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      "有代码开始读 ARCHETYPES 的战斗字段了 —— 但那些值与 `data/enemies.ts` 里的实战值不同" +
        "（狂化：0.6 / 2.6 vs 0.5 / 2.2）。先把两份合成一份，否则改了不生效或生效了不一致:" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("那份文件自己写明了「这里的数值不参与战斗」", () => {
    /*
     * 防空转的第二层:光「没有消费方」不够 —— 读代码的人要能看到说明，
     * 否则他仍会以为改这里是有效的。文件头必须有一句挑明。
     */
    const raw = readSource("src/core/bossArchetypes.ts");
    const head = raw.split("\n").slice(0, 40).join("\n");
    expect(
      head,
      "文件头没有写明「phases/coreMods 这些数值不参与战斗、实战数据在 data/enemies.ts」—— " +
        "后来的人会以为改这里能改强度，而改完什么都没变、也没有任何判据红",
    ).toMatch(/不参与|展示|实战数据|enemies/);
  });
});
