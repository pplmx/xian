/**
 * 凡界路线骨架与节奏原型的不变式。
 *
 * ## 为什么要有这个 spec
 *
 * `mortalRouteShapes` 是**纯数据模块**(把常量表单独摘出来,免得存档校验为了读一张表
 * 把生成器、战斗模拟、构筑识别整条依赖链都拖进每个 store 用例)。
 *
 * 纯数据模块最容易没判据 —— 它没有函数可以调用,「跑一遍看看」不成立。
 * 全仓扫描时它是 8 个「既无同名 spec、也没有任何 spec 引用」的模块之一。
 *
 * 而它承载的东西不轻:`ROUTE_SHAPES` 决定每一世的空间推进节奏,
 * `RHYTHM_ARCHETYPES` 决定事件密度曲线,`REGION_NAME_TIER_BAND` 决定区域名
 * 能落到多远的位置上。这三张表定了玩法的手感,却没有一条判据。
 *
 * ## 判据守什么
 *
 * 守的是**设计意图**,不是某个具体数值 —— 数值还会调,意图不该漂:
 *
 * 1. 层级都落在凡界 1~20 之内(越界会取到不存在的地界)
 * 2. 每条路线**首段 ≤ 4**(开局不能直接甩进高段)、**末段 ≥ 12**(总得走到后期)
 * 3. 单调型路线严格递增;交错型路线**必须真的交错**(否则它与单调型没有区别)
 * 4. 路线与节奏的 id 都不重复(按 id 建索引的地方会静默丢掉后一条)
 * 5. 节奏曲线长度一致(生成时按段数重采样,长度不齐会让重采样口径分叉)
 */
import { describe, expect, it } from "vite-plus/test";
import { REGION_NAME_TIER_BAND, RHYTHM_ARCHETYPES, ROUTE_SHAPES } from "./mortalRouteShapes";
import { generateMortalWorld } from "./mortalWorldGen";
import { ENEMIES } from "@/data/enemies";

/** 凡界的层级范围 —— 1 阶(青云山麓)到 20 阶(鸿蒙裂隙) */
const MORTAL_TIER_MIN = 1;
const MORTAL_TIER_MAX = 20;

/**
 * 交错型路线 —— 它们**故意**不递增。
 *
 * 这两个 id 是白名单而不是「检测出来的」:若哪天有人把某条单调路线改成交错,
 * 白名单里没有它,下面的「单调型必须严格递增」会红。
 */
const WEAVE_ROUTE_IDS = new Set(["weave", "short_weave"]);

describe("凡界路线骨架 · 不变式", () => {
  it("每条路线的层级都落在凡界范围内", () => {
    const bad: string[] = [];
    for (const route of ROUTE_SHAPES) {
      for (const tier of route.tiers) {
        if (tier < MORTAL_TIER_MIN || tier > MORTAL_TIER_MAX) {
          bad.push(`${route.name}(${route.id}) 的 ${tier} 阶`);
        }
      }
    }
    expect(bad, "路线里有越界的层级 —— 会取到不存在的地界:" + bad.join("、")).toEqual([]);
  });

  it("首段不高于 4、末段不低于 12", () => {
    const bad: string[] = [];
    for (const route of ROUTE_SHAPES) {
      const first = route.tiers[0]!;
      const last = route.tiers[route.tiers.length - 1]!;
      // 交错型看末段的最大值,而不是最后写下的那个(它可能中途回落)
      const peak = WEAVE_ROUTE_IDS.has(route.id) ? Math.max(...route.tiers) : last;
      if (first > 4) bad.push(`${route.name} 首段 ${first}(开局太陡)`);
      if (peak < 12) bad.push(`${route.name} 最高只到 ${peak}(走不到后期)`);
    }
    expect(bad, "路线的首末段不合设计意图:" + bad.join("、")).toEqual([]);
  });

  it("单调型严格递增,交错型真的交错", () => {
    const bad: string[] = [];
    for (const route of ROUTE_SHAPES) {
      const isWeave = WEAVE_ROUTE_IDS.has(route.id);
      const monotone = route.tiers.every((t, i) => i === 0 || t > route.tiers[i - 1]!);
      if (isWeave && monotone) {
        bad.push(`${route.name} 被列为交错型,实际是单调递增 —— 那它和单调型没有区别`);
      }
      if (!isWeave && !monotone) {
        bad.push(`${route.name} 是单调型,却有回落 —— 要么改数据,要么加进 WEAVE_ROUTE_IDS`);
      }
    }
    expect(bad, bad.join("、")).toEqual([]);
  });

  it("路线与节奏的 id 都不重复", () => {
    const dupes: string[] = [];
    for (const [label, rows] of [
      ["路线", ROUTE_SHAPES],
      ["节奏", RHYTHM_ARCHETYPES],
    ] as const) {
      const seen = new Map<string, number>();
      for (const row of rows) seen.set(row.id, (seen.get(row.id) ?? 0) + 1);
      for (const [id, n] of seen) if (n > 1) dupes.push(`${label} id「${id}」被占 ${n} 次`);
    }
    expect(dupes, "id 重复 —— 按 id 建索引的地方会静默丢掉后一条:" + dupes.join("、")).toEqual([]);
  });

  it("节奏曲线长度一致,且都是正数", () => {
    const lengths = new Set(RHYTHM_ARCHETYPES.map((a) => a.curve.length));
    expect(
      lengths.size,
      `节奏曲线长度不一(${[...lengths].join("/")})—— 生成时按段数重采样,长度不齐会让口径分叉`,
    ).toBe(1);

    const bad: string[] = [];
    for (const arch of RHYTHM_ARCHETYPES) {
      for (const v of arch.curve) {
        if (!(v > 0)) bad.push(`${arch.name} 的曲线里有 ${v}`);
      }
    }
    expect(bad, "节奏曲线里出现非正数 —— 那一段会一个事件都不出:" + bad.join("、")).toEqual([]);
  });

  it("节奏原型真的各不相同", () => {
    /*
     * 「不同」是这张表存在的理由:文件头写着
     * 「`222222` 不是『事件少』,是**没有节奏设计**」。
     * 若两个原型曲线相同,它们就是同一个设计的两份拷贝。
     */
    const byCurve = new Map<string, string[]>();
    for (const arch of RHYTHM_ARCHETYPES) {
      const key = arch.curve.join(",");
      byCurve.set(key, [...(byCurve.get(key) ?? []), arch.name]);
    }
    const dupes = [...byCurve.values()].filter((v) => v.length > 1);
    expect(
      dupes.map((v) => v.join("/")),
      "这些节奏原型的曲线完全相同 —— 等于同一份设计写了两遍",
    ).toEqual([]);
  });

  it("反空转:表里有足够多的样本", () => {
    expect(ROUTE_SHAPES.length, "路线表空了").toBeGreaterThanOrEqual(6);
    expect(RHYTHM_ARCHETYPES.length, "节奏表空了").toBeGreaterThanOrEqual(4);
    // 区域名偏差容差必须是个正的小整数(0 会让区域名完全钉死,太大则失去约束)
    expect(REGION_NAME_TIER_BAND, "区域名偏差容差不在合理区间").toBeGreaterThan(0);
    expect(REGION_NAME_TIER_BAND, "区域名偏差容差太大 —— 等于没有约束").toBeLessThanOrEqual(5);
  });

  /**
   * 没有哪一条节奏是**平的** —— 包括那条叫「平稳」的。
   *
   * ## 缺口(第 90 轮实测)
   *
   * `RHYTHM_ARCHETYPES` 的注释写着:
   *
   * > `222222` 不是「事件少」,是**没有节奏设计**。这些原型让玩家能感觉到
   * > 「这一世前面平静,后面突然密集」,而不是「又一段每处两个」。
   *
   * 而表里第一条 `flat`(「平稳」)的曲线**正是 `[2,2,2,2,2,2]`** ——
   * 把旧毛病原样收进了新体系。生成出来的事件数逐段相同,
   * 玩家感受到的就是「又一段每处两个」。
   *
   * 已改成「从容」`[1,1,2,2,2,3]`:整体偏静,但不是平的。
   */
  it("没有一条节奏曲线是平的 —— 包括那条叫「平稳」的", () => {
    const flatOnes = RHYTHM_ARCHETYPES.filter((a) => new Set(a.curve).size === 1).map(
      (a) => `${a.name}(${a.curve.join(",")})`,
    );
    expect(
      flatOnes,
      "这些节奏的曲线每一档都一样 —— 注释自己说「222222 不是事件少,是没有节奏设计」:" +
        flatOnes.join("、"),
    ).toEqual([]);
  });

  it("每条节奏都真的有过起伏,且起伏方向各不相同", () => {
    /*
     * 反方向:光「不平」不够 —— 六条都写成 `[1,2,3,4,5,6]` 也都不平,但那是同一个设计六份拷贝。
     * 这里要求:任意两条节奏的曲线不能相同(上一组判据「节奏原型真的各不相同」已守),
     * 且每条至少有一处升降。
     */
    const noRise: string[] = [];
    for (const a of RHYTHM_ARCHETYPES) {
      const rises = a.curve.some((v, i) => i > 0 && v !== a.curve[i - 1]);
      if (!rises) noRise.push(`${a.name}(${a.curve.join(",")})`);
    }
    expect(noRise, "这些节奏从头到尾没变过一次 —— 等于平的那条:" + noRise.join("、")).toEqual([]);
  });
});

/**
 * 模板层的判据只查了「表本身」，`jitterTiers` 是生成时的扰动 —— 那是另一层。
 *
 * ## 缺口(第 80 轮实测)
 *
 * `mortalWorldGen.jitterTiers` 给非首段做 ±1 扰动。实测 900 世:
 *
 * ```text
 *   单调型路线出现重复层级 80 次(9%)
 *   seed1  earlyclimb: 2,7,13,16,16,18   ← 第 4、5 段都是 16 阶
 *   seed37 lateclimb:  2,2,6,8,14,19     ← 第 1、2 段都是 2 阶
 * ```
 *
 * 同一世里连着两处同难度区域,推进感就断了 —— 而这份骨架存在的理由正是
 * 「让六世的推进节奏不一样」。
 *
 * 根因有两处:① 模板里 `lateclimb`/`earlyclimb` 相邻段只差 1 阶;
 * ② `jitterTiers` 只做 clamp,没保证扰动后不低于前一段。两处都修了。
 *
 * ## 判据
 *
 * 直接跑真生成器 300 世,查三条:
 *
 * - 单调型路线**严格递增**(不重复、不回落)
 * - 交错型路线**允许回落**(否则它就不是交错型了)
 * - 层级始终落在凡界 1~20
 *
 * 用真生成器而不是复算扰动:扰动用的是 seed 派生的 rng,
 * 复算等于把 `jitterTiers` 抄一遍(第 67/70/71 轮踩过三次的坑)。
 */
describe("凡界生成 · 扰动后仍守路线形状", () => {
  const WEAVE_IDS = new Set(["weave", "short_weave"]);
  const worlds = Array.from({ length: 300 }, (_, i) => generateMortalWorld(i + 1));

  it("单调型路线生成后仍然严格递增", () => {
    const bad: string[] = [];
    for (const w of worlds) {
      if (WEAVE_IDS.has(w.shapeId)) continue;
      const tiers = w.chain.map((c) => c.tier);
      for (let i = 1; i < tiers.length; i += 1) {
        if (tiers[i]! <= tiers[i - 1]!) {
          bad.push(`seed${w.seed} ${w.shapeId}: ${tiers.join(",")}`);
          break;
        }
      }
    }
    expect(
      bad,
      "单调型路线扰动后出现持平或回落 —— 玩家会连着走两处同难度区域:" + bad.slice(0, 5).join(" / "),
    ).toEqual([]);
  });

  it("交错型路线仍然会回落 —— 别被扰动抹平成单调", () => {
    /*
     * 反方向:交错型的存在理由是「深浅交错」,若扰动把它抹平成递增,
     * 它就和别的路线没有区别了(而 `WEAVE_ROUTE_IDS` 还把它当交错型放着)。
     */
    const weaves = worlds.filter((w) => WEAVE_IDS.has(w.shapeId));
    expect(weaves.length, "300 世里一条交错型路线都没抽到").toBeGreaterThan(5);
    const flattened = weaves.filter((w) => {
      const tiers = w.chain.map((c) => c.tier);
      return tiers.every((t, i) => i === 0 || t > tiers[i - 1]!);
    });
    expect(
      flattened.map((w) => `seed${w.seed} ${w.shapeId}`),
      "交错型路线被扰动抹平成了严格递增 —— 它与单调型没有区别了",
    ).toEqual([]);
  });

  it("层级始终落在凡界范围,且首末段守住", () => {
    const bad: string[] = [];
    for (const w of worlds) {
      const tiers = w.chain.map((c) => c.tier);
      if (tiers.some((t) => t < 1 || t > 20)) bad.push(`seed${w.seed} 越界 ${tiers.join(",")}`);
      if (tiers[0]! > 4) bad.push(`seed${w.seed} 首段 ${tiers[0]}`);
      const peak = WEAVE_IDS.has(w.shapeId) ? Math.max(...tiers) : tiers[tiers.length - 1]!;
      if (peak < 12) bad.push(`seed${w.seed} 最高只到 ${peak}`);
    }
    expect(bad, "生成结果越出凡界或首末段失守:" + bad.slice(0, 5).join(" / ")).toEqual([]);
  });

  it("重采样不丢形状:段数少于原型时,两边仍是低、中间仍是高", () => {
    /*
     * ## 缺口(第 90 轮实测)
     *
     * `mortalWorldGen.resampleRhythm` 第一版是最近邻:
     * `curve[Math.round(i * (len-1) / (n-1))]` —— **必然丢中间值**。
     *
     * `mid`(「中段高压」)是 `[1,2,4,4,2,1]`,落到 4 段时映射到索引 `0,2,3,5`,
     * 输出 `[1,4,4,1]`:两个 `2` 都被跳过。原型的「前后低、中间高」
     * 塌成了「中间两段极高、两头极低」—— 而那正是它想避免的形状。
     *
     * 已改成分箱平均(均分成 n 段、每段取平均),`n=4` 时得到 `[1,3,4,2]`。
     *
     * ## 判据
     *
     * 不测 `resampleRhythm` 本身(它是私有函数),而是**测生成器的输出**:
     * 只要是「中段高压」这个原型,不论这一次生成到几段,
     * 中间那一段都该 ≥ 首段。
     */
    const MID_HIGH = "中段高压";
    const samples = worlds
      .filter((w) => w.rhythmName === MID_HIGH)
      .map((w) => w.chain.map((p) => p.eventTags.length))
      // 只挑段数为偶、形状可判的样本
      .filter((d) => d.length >= 4);

    expect(samples.length, "300 世里没抽到「中段高压」—— 判据在空转").toBeGreaterThan(3);

    /*
     * 比的不是「中段是不是峰值」—— 最近邻输出的 `[1,4,4,1]` 里中段**也是**峰值,
     * 那一版判据注入时照样绿(第一版就不够敏感)。
     *
     * 真正丢的是**渐变**:原型 `[1,2,4,4,2,1]` 从 1 到 4 中间隔着两级,
     * 而最近邻直接跳过去,首段到中段一步跨 3 级。分箱平均输出 `[1,3,4,2]`,
     * 最大相邻差是 2(1→3 与 3→4)。
     *
     * 判据:生成出来的相邻差,不得超过原型自身的最大相邻差。
     */
    const proto = RHYTHM_ARCHETYPES.find((a) => a.name === MID_HIGH)!.curve;
    const protoMaxJump = Math.max(...proto.slice(1).map((v, i) => Math.abs(v - proto[i]!)));

    const bad: string[] = [];
    for (const d of samples) {
      const jump = Math.max(...d.slice(1).map((v, i) => Math.abs(v - d[i]!)));
      if (jump > protoMaxJump) {
        bad.push(`[${d.join(",")}] 最大相邻差 ${jump} > 原型 ${protoMaxJump}`);
      }
    }
    expect(
      bad,
      `「中段高压」重采样后出现比原型更陡的跳变(原型最大相邻差 ${protoMaxJump})` +
        ` —— 最近邻把中间那两级跳过去了:` +
        bad.slice(0, 3).join(" / "),
    ).toEqual([]);
  });

  it("反空转:路线与节奏都真的被抽到了", () => {
    const shapes = new Set(worlds.map((w) => w.shapeId));
    const rhythms = new Set(worlds.map((w) => w.rhythmId));
    expect(shapes.size, "300 世里只抽到几种路线 —— 选择逻辑坏了").toBe(ROUTE_SHAPES.length);
    expect(rhythms.size, "300 世里只抽到几种节奏").toBe(RHYTHM_ARCHETYPES.length);
  });
});

/**
 * 每段的首领得跟得上那一层的难度 —— 尤其**末段不许拿远古首领凑数**。
 *
 * ## 缺口(第 91 轮实测)
 *
 * 凡界首领一阶一个(20 个),而一条路线有 6 段。`pickBoss` 原来纯按
 * 「离目标层级最近」取,于是一个 t13 段可以拿走 `e_citylord`(敌 t14)、
 * 一个 t16 段可以拿走 `e_voidgod`(敌 t18)——
 * **前面的段把后面段的首领提前用掉了**。等走到 t20 段,近邻全被占,
 * 只能退到 t13 的 `e_yaosheng`。
 *
 * 实测 300 世:
 *
 * ```text
 *                    修前     修后
 *   末段层级差 最小   -17      -5
 *   末段层级差 中位    -7      -2
 *   严重负差(<-5)    172 世    0 世
 * ```
 *
 * 玩家在最后一关遇到的是**比第三段还弱**的首领 —— 而末段本该是最硬的一关。
 *
 * ## 修法
 *
 * 候选池先滤掉「比本段弱五级以上」的,再就近取。只加下限,不加上限 ——
 * 试过同时加「不高于本段 +2」,结果 t16 段只能用 t14~t18 的四个(已被占完),
 * 退到 `e_general`(敌 t6),差 -10:总量降了但最坏的一处更糟,已回退。
 */
describe("凡界生成 · 首领跟得上层级", () => {
  const worlds = Array.from({ length: 300 }, (_, i) => generateMortalWorld(i + 1));

  it("末段首领不比本段弱五级以上", () => {
    const tooWeak: string[] = [];
    for (const w of worlds) {
      const last = w.chain[w.chain.length - 1]!;
      const boss = ENEMIES.find((e) => e.id === last.boss);
      if (!boss) continue;
      const gap = boss.tier - last.tier;
      if (gap < -5) {
        tooWeak.push(`seed${w.seed} t${last.tier}→${boss.id}(敌t${boss.tier}, 差 ${gap})`);
      }
    }
    expect(
      tooWeak,
      "末段首领比本段弱五级以上 —— 最后一关遇到的是远古首领:" + tooWeak.slice(0, 4).join(" / "),
    ).toEqual([]);
  });

  it("首领的层级差整体不偏负", () => {
    /*
     * 反空转 + 全局口径:上面那条只看末段。若修法只是把末段抬起来、
     * 而中段全变成远古首领,这条会红。
     */
    const gaps: number[] = [];
    for (const w of worlds) {
      for (const p of w.chain) {
        const boss = ENEMIES.find((e) => e.id === p.boss);
        if (boss) gaps.push(boss.tier - p.tier);
      }
    }
    expect(gaps.length, "一个首领都没量到 —— 判据在空转").toBeGreaterThan(300);
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)]!;
    expect(
      median,
      `首领层级差的中位数是 ${median} —— 一半以上的首领比所在段弱`,
    ).toBeGreaterThanOrEqual(-3);
  });

  it("反空转:首领池覆盖凡界的每一层", () => {
    /*
     * 若哪天凡界首领池变得比路线段数还少,「就近取」就必然跨级 ——
     * 那时该补内容,而不是继续调选择逻辑。
     */
    const mortalBosses = ENEMIES.filter((e) => e.archetype !== undefined && e.tier <= 20);
    expect(
      mortalBosses.length,
      `凡界首领只有 ${mortalBosses.length} 个 —— 覆盖不了 20 层,选择逻辑再巧也没用`,
    ).toBeGreaterThanOrEqual(20);
  });
});
