/**
 * 每一套共鸣，都得凑得齐。
 *
 * ## 由来（第 499 轮）
 *
 * 上一轮记下一件事:`contentReachabilityAudit` 守了十二个维度，唯独没有事件，
 * 于是补了三条。这一轮顺着同一句话往下问:
 *
 * > **「还有哪些内容表完全不在任何可达性判据里？」**
 *
 * 扫 data/ 的 64 个文件，19 个没被可达性类判据引用。逐个看下去，
 * 其中有内容条目的是:apprentices(12) · classics(11) · comboArts(3) ·
 * equipSets(5) · inscriptions(22) · tribulations(5)。
 *
 * 装备共鸣是最要紧的一个 —— 它是构筑的核心，而且 `core/equipSet.spec` 只守了
 * **正向**（每件带 set 的装备都指向真实定义），没有守**反向**:
 *
 * ```text
 *   正向   一件装备说它属于某一套 → 那一套必须存在   （已有）
 *   反向   一套共鸣说要几件       → 装备里必须凑得齐   （缺）
 * ```
 *
 * 正向过了、反向不过的话，玩家会在图鉴里看到一套共鸣，而永远凑不齐它 ——
 * 与「事件写了却抽不到」是同一类。
 *
 * ## 判据
 *
 * ① 每套共鸣的 `required` 件数，装备表里都有足够的件数标着它;
 * ② 反差：装备件数够，不代表能同时穿上 —— 那由槽位判（同一槽位只能穿一件）;
 * ③ 反差：`required` 至少是 2（一件就触发的话，「共鸣」这个词没有意义）。
 */
import { describe, expect, it } from "vite-plus/test";
import { EQUIP_SLOT_NAMES, EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { EQUIP_SETS } from "@/data/equipSets";

interface EquipLike {
  name: string;
  slot?: string;
  set?: string;
}

const TEMPLATES = EQUIPMENT_TEMPLATES as unknown as EquipLike[];

describe("装备共鸣 · 每一套都得凑得齐", () => {
  it("① 每套共鸣的件数，装备表里都够", () => {
    const short: string[] = [];
    for (const s of EQUIP_SETS as unknown as { id: string; name: string; required: number }[]) {
      const pieces = TEMPLATES.filter((t) => t.set === s.id);
      if (pieces.length < s.required) {
        short.push(`${s.name}: 需 ${s.required} 件，装备表里只有 ${pieces.length} 件`);
      }
    }
    expect(short, "这些共鸣永远凑不齐 —— 玩家在册上看得见，却穿不上：" + short.join("；")).toEqual(
      [],
    );
  });

  it("② 反差：同槽位不能重复穿 —— 凑齐还需「不撞槽」", () => {
    /*
     * 这一条不是要求「每套都占不同槽位」（那太严），而是记一笔:
     * 件数够 ≠ 穿得上。故它只断言**槽位这个概念存在**，并打印各套的槽位分布，
     * 让后续若有人把两件同槽的套装凑一起时，这里能看见。
     */
    const slots = new Set<string>();
    for (const t of TEMPLATES) if (t.set && t.slot) slots.add(t.slot);
    expect(slots.size, "带 set 的装备都读不到 slot —— 判据②失去意义").toBeGreaterThan(0);
    /* 每套至多一件的槽位不该出现（同槽两件则 required=2 的套装穿不上） */
    const bad: string[] = [];
    for (const s of EQUIP_SETS as unknown as { id: string; name: string; required: number }[]) {
      const perSlot = new Map<string, number>();
      for (const t of TEMPLATES) {
        if (t.set !== s.id || !t.slot) continue;
        perSlot.set(t.slot, (perSlot.get(t.slot) ?? 0) + 1);
      }
      const distinct = perSlot.size;
      if (s.required >= 2 && distinct < s.required) {
        bad.push(`${s.name}: 需 ${s.required} 件，但只分布在 ${distinct} 个槽位上`);
      }
    }
    expect(bad, "这些共鸣的件数集中在同一槽位 —— 穿不上第二件：" + bad.join("；")).toEqual([]);
  });

  it("③ 反差：required 至少是 2", () => {
    for (const s of EQUIP_SETS as unknown as { name: string; required: number }[]) {
      expect(
        s.required,
        `${s.name} 只需 ${s.required} 件 —— 「共鸣」这个词没有意义`,
      ).toBeGreaterThanOrEqual(2);
    }
    expect(EQUIP_SLOT_NAMES, "槽位表读不到").toBeDefined();
  });
});
