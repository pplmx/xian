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
