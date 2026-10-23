/* oxlint-disable no-console -- Phase 30.8 Boss 阶段有效性审计报告 */
import { describe, expect, it } from "vite-plus/test";
import { ENEMIES } from "@/data/enemies";
import { REGIONS, regionDef } from "@/data/regions";
import { enemyTraits, regionEcology } from "./buildAdvisor";

/**
 * Phase 30.8: Boss 阶段与机制有效性审计
 *
 * 核心问题: Boss 的阶段与机制系统是否真正有效?
 *
 * 审计方法(机制配置验证):
 * ① Boss 阶段覆盖 - 大多数 Boss 应有战斗阶段
 * ② 阶段机制多样性 - 阶段变化的类型应多样化
 * ③ 阶段变化强度 - 阶段改变的机制参数应有显著差异
 * ④ Boss 生态一致性 - archetype 与技能/mod 机制匹配
 * ⑤ Boss 机制指纹 - 各位 Boss 的机制组合应多数独特(数量随区域表增长)
 *
 * 注: 战斗胜率模拟依赖玩家属性与 Boss 的数值对齐(游戏内随境界同步增长),
 * 测试无法模拟装备/功法成长,故审计聚焦机制配置本身。
 */

const ALL_BOSSES = ENEMIES.filter((x) => x.isBoss);

/** 提取 Boss 的机制指纹(技能效果 + mods + archetype) */
function bossFingerprint(boss: (typeof ALL_BOSSES)[number]): string {
  const effects = [...new Set(boss.skills.map((s) => s.effect ?? "plain"))].sort();
  const modKeys = Object.keys(boss.mods ?? {}).sort();
  const phaseCount = boss.phases?.length ?? 0;
  return `${boss.archetype ?? "none"}|${effects.join(",")}|${modKeys.join(",")}|p${phaseCount}`;
}

describe("Phase 30.8: Boss 阶段与机制有效性审计", () => {
  it("① Boss 阶段覆盖: 至少 80% 的 Boss 应有战斗阶段", () => {
    const withPhases = ALL_BOSSES.filter((b) => (b.phases?.length ?? 0) > 0);
    console.log(`\n—— Phase 30.8 Boss 阶段有效性审计 ——`);
    console.log(
      `  有阶段的 Boss: ${withPhases.length}/${ALL_BOSSES.length} (${Math.round((withPhases.length / ALL_BOSSES.length) * 100)}%)`,
    );

    expect(withPhases.length / ALL_BOSSES.length).toBeGreaterThanOrEqual(0.8);
  });

  it("② 阶段机制多样性: 阶段触发的 mod/技能变化应多样化", () => {
    const changes = new Set<string>();
    for (const b of ALL_BOSSES) {
      for (const p of b.phases ?? []) {
        if (p.modChanges) {
          for (const k of Object.keys(p.modChanges)) changes.add(`mod:${k}`);
        }
        if (p.skillChanges && p.skillChanges.length > 0) {
          for (const sk of p.skillChanges) changes.add(`skill:${sk.effect ?? "plain"}:${sk.mult}`);
        }
        if (p.label) changes.add(`label:${p.label}`);
      }
    }

    console.log(`\n  阶段变化类型: ${changes.size} 种`);
    for (const c of changes) console.log(`    - ${c}`);

    // 至少 4 种不同的阶段变化机制
    expect(changes.size, "阶段变化应多样化").toBeGreaterThanOrEqual(4);
  });

  it("③ 阶段变化强度: 阶段把已有词条抬高 ≥50%,或在满血段凭空多出一项新机制", () => {
    /**
     * 判据的两本账(审计自己先犯的错):
     *
     * 标题一直写着「mods 增量为原始值的 50%+」,正文查的却是**绝对增量 ≥0.1**。
     * 两条尺子量的是不同的东西,于是同一份数据能得出相反结论 ——
     *
     *   万妖林主 regenPerRound 0.015 → 0.04:相对 **+167%**,绝对 +0.025(判「弱」)
     *   万毒老祖 / 荒古妖圣 0.02 → 0.05:相对 **+150%**,绝对 +0.03(判「弱」)
     *
     * 而 regenPerRound 的单位是「每回合回复最大气血的比例」(见 combat.ts 的
     * healSelf(mulN(maxHp, regen))):0.02→0.05 是每回合 2% 涨到 5%,
     * 一场十几二十回合的消耗战里等于多出近半个血条 —— 谁看都不是"弱变化"。
     * 绝对 0.1 这条尺子只对 base 为 0 的词条才说得通(凭空多出一项),对
     * 本来就小的比率词条会把「翻了三倍」判成「几乎没动」。
     *
     * 故统一成一条:**base > 0 看相对(≥50%),base = 0 看绝对(≥0.1)**。
     * 前者管"已有机制变强多少",后者管"多出一个新机制够不够分量"。
     * 允许的弱变化从 3 降到 0 —— 换尺子不是为了放水,而是原来那三条本就该过。
     */
    const weakChanges: string[] = [];
    const REL_GROWTH = 0.5;
    const NEW_MECHANIC_MIN = 0.1;

    for (const boss of ALL_BOSSES) {
      for (const p of boss.phases ?? []) {
        if (!p.modChanges) continue;
        for (const [k, v] of Object.entries(p.modChanges)) {
          const base = (boss.mods?.[k as keyof typeof boss.mods] as number | undefined) ?? 0;
          const delta = (v as number) - base;
          if (base > 0) {
            const growth = delta / base;
            if (growth < REL_GROWTH) {
              weakChanges.push(
                `${boss.name}: ${k} ${base} → ${v}(相对 +${(growth * 100).toFixed(0)}%,须 ≥${REL_GROWTH * 100}%)`,
              );
            }
          } else if (Math.abs(delta) < NEW_MECHANIC_MIN) {
            weakChanges.push(
              `${boss.name}: ${k} 新增量 ${delta.toFixed(2)}(须 ≥${NEW_MECHANIC_MIN})`,
            );
          }
        }
      }
    }

    console.log(`\n  弱变化:`);
    if (weakChanges.length > 0) {
      for (const w of weakChanges) console.log(`    ⚠ ${w}`);
    } else {
      console.log(`    ✅ 已有词条一律抬 ≥${REL_GROWTH * 100}%,新机制一律 ≥${NEW_MECHANIC_MIN}`);
    }

    expect(weakChanges, "阶段变化须够分量:已有词条抬 50% 以上,或新机制 ≥0.1").toEqual([]);
  });

  it("④ Boss 生态一致性: archetype 应与技能/mod 机制匹配", () => {
    const mismatches: string[] = [];

    for (const boss of ALL_BOSSES) {
      const allSkills = [
        ...boss.skills,
        ...(boss.phases ?? []).flatMap((p) => p.skillChanges ?? []),
      ];
      const allMods = { ...boss.mods };
      for (const p of boss.phases ?? []) {
        if (p.modChanges) Object.assign(allMods, p.modChanges);
      }

      const hasBurst = allSkills.some((sk) => (sk.mult ?? 0) >= 2.0);
      const hasMulti = allSkills.some((sk) => sk.effect === "multi");
      const hasPierce = allSkills.some((sk) => sk.effect === "pierce");
      const hasDodge = (allMods.dodgeRate ?? 0) >= 0.1;
      const counter = (allMods.counterRate ?? 0) >= 0.1;
      const shield = (allMods.shieldOnStart ?? 0) >= 0.1;
      const regen = (allMods.regenPerRound ?? 0) >= 0.01;
      const lifesteal = (allMods.lifesteal ?? 0) >= 0.1;

      const arch = boss.archetype;
      if (arch === "berserk" && !hasBurst) mismatches.push(`${boss.name}: 狂暴但无高爆发`);
      if (arch === "counter" && !hasMulti && !counter)
        mismatches.push(`${boss.name}: 反制但无多段/反击`);
      if (arch === "truedmg" && !hasPierce) mismatches.push(`${boss.name}: 真伤但无 pierce`);
      if (arch === "antiheal" && !lifesteal && !hasPierce)
        mismatches.push(`${boss.name}: 禁疗但无回收机制`);
      if (arch === "evasive" && !hasDodge) mismatches.push(`${boss.name}: 闪避但无闪避词条`);
      if (arch === "attrition" && !regen && !lifesteal)
        mismatches.push(`${boss.name}: 消耗但无回复/吸血`);
      if (arch === "threshold" && !shield && !hasPierce)
        mismatches.push(`${boss.name}: 门槛但无护盾/真伤词条`);
    }

    if (mismatches.length > 0) {
      console.log(`\n  ⚠ 生态不一致:`);
      for (const m of mismatches) console.log(`    - ${m}`);
    } else {
      console.log("\n  所有 Boss 的 archetype 与机制一致 ✅");
    }

    expect(mismatches.length, "Boss archetype 应与机制一致").toBe(0);
  });

  it("⑤ Boss 机制指纹: 各 Boss 的机制组合至少有 60% 独特", () => {
    const fingerprints = new Map<string, number>();
    for (const boss of ALL_BOSSES) {
      const fp = bossFingerprint(boss);
      fingerprints.set(fp, (fingerprints.get(fp) ?? 0) + 1);
    }

    const uniqueCount = fingerprints.size;
    console.log(`\n  独特机制指纹: ${uniqueCount}/${ALL_BOSSES.length}`);
    for (const boss of ALL_BOSSES) {
      console.log(`    ${boss.name}: ${bossFingerprint(boss)}`);
    }

    // 至少 60% 的 Boss 应有独特机制组合
    expect(uniqueCount / ALL_BOSSES.length).toBeGreaterThanOrEqual(0.6);
  });

  it("⑥ Boss 与区域生态一致: Boss 机制应是区域生态的极端表达", () => {
    /**
     * 生态维度只有四种(burst / multi / pierce / dodge,见 buildAdvisor 的 EcoTrait),
     * 而 Boss 的机制远不止这四样 —— 消耗流的 regenPerRound / lifesteal、禁疗的
     * 吸血、门槛的护盾,一个都对不上「生态」那张表。
     *
     * 于是这条审计量出来的四个"不一致"全是**刻度的缺口**,不是内容错:
     *   独角妖狼 / 幽冥海皇 / 万毒老祖:所在区域的生态四维全 0(该区小怪一个都不带
     *   这四个特性),而 Boss 自身带的是吸血 / 回复 —— 拿一张四维全空的表去判
     *   "有没有重叠",结论必然是"无",这条对它们零信息量;
     *   万妖林主:生态只有 dodge=2(小怪会闪),Boss 是消耗流(regen)—— 它确实
     *   不是区域生态的极端表达,但这是**设计**:区域里的小怪会闪,Boss 换一种难法。
     *
     * 旧判据用 `<= 5` 兜住这四条 —— 那是"容忍错误"而不是"记录例外":
     * 第 6 条真的冒出来时它照样绿,没人会去看那份 console。
     * 故改成两件事:
     *   ① 生态四维全 0 的区域**不参与判定**(空表没有"重叠"可言,判了也是假账);
     *   ② 其余不一致必须登记在 EXEMPT 里,写明为什么 —— 没登记就红,登记了才放行。
     *      EXEMPT 不常驻:哪天内容改得对上了,下面那条"名单不许过期"会提醒销账。
     */
    const EXEMPT: Record<string, string> = {
      万妖林主: "区域生态只有 dodge(小怪会闪),Boss 走消耗流(regenPerRound 0.015→0.04)—— 小怪闪、Boss 耗,是同一种「难」的两种表达",
    };

    const inconsistencies: string[] = [];
    const skipped: string[] = [];

    for (const boss of ALL_BOSSES) {
      const region = REGIONS.find((r) => r.boss === boss.id);
      if (!region) continue;

      const eco = regionEcology(regionDef(region.id)!);
      // ① 空生态区不参与:四维全 0 时"有没有重叠"是一句没有信息的话
      if (Object.values(eco).every((v) => v === 0)) {
        skipped.push(`${boss.name}(区域 ${region.id}:生态四维全 0)`);
        continue;
      }
      const bossTraits = enemyTraits(boss);

      // Boss 的 trait 应至少与区域生态的一个 trait 对应
      const hasOverlap = bossTraits.some((t) => (eco[t as keyof typeof eco] ?? 0) > 0);
      if (!hasOverlap && !EXEMPT[boss.name]) {
        inconsistencies.push(
          `${boss.name}(区域 ${region.id} 生态 ${JSON.stringify(eco)})的机制 ${bossTraits.join(",") || "无"} 与生态无重叠`,
        );
      }
    }

    if (skipped.length > 0) {
      console.log(`\n  生态为空、不参与判定(${skipped.length} 处):`);
      for (const s of skipped) console.log(`    · ${s}`);
    }
    if (inconsistencies.length > 0) {
      console.log(`\n  ⚠ 区域生态不一致(未登记豁免):`);
      for (const i of inconsistencies) console.log(`    - ${i}`);
    } else {
      console.log(
        `\n  所有有生态的区域,Boss 机制都与生态对得上 ✅(豁免 ${Object.keys(EXEMPT).length} 条)`,
      );
    }

    expect(inconsistencies, "Boss 机制应与区域生态相关;确属设计的请登记进 EXEMPT").toEqual([]);

    // 名单不许过期:豁免的那位若哪天已经对上了,提醒把这条销掉(和 deadExportAudit 同款)
    const staleExempt = Object.entries(EXEMPT).filter(([name]) => {
      const boss = ALL_BOSSES.find((b) => b.name === name);
      if (!boss) return true;
      const region = REGIONS.find((r) => r.boss === boss.id);
      if (!region) return true;
      const eco = regionEcology(regionDef(region.id)!);
      return enemyTraits(boss).some((t) => (eco[t as keyof typeof eco] ?? 0) > 0);
    });
    expect(
      staleExempt.map(([n]) => n),
      "这些已不再需要豁免 —— 内容改对了,把它们从 EXEMPT 里销掉",
    ).toEqual([]);
  });
});
