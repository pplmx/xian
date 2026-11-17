/**
 * 剑系与火系各补三则 —— 而「补了」不等于「玩得到」。
 *
 * ## 由来（第 483 轮）
 *
 * 第 482 轮给 `ice` 补了三则（4 → 7）。补完再看密度:
 *
 * ```text
 * 标签      事件数   地界数
 * sword      4        1        ← 最薄
 * fire       5        1
 * ice        7        1
 * ```
 *
 * `sword` 与 `fire` 是剩下两处最薄的。它们各只有一处地界（剑冢 / 赤炎火域），
 * 而那是两个高阶地界 —— 玩家打到那里时，四则事件会很快撞完。
 *
 * ## 与前一轮相同的两条纪律
 *
 * ① **不带 `general`** —— 带了就能出现在全图 44 处，那不是「剑系内容」；
 * ② **境界带要与地界的准入门槛对得上** —— 剑冢(10) / 赤炎火域(7) 都在中层。
 *
 * ## 判据
 *
 * ① 六条都在表里，且各带 sword / fire 标签；
 * ② 可出现的地界数少于全图一半，且每一处都要有那个标签；
 * ③ 每条至少两个选项；
 * ④ 境界带落在能到那些地界的范围内。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";

const SWORD_IDS = ["ev_jianzhong_wendao", "ev_duanjian_chonglian", "ev_jianqi_chenghe"];
const FIRE_IDS = ["ev_huoyu_duanshi", "ev_dihuo_wenlu", "ev_huizhong_jiushi"];

describe("剑系与火系 · 各补三则", () => {
  it("① 六条都在事件表里，且各带 sword / fire 标签", () => {
    for (const id of SWORD_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 sword 标签`).toContain("sword");
    }
    for (const id of FIRE_IDS) {
      const e = EVENTS.find((x) => x.id === id);
      expect(e, `${id} 不在事件表里`).toBeDefined();
      expect(e!.tags, `${id} 没带 fire 标签`).toContain("fire");
    }
  });

  it("② 可出现的地界数少于全图一半，且每一处都有那个标签", () => {
    const all = REGIONS.length;
    const cases: Array<[string[], string]> = [
      [SWORD_IDS, "sword"],
      [FIRE_IDS, "fire"],
    ];
    for (const [ids, tag] of cases) {
      for (const id of ids) {
        const e = EVENTS.find((x) => x.id === id)!;
        const hit = REGIONS.filter((r) => e.tags.some((t) => r.eventTags.includes(t)));
        expect(
          hit.length,
          `${id} 能出现在 ${hit.length}/${all} 处 —— 它已经是通用事件了`,
        ).toBeLessThan(all / 2);
        const wrong = hit.filter((r) => !r.eventTags.includes(tag));
        expect(
          wrong.map((r) => r.name),
          `${id} 落到了与 ${tag} 无关的地界`,
        ).toEqual([]);
      }
    }
  });

  it("③ 每条至少两个选项", () => {
    for (const id of [...SWORD_IDS, ...FIRE_IDS]) {
      const e = EVENTS.find((x) => x.id === id)!;
      expect(e.choices.length, `${id} 只有一个选项`).toBeGreaterThanOrEqual(2);
    }
  });

  it("④ 境界带落在能到那些地界的范围内", () => {
    const cases: Array<[string[], string]> = [
      [SWORD_IDS, "sword"],
      [FIRE_IDS, "fire"],
    ];
    for (const [ids, tag] of cases) {
      const regs = REGIONS.filter((r) => r.eventTags.includes(tag));
      const lo = Math.min(...regs.map((r) => r.minRealm));
      for (const id of ids) {
        const e = EVENTS.find((x) => x.id === id)!;
        expect(e.minRealm ?? 0, `${id} 的最低境界高于所有 ${tag} 地界的门槛`).toBeLessThanOrEqual(
          lo + 4,
        );
      }
    }
  });
});
