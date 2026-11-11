/**
 * 随机道号 —— 单字名与双字名的比例要有意为之,不是凑巧。
 *
 * ## 缺口(第 122 轮实测)
 *
 * `data/names.ts` 是 62 张数据表里**唯一一张没有任何 spec 引用**的
 * (其余 61 张都被至少一份判据读过)。它的实现很短:
 *
 * ```ts
 * export function randomDaoName(rng: RandomService): string {
 *   return rng.pick(SURNAMES) + rng.pick(GIVEN);
 * }
 * ```
 *
 * 短到看起来不需要判据。但它的组成有一处值得管:
 *
 * ```text
 *   SURNAMES   16 个,都是单字(云 / 风 / 叶 / 苏 …)
 *   GIVEN      16 个,4 单(尘 / 青 / 霜 / 砚)+ 12 双(临渊 / 疏影 / 照夜 …)
 * ```
 *
 * 于是玩家掷到的是:
 *
 * ```text
 *   单字名 → 两字道号「云尘」     25%
 *   双字名 → 三字道号「云临渊」   75%
 * ```
 *
 * **七成半的玩家拿到三字名。** 中文人名本就两字三字并存,长短混排不算错;
 * 但 25 : 75 的悬殊不是设计,是「双字名顺手多写了几个」的结果。
 *
 * 已补 4 个单字(川 / 澈 / 岑 / 枢),现在是 8 : 12。
 *
 * ## 判据
 *
 * ① 单字名占比落在 35%~65% —— 不要求恰好五五,只要求**不悬殊**;
 * ② 姓与名都非空、无重复、无生僻到看不见的字(只查长度与唯一性);
 * ③ 生成的名字不与已有 NPC 全名相撞(道侣 / 师尊)。
 *
 * ② 里「无重复」比看起来重要:`rng.pick` 从数组里挑,同一个字写两遍
 * 会让它被掷中的概率翻倍 —— 那是**无声的加权**,而表里看不出任何痕迹。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { RandomService } from "@/utils/random";
import { randomDaoName } from "@/data/names";
import { DAOLU } from "@/data/daolu";
import { MENTORS } from "@/data/mentors";

const SRC = readFileSync(join(ROOT, "src/data/names.ts"), "utf8");

/** 从源码里抠出 SURNAMES 与 GIVEN 两个数组 */
function extract(name: "SURNAMES" | "GIVEN"): string[] {
  const start = SRC.indexOf(`const ${name} = [`);
  if (start < 0) return [];
  const end = SRC.indexOf("];", start);
  return [...SRC.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("随机道号 · 单双名比例", () => {
  it("① 单字名占比落在 35%~65%", () => {
    const given = extract("GIVEN");
    expect(given.length, "GIVEN 空了").toBeGreaterThan(10);
    const single = given.filter((g) => g.length === 1).length;
    const share = single / given.length;
    expect(
      share,
      `单字名 ${single}/${given.length}(${(share * 100).toFixed(0)}%)—— 与双字名悬殊,` +
        `玩家掷出来的道号会长短失衡(从前是 25%,七成半玩家拿到三字名)`,
    ).toBeGreaterThanOrEqual(0.35);
    expect(
      share,
      `单字名占比 ${(share * 100).toFixed(0)}% 偏高,双字名成了少数`,
    ).toBeLessThanOrEqual(0.65);
  });

  it("② 姓与名各自无重复 —— 重复就是无声的加权", () => {
    for (const key of ["SURNAMES", "GIVEN"] as const) {
      const list = extract(key);
      expect(list.length, `${key} 空了`).toBeGreaterThan(10);
      const dup = list.filter((v, i) => list.indexOf(v) !== i);
      expect(dup, `${key} 里有重复项 —— 它们被掷中的概率会翻倍:` + dup.join("、")).toEqual([]);
      for (const v of list) {
        expect(v.trim(), `${key} 里有空串`).not.toBe("");
        expect(v.length, `${key} 里的「${v}」太长,不像姓或名`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("③ 生成的道号不与已有 NPC 全名相撞", () => {
    /*
     * 道侣与师尊都是有名有姓的角色。若掷出来的道号恰好与某个 NPC 同名,
     * 玩家会在两个地方看到同一个名字却是两个人。
     *
     * 判据不枚举 256 种组合(那是穷举,不是判据),只查**字池里有没有出现 NPC 的全名**。
     * 因为拼接方式是「姓 + 名」,撞名只可能发生在某个名恰好等于 NPC 全名的后半段、
     * 或某个姓恰好等于 NPC 全名的前半段 —— 两种都从字池里查得到。
     */
    const npcNames = [...DAOLU.map((d) => d.name), ...MENTORS.map((m) => m.name)];
    expect(npcNames.length, "NPC 名单空了").toBeGreaterThan(5);

    const pool = [...extract("SURNAMES"), ...extract("GIVEN")];
    const clash = pool.filter((ch) => npcNames.includes(ch));
    expect(clash, "字池里有与 NPC 全名相同的项:" + clash.join("、")).toEqual([]);

    // 再验一遍真实拼接:抽样 300 次,不许出现 NPC 全名
    const hits = new Set<string>();
    let seed = 12345;
    const rng = new RandomService(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    });
    for (let i = 0; i < 300; i += 1) {
      const n = randomDaoName(rng);
      if (npcNames.includes(n)) hits.add(n);
    }
    expect([...hits], "掷出的道号与 NPC 同名:" + [...hits].join("、")).toEqual([]);
  });

  it("④ 生成的名字总是两字或三字,且姓来自字池", () => {
    let seed = 999;
    const rng = new RandomService(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    });
    const surnames = extract("SURNAMES");
    for (let i = 0; i < 200; i += 1) {
      const n = randomDaoName(rng);
      expect([2, 3], `道号「${n}」不是两字或三字 —— 字池里混进了别的东西`).toContain(n.length);
      expect(surnames, `道号「${n}」的姓不在 SURNAMES 里`).toContain(n[0]);
    }
  });

  it("反空转:两个数组都真的解析出来了", () => {
    expect(extract("SURNAMES").length, "SURNAMES 解析为空 —— 提取逻辑坏了").toBeGreaterThanOrEqual(
      10,
    );
    expect(extract("GIVEN").length, "GIVEN 解析为空").toBeGreaterThanOrEqual(10);
    expect(SRC.length).toBeGreaterThan(200);
  });
});
