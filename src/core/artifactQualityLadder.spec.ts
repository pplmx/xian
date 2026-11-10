/**
 * 法宝九档须齐 —— 天品不许是空的。
 *
 * ## 缺口:九档里唯独天品一件法宝都没有
 *
 * `data/artifacts.ts` 的文件头如实列着各档的分布:
 *
 * ```text
 * 凡 12(t1-12)· 良 6(t13-18)· 精 4(t21-23)· 灵 6(t23-27)
 * · 玄 6(t28-29)· 地 5(t30-31)· 天 0 · 仙 1(t32)· 神 5(t19/20/31/32)
 * ```
 *
 * 「天 0」被记在案,但它与其他八档并列 —— 那是**如实记录**,不是设计意图。
 * 反证在 `docs/design.md`:
 *
 *   > 各处都照做了:装备格、功法书目、法宝行卡、候选件、坊市货架,
 *   > 天品起都盖一枚阴文小章。
 *
 * 天品被当成一个正常存在的档在界面语言里使用,而法宝池里那一档是空的 ——
 * 玩家从地品一路炼上来,在地品之后、仙品之前会遇到一段没有任何东西可捡的路。
 *
 * ## 判据为什么守「齐」而不是「每档至少一件」
 *
 * 灵兽那边「品阶阶梯已补齐为九档中的七档」是**明写在文件头里的设计取舍**
 * (灵兽按神话谱系收,不硬凑)。法宝这边没有任何一句「天品留空」的说法,
 * 而文件头的分布表把九档一起列了出来 —— 两种意图不一样,判据也不该一样。
 *
 * 故这条只说一件事:**法宝的九档分布表里,天品不该是 0**。
 * 它不规定天品该有几件、在哪一档、什么效果 —— 那些归别的判据
 * (artifactLadder 守同族不回落、contentReachability 守可得)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { ARTIFACTS } from "@/data/artifacts";
import { QUALITIES, qualityDef } from "@/data/qualities";
import { AFFIXES } from "@/data/affixes";
import { GONGFA } from "@/data/gongfa";
import { GONGFA_BRANCHES } from "@/data/gongfaBranches";
import { PETS } from "@/data/pets";

/** 各档法宝件数,按品质 rank 索引 */
function countByQuality(): number[] {
  const counts = new Array(QUALITIES.length).fill(0) as number[];
  for (const def of ARTIFACTS) {
    const rank = qualityDef(def.quality).rank;
    counts[rank] = (counts[rank] ?? 0) + 1;
  }
  return counts;
}

describe("法宝九档 · 天品不许空缺", () => {
  it("天品至少有一件", () => {
    const counts = countByQuality();
    const heavenRank = qualityDef("heaven").rank;
    expect(
      counts[heavenRank],
      `法宝池里天品 ${counts[heavenRank] ?? 0} 件 —— 九档里唯独这一档是空的;` +
        `玩家从地品炼上来会撞上一段没东西可捡的路`,
    ).toBeGreaterThan(0);
  });

  it("九档都有货 —— 不只天品,哪一档空了都是同一类缺口", () => {
    const counts = countByQuality();
    const empty = QUALITIES.filter((q) => counts[q.rank] === 0).map((q) => q.name);
    expect(empty, `这些档位一件法宝都没有:${empty.join(" / ")}`).toEqual([]);
  });

  it("文件头的分布表与实际件数对得上 —— 表不许撒谎", () => {
    const header = readSource("src/data/artifacts.ts").slice(0, 2000);
    const heavenRank = qualityDef("heaven").rank;
    const actual = countByQuality()[heavenRank] ?? 0;
    // 表里那句「天 N」必须与真实件数相等
    const m = header.match(/天\s*(\d+)/);
    expect(m, "文件头该有一份品阶分布表").not.toBeNull();
    expect(Number(m![1]), `文件头写着「天 ${m![1]}」,实际 ${actual} 件 —— 表和实物必须同源`).toBe(
      actual,
    );
  });

  it("新加的那件是法宝该有的形状 —— 主动、被动、名头都得在", () => {
    const heavenRank = qualityDef("heaven").rank;
    const divines = ARTIFACTS.filter((d) => qualityDef(d.quality).rank === heavenRank);
    expect(divines.length).toBeGreaterThan(0);
    for (const def of divines) {
      expect(def.name.length, "要有名字").toBeGreaterThan(0);
      expect(def.desc.length, "要有一句出身").toBeGreaterThan(0);
      expect(Object.keys(def.passive).length, `${def.name} 要有被动`).toBeGreaterThan(0);
      expect(def.active.name.length, `${def.name} 的主动要有名`).toBeGreaterThan(0);
      expect(def.active.interval, `${def.name} 的主动要有节拍`).toBeGreaterThan(0);
    }
  });
});

/**
 * 法宝被动不许超过装备词条的上限 —— 同一个词条,不能法宝给得比装备多。
 *
 * ## 实测(第 56 轮)
 *
 * 按装备词条池的上限逐条核对,`帝阙神符`(玄品·t29)的 `breakthroughRate` 是 **0.123**,
 * 而装备池里同一词条的上限是 **0.06** —— 整整两倍。
 *
 * `breakthroughRate` 直接加在突破成功率上(`core/breakthrough`),所以这一条被动
 * 等于「+12.3% 突破成功率」,比任何一件装备都强一倍。
 *
 * 这是既有内容,不是某一轮补进来的;此前没有判据看着这条线
 * (`artifactLadder` 守的是**主动神通**的族内不回落,`artifactQualityLadder` 守的是分布)。
 *
 * ## 判据
 *
 * 法宝被动的每个词条,|值| 都不许超过装备池里同词条的最高档。
 * 只核装备池里**有的**词条 —— 法宝可以用装备没有的词条(如 `lifesteal`),
 * 那些没有可比的尺,不在此列。
 *
 * 容差 1e-6:被动数值经过品质倍率与等级倍率的两次乘法,末位会有浮点残差。
 */
describe("法宝被动 · 不许超过装备同名词条的上限", () => {
  it("每件法宝的每条被动,都不越过装备池的最高档", () => {
    const caps = new Map<string, number>();
    for (const affix of AFFIXES) {
      const key = (affix as { key?: string }).key;
      if (!key) continue;
      caps.set(key, Math.max(caps.get(key) ?? 0, affix.max / 100));
    }
    expect(caps.size, "一件装备词条都没取到 —— 判据在空转").toBeGreaterThan(20);

    const over: string[] = [];
    for (const def of ARTIFACTS) {
      for (const [key, raw] of Object.entries(def.passive ?? {})) {
        const cap = caps.get(key);
        if (cap === undefined) continue;
        const value = Math.abs(raw as number);
        if (value > cap + 1e-6) {
          over.push(
            `${def.name}(${def.quality}) 的 ${key}=${value.toFixed(3)} 超过装备上限 ${cap}`,
          );
        }
      }
    }
    expect(
      over,
      "这些法宝被动超过了装备池里同词条的最高档 —— 同一个词条法宝不该给得比装备多:" +
        over.join("、"),
    ).toEqual([]);
  });
});

/**
 * 「硬属性」越过内容表 —— `accuracy` 是唯一一个直接改判定的词条。
 *
 * ## 为什么单挑这一条
 *
 * `core/combat` 里它是一句减法:
 *
 * ```ts
 * const dodge = Math.min(0.95, Math.max(0, modOf(tMods, "dodgeRate") - modOf(aMods, "accuracy")));
 * ```
 *
 * 也就是说 `accuracy` **不衰减、不封顶**,给多少就削掉对面多少闪避。别的词条
 * (暴击率、减伤)都有软阈值或硬底,越界了会被引擎收住;这一条不会。
 *
 * 实测(第 57 轮):我给「灵照无方」写的 `accuracy: 0.18`,而装备池上限是 **0.14** ——
 * 越界 29%,且它会**真的**在判定里兑现(对面 18% 以内的闪避全废)。
 *
 * ## 判据
 *
 * 四张内容表(功法基座 / 悟道分支 / 法宝被动 / 灵兽 mods)的 `accuracy`,
 * 都不许超过装备池里同词条的最高档。
 *
 * 注:功法**基座**的 `cultivationSpeed` 等词条**不在此列** —— 实测主修的修速
 * 最高给到 0.5,而词条上限 0.32,那是设计(高境界主修本就该更快),不是越界。
 * 只有 `accuracy` 这种直接改判定的硬属性才用这条线。
 */
describe("硬属性 · accuracy 不许在任一张内容表里越过装备上限", () => {
  it("功法基座 / 分支 / 法宝被动 / 灵兽 里的 accuracy 都在装备上限内", () => {
    const cap = Math.max(
      ...AFFIXES.filter((a) => (a as { key?: string }).key === "accuracy").map((a) => a.max / 100),
    );
    expect(cap, "装备池里没有 accuracy 词条 —— 判据失去了对照").toBeGreaterThan(0);

    const over: string[] = [];
    const check = (
      label: string,
      name: string,
      mods: Record<string, number | undefined> | undefined,
    ) => {
      const value = mods?.accuracy;
      if (value === undefined) return;
      if (Math.abs(value) > cap + 1e-9) {
        over.push(`${label}「${name}」accuracy=${value.toFixed(3)} 超过装备上限 ${cap}`);
      }
    };
    for (const def of GONGFA)
      check("功法", def.name, def.baseMods as Record<string, number | undefined>);
    for (const br of GONGFA_BRANCHES)
      check("分支", br.name, br.mods as Record<string, number | undefined>);
    for (const def of ARTIFACTS)
      check("法宝", def.name, def.passive as Record<string, number | undefined>);
    for (const pet of PETS) check("灵兽", pet.name, pet.mods as Record<string, number | undefined>);

    expect(
      over,
      `这些 accuracy 越过了装备上限 —— 它会不衰减地削掉对面闪避,越界直接兑现:` + over.join("、"),
    ).toEqual([]);
  });
});
