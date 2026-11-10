/**
 * Phase 31.0 A3:功法悟道分支 —— 满级后择一,改变成长方向
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useCultivationStore } from "@/stores/cultivation";
import { branchesFor, canEnlighten, gongfaBranchDef, GONGFA_BRANCHES } from "@/data/gongfaBranches";
import { GONGFA, gongfaDef } from "@/data/gongfa";
import { AFFIXES } from "@/data/affixes";
import { qualityDef } from "@/data/qualities";
import { STAT_NAMES } from "@/data/statNames";
import type { AnyStatKey } from "@/types";
import { modOf } from "./statsCalc";

describe("功法悟道分支(gongfaBranch)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("太玄引气诀满级前不可选分支", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    cul.upgrade("m_taixuan"); // 2 层
    expect(cul.chooseBranch("m_taixuan", "b_taixuan_sha")).toBe(false);
  });

  it("分支词条并入功法属性且只在满级时生效(转世折层后 lv-1 不得再吃满级分支)", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    for (let i = 0; i < 9; i++) cul.upgrade("m_taixuan"); // 1 + 9 = 10 层(>= maxLevel 9)
    const ok = cul.chooseBranch("m_taixuan", "b_taixuan_sha");
    expect(ok).toBe(true);
    // damageBonus 是分支独有词条(基础功法不掺),满级时该有 +0.05
    expect(modOf(cul.gongfaMods, "damageBonus")).toBeCloseTo(0.05, 5);
    // 转世把层数折回:分支还挂着,但功法已不满级 —— 分支加成必须随之失效(继承价错误源头)
    cul.learned = { ...cul.learned, m_taixuan: 2 };
    expect(modOf(cul.gongfaMods, "damageBonus")).toBe(0);
  });

  it("已装配功法的分支加成,换下主修后随装配一并失效(不永久叠加)", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    for (let i = 0; i < 9; i++) cul.upgrade("m_taixuan"); // 满级
    expect(cul.chooseBranch("m_taixuan", "b_taixuan_sha")).toBe(true);
    expect(modOf(cul.gongfaMods, "damageBonus")).toBeCloseTo(0.05, 5);
    // 换主修到另一门:太玄未装配 —— 分支加成须随装配一并撤下,不得在多门满级功法间永久叠加
    cul.learn("m_zixiao");
    cul.equipMain("m_zixiao");
    expect(modOf(cul.gongfaMods, "damageBonus")).toBe(0);
  });

  it("分支一经选择不可更改", () => {
    const cul = useCultivationStore();
    cul.learn("m_taixuan");
    for (let i = 0; i < 8; i++) cul.upgrade("m_taixuan");
    cul.chooseBranch("m_taixuan", "b_taixuan_sha");
    expect(cul.chooseBranch("m_taixuan", "b_taixuan_shou")).toBe(false);
    expect(cul.gongfaBranch.m_taixuan).toBe("b_taixuan_sha");
  });

  it("分支表完整:每个分支可回查,分支属于正确功法", () => {
    for (const b of branchesFor("m_taixuan")) {
      expect(gongfaBranchDef(b.id)?.gongfaId).toBe("m_taixuan");
    }
    expect(branchesFor("m_taixuan").length).toBe(3);
  });
});

/**
 * 「可悟道」不得虚指。
 *
 * 曾经界面只判满级就挂出「可悟道」,而全书三十余部功法里只有三部写了分支——
 * 玩家练满其余任意一部,都会看到一个点开即空的提示,这正是「不知道什么意思、也没法悟道」的由来。
 * 判据自此收归 canEnlighten 一处,下面这几条守着它别再散开。
 */
describe("悟道提示与实际可选项同源", () => {
  it("全书功法尽数写有分支,练满哪一部都真能悟道", () => {
    // Phase 32.4 补全前只有三部写了分支,其余练满都是空头支票。
    // 这条守的是「全书无遗漏」,新增功法若忘了配分支,会在此处被拦下。
    for (const def of GONGFA) {
      expect(branchesFor(def.id).length, `${def.name} 没有悟道分支`).toBeGreaterThanOrEqual(2);
      expect(canEnlighten(def.id, def.maxLevel), `${def.name} 满级却不可悟道`).toBe(true);
    }
  });

  it("有分支的功法满级才可悟道,未满级不可", () => {
    const max = gongfaDef("m_taixuan")?.maxLevel ?? 9;
    expect(canEnlighten("m_taixuan", max - 1)).toBe(false);
    expect(canEnlighten("m_taixuan", max)).toBe(true);
  });

  it("不存在的功法一律不可悟道", () => {
    expect(canEnlighten("m_not_a_real_gongfa", 99)).toBe(false);
  });

  it("凡可悟道者必给得出至少两条路 —— 只有一条不叫「择一」", () => {
    const withBranch = new Set(GONGFA_BRANCHES.map((b) => b.gongfaId));
    expect(withBranch.size).toBeGreaterThan(0);
    for (const id of withBranch) {
      expect(gongfaDef(id), `分支表引用了不存在的功法 ${id}`).toBeDefined();
      expect(branchesFor(id).length, `${id} 只有一条分支`).toBeGreaterThanOrEqual(2);
    }
  });

  it("每条分支都实给词条 —— 选了等于没选是欺骗", () => {
    for (const b of GONGFA_BRANCHES) {
      const entries = Object.entries(b.mods);
      expect(entries.length, `${b.name} 无任何词条`).toBeGreaterThan(0);
      for (const [k, v] of entries) {
        expect(v, `${b.name} 的 ${k} 非正值`).toBeGreaterThan(0);
      }
    }
  });

  it("分支 id 全局唯一(回查不会串味)", () => {
    const ids = GONGFA_BRANCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Phase 32.4 分支平衡审计。
 *
 * 分支给多少不该拍脑袋,标尺取自游戏已有的词条经济:每个词条在 data/affixes.ts 里
 * 都有一档最低值(如 attackPct 最低档 2%),记作一个「词条单位」;
 * 一条分支的份量 = 各词条值 ÷ 各自单位,再相加。
 *
 * 标尺随词条池一起演化,不是另写一张会与数据脱节的权重表。
 * 它对发育向词条(修炼速度、灵气)的估值偏保守 —— 这类词条的真实价值随进度浮动,
 * 装备档位量不出来,所以下面的比值阈值留了余量,不追求小数点上的精确。
 */
describe("悟道分支平衡审计", () => {
  /** 各词条在装备池里的最低档(单位)与最高档(封顶),已换算为 StatMods 的小数口径 */
  const SCALE = (() => {
    const out = new Map<string, { unit: number; cap: number }>();
    for (const a of AFFIXES) {
      // 装备词条以百分数书写(2 表示 2%),分支词条以小数书写(0.02),故除以 100 对齐
      const min = a.min / 100;
      const max = a.max / 100;
      const cur = out.get(a.key);
      out.set(
        a.key,
        cur
          ? { unit: Math.min(cur.unit, min), cap: Math.max(cur.cap, max) }
          : { unit: min, cap: max },
      );
    }
    return out;
  })();

  /** 一条分支折算成多少个词条单位 */
  function weightOf(mods: Record<string, number | undefined>): number {
    let sum = 0;
    for (const [k, v] of Object.entries(mods)) {
      const s = SCALE.get(k);
      if (s) sum += (v ?? 0) / s.unit;
    }
    return sum;
  }

  it("分支不越过装备的天花板 —— 悟道是一条路,不是一件神装", () => {
    for (const br of GONGFA_BRANCHES) {
      for (const [k, v] of Object.entries(br.mods)) {
        const s = SCALE.get(k);
        expect(s, `${br.name} 用了装备池里没有的词条 ${k},无从校准`).toBeDefined();
        expect(
          v ?? 0,
          `${br.name} 的 ${k}=${v} 超过装备同名词条上限 ${s!.cap}`,
        ).toBeLessThanOrEqual(s!.cap);
      }
    }
  });

  it("同一功法各分支份量相当 —— 「择一」得是真选择,不能有一条明显是陷阱", () => {
    for (const def of GONGFA) {
      const ws = branchesFor(def.id).map((b) => weightOf(b.mods));
      if (ws.length < 2) continue;
      const hi = Math.max(...ws);
      const lo = Math.min(...ws);
      expect(
        hi / lo,
        `${def.name} 的分支强弱悬殊(${lo.toFixed(2)} vs ${hi.toFixed(2)})`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("份量随品质递增 —— 高阶功法的悟道该更有分量", () => {
    const byRank = new Map<number, number[]>();
    for (const br of GONGFA_BRANCHES) {
      const def = gongfaDef(br.gongfaId);
      if (!def) continue;
      const rank = qualityDef(def.quality).rank;
      byRank.set(rank, [...(byRank.get(rank) ?? []), weightOf(br.mods)]);
    }
    const ranks = [...byRank.keys()].sort((a, b) => a - b);
    expect(ranks.length).toBeGreaterThan(3);
    let prev = 0;
    for (const r of ranks) {
      const ws = byRank.get(r)!;
      const avg = ws.reduce((s, w) => s + w, 0) / ws.length;
      expect(
        avg,
        `品质 rank ${r} 的分支均值 ${avg.toFixed(2)} 反低于前一档 ${prev.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(prev);
      prev = avg;
    }
  });

  it("每条分支的词条都显示得出中文名(界面不漏内部键名)", () => {
    for (const br of GONGFA_BRANCHES) {
      for (const k of Object.keys(br.mods)) {
        expect(
          STAT_NAMES[k as AnyStatKey],
          `${br.name} 的 ${k} 没有中文名,界面会漏出内部键名`,
        ).toBeTruthy();
      }
    }
  });
});

/**
 * 同一「席位 × 品阶」的功法,基座份量不许整批跑偏。
 *
 * ## 缺口是什么(第 55 轮实测)
 *
 * 上面那张 `SCALE` 表从装备词条池推出「一个词条单位」,但它**只用来量分支**,
 * 从没量过功法本身。于是第 47~51 轮补的二十余部功法,**同品阶之间的基座份量**没人比过。
 *
 * 按同一把尺折算后:
 *
 * ```text
 * 辅修 / 仙品:  我补的两部 3.90、4.13,而既有的三部是 1.10、1.35、1.89
 * ```
 *
 * 高出两倍多 —— 仙品辅修本该和同席同品的邻居一个量级。已收到 2.00 / 2.17。
 *
 * ## 判据
 *
 * 每个「席位 × 品阶」里,若有至少 3 部既有功法可作参照,则新补那一批的均值
 * 不许超出参照均值 **1.8 倍**、也不许低于 **0.5 倍**。
 *
 * 阈值取得宽:不同词条的真实价值随进度浮动(见上一节对发育向词条的说明),
 * 这里要抓的是「整批高出一个量级」,不是小数点上的差异。
 *
 * 上下限实测校准:既有内容里本来就有两处**刻意**的极值 ——
 * `向死而生诀`(秘术·灵品,0.42 倍:低血爆发流,基座刻意压薄靠濒死收益补)
 * 与 `道祖本源经`(主修·神品,1.86 倍:终局功法)。
 * 所以取 0.35 ~ 2.5,只拦真正「差一个量级」的那种。
 */
describe("功法基座平衡审计 · 同席位同品阶的份量不许整批跑偏", () => {
  /** 与上一节同一把尺:装备词条池的最低档 */
  const UNIT = (() => {
    const out = new Map<string, number>();
    for (const a of AFFIXES) {
      const unit = a.min / 100;
      const cur = out.get(a.key);
      out.set(a.key, cur === undefined ? unit : Math.min(cur, unit));
    }
    return out;
  })();

  function baseWeight(mods: Record<string, number | undefined>): number {
    let sum = 0;
    for (const [k, v] of Object.entries(mods)) {
      const unit = UNIT.get(k);
      if (unit) sum += (v ?? 0) / unit;
    }
    return sum;
  }

  it("每个「席位 × 品阶」里,该格功法的基座份量不呈两极", () => {
    const cells = new Map<string, { id: string; name: string; w: number }[]>();
    for (const def of GONGFA) {
      const key = `${def.type} / ${def.quality}`;
      const bucket = cells.get(key) ?? [];
      bucket.push({ id: def.id, name: def.name, w: baseWeight(def.baseMods ?? {}) });
      cells.set(key, bucket);
    }
    // 防空转:席位 × 品阶真的分出了不少格子
    expect(cells.size, "一格都没分到 —— 判据在空转").toBeGreaterThanOrEqual(10);

    const outliers: string[] = [];
    for (const [key, list] of cells) {
      if (list.length < 3) continue; // 少于三部时中位数不可信
      const sorted = [...list].sort((a, b) => a.w - b.w);
      const median = sorted[Math.floor(sorted.length / 2)]!.w;
      if (median <= 0) continue;
      for (const item of sorted) {
        const ratio = item.w / median;
        if (ratio > 2.5 || ratio < 0.35) {
          outliers.push(
            `${key}:${item.name} 折算 ${item.w.toFixed(2)},该格中位 ${median.toFixed(2)}(${ratio.toFixed(2)} 倍)`,
          );
        }
      }
    }
    expect(
      outliers,
      "这些功法的基座份量与同席位同品阶的邻居差了一个量级 —— 疑似整批写肥或写瘦:" +
        outliers.join("、"),
    ).toEqual([]);
  });
});
