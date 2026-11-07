/* oxlint-disable no-console -- 进度曲线读数要打出来给人看 */
/**
 * 镇压资格是一条**进度曲线**,不是一道运气门。
 *
 * ## 这条判据在守什么
 *
 * 镇压资格的门槛是「≥20 战 · 均≤3 回合 · 均受伤≤10%」(见 core/suppress)。
 * 开局裸装当然是惨胜 —— 这本该由装备与功法逐步补上,而不是靠开局那几件基础属性
 * 慢慢磨。把这条曲线量出来,是为了回答一个问题:**它什么时候能达成**。
 *
 * 实测(开局玩家 vs tier1 三只敌人,每只 8 个固定种子):
 *
 * ```text
 *   裸装            均 14.0 回合 · 受伤 69%   ✗
 *   学太玄引气诀      均 13.1 回合 · 受伤 65%   ✗
 *   tier1 全套 9 件  均  6.0 回合 · 受伤  9%   ✗(回合仍超)
 *   tier3 全套 9 件  均  2.4 回合 · 受伤  1%   ✓
 *   tier5 全套 9 件  均  1.8 回合 · 受伤  0%   ✓
 * ```
 *
 * 也就是说:**tier3 那一档的装备是这条门槛的转折点** —— 玩家打到第三个区域、
 * 换上那一档装备,第一个区域的镇压资格就到手了。这个节奏是健康的:
 * 它让「镇压」成为回去收割旧区域的奖励,而不是开局就该有的东西。
 *
 * ## 判据守什么
 *
 * 1. 裸装打不过门槛(否则「镇压」自开头就没有进度感);
 * 2. tier3 全套要过门槛(否则那条曲线拖得太长,玩家会在旧区域磨太久);
 * 3. 两条之间必须存在**中间态**(tier1 比裸装明显好、但还不过门槛)——
 *    这条守的是「进度是连续推进的」,不是「一步到位」。
 *
 * 它不规定具体数值。改装备、改战斗公式、改门槛,只要这三件事还成立,就绿。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { makeEnemySnap, resolveCombat } from "@/core/combat";
import { buildPlayerSnap } from "@/core/playerSnap";
import { suppressionProgress } from "@/core/suppress";
import { ENEMIES } from "@/data/enemies";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { useInventoryStore } from "@/stores/inventory";
import { RandomService, mulberry32 } from "@/utils/random";

interface Trial {
  wins: number;
  avgRounds: number;
  avgDamagePct: number;
  /** 按 core/suppress 的同一套判据算「够不够镇压」 */
  qualifies: boolean;
}

/** 换上某一档的全套 9 件(品质取 fine —— 与展品档同档,不偏强) */
function wearTier(tier: number | null): void {
  const inv = useInventoryStore();
  if (tier === null) {
    inv.items = [];
    inv.equipped = {};
    return;
  }
  const eqs = EQUIPMENT_TEMPLATES.filter((t) => t.tier === tier);
  const items = eqs.map((t) => ({
    uid: `u_${t.id}`,
    templateId: t.id,
    quality: "fine" as const,
    tier,
    level: 0,
    affixes: [],
  }));
  const equipped: Record<string, string> = {};
  for (const it of items) {
    const tpl = EQUIPMENT_TEMPLATES.find((x) => x.id === it.templateId)!;
    equipped[tpl.slot] = it.uid;
  }
  inv.items = items as never;
  inv.equipped = equipped as never;
}

/** 开局玩家打 tier1 的三只寻常敌人,每只 8 个固定种子 */
function trial(): Trial {
  const p = buildPlayerSnap();
  const foes = ENEMIES.filter((e) => e.tier === 1 && !e.isBoss);
  let wins = 0;
  let rounds = 0;
  let hpPct = 0;
  for (const def of foes) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const foe = makeEnemySnap(def, 1, 1);
      const r = resolveCombat(p, foe, new RandomService(mulberry32(seed)));
      if (!r.win) continue;
      wins += 1;
      rounds += r.rounds;
      hpPct += r.playerHpPct;
    }
  }
  const avgRounds = rounds / wins;
  const avgDamagePct = 1 - hpPct / wins;
  /*
   * 直接问 core/suppress 的同一个函数 —— 别在这里另写一套门槛判断,
   * 那会让「曲线变了」和「判据抄错了门槛」两种红长得一样。
   */
  const progress = suppressionProgress({
    totalFights: wins,
    avgRounds,
    avgDamageTakenPct: avgDamagePct,
    consecutiveWins: wins,
    lastUpdateAt: 0,
  });
  return {
    wins,
    avgRounds,
    avgDamagePct,
    qualifies: progress.winsOk && progress.roundsOk && progress.damageOk,
  };
}

describe("镇压资格是一条进度曲线", () => {
  it("裸装不过、tier3 过,中间有 tier1 这一档过渡", () => {
    const table: { label: string; t: Trial }[] = [];
    for (const [label, tier] of [
      ["裸装", null],
      ["tier1 全套", 1],
      ["tier3 全套", 3],
    ] as const) {
      setActivePinia(createPinia());
      wearTier(tier);
      table.push({ label, t: trial() });
    }
    console.log("\n镇压资格进度曲线(开局玩家 vs tier1 寻常敌人):");
    for (const { label, t } of table) {
      console.log(
        `  ${label.padEnd(14)} 胜 ${String(t.wins).padStart(2)}/24 · ` +
          `均 ${t.avgRounds.toFixed(1)} 回合 · 受伤 ${(t.avgDamagePct * 100).toFixed(0)}% · ` +
          `镇压 ${t.qualifies ? "✓" : "✗"}`,
      );
    }

    const [bare, t1, t3] = table;
    expect(bare!.t.qualifies, "裸装就打得到镇压资格 —— 那「镇压」自开头就没有进度感").toBe(false);
    expect(t3!.t.qualifies, "tier3 全套仍拿不到镇压 —— 那条曲线拖得太长").toBe(true);
    /* 中间态:tier1 比裸装明显好(回合数至少砍一半),但还不过门槛 */
    expect(
      t1!.t.avgRounds,
      `tier1 全套的均回合 ${t1!.t.avgRounds.toFixed(1)} 没有明显低于裸装的 ${bare!.t.avgRounds.toFixed(1)} —— 进度不是连续推进的`,
    ).toBeLessThan(bare!.t.avgRounds * 0.6);
    expect(t1!.t.qualifies, "tier1 就到门槛 —— 中间那一档没有意义了").toBe(false);
    /* 全程都要赢,否则这条曲线测的是「能不能赢」而不是「多快赢」 */
    for (const { label, t } of table) {
      expect(t.wins, `${label}:竟然输给了 tier1 寻常敌人(这条判据要测的是速度,不是胜负)`).toBe(24);
    }
  });
});
