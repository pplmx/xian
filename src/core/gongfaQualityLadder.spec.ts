/**
 * 功法九档须齐 —— 地品不许是空的。
 *
 * ## 缺口:九档里唯独地品一门功法都没有
 *
 * 把 `GONGFA` 按品质档摊开数一遍:
 *
 * ```text
 * 凡 3 · 良 8 · 精 7 · 灵 9 · 玄 9 · 地 0 · 天 7 · 仙 11 · 神 14
 * ```
 *
 * 「地 0」这一格此前没有任何人写过 —— `data/gongfa.ts` 的文件头只写着
 * 「68 部:主修 28 / 辅修 24 / 秘术 16」,没有一张品阶分布表,所以这一档
 * 空了多久都没人看见。
 *
 * 旁证在 `data/gongfaBranches.ts` 的头注:悟道分支的份量阶梯是
 *
 * ```text
 * 凡品 3.5 · 良品 4~5 · 精品 5~6 · 灵品 7~7.5 · 玄品 7.5~9 · 天品 11~12 · 仙品 14
 * ```
 *
 * 也是从玄品直接跳到天品。两处各自独立地跳过了同一档,说明它是**从没被写过**,
 * 不是被有意留空。
 *
 * ## 与另外两类对照,判据为什么不一样
 *
 * 灵兽那边是「九档中补齐七档」,**明写在 `data/pets.ts` 文件头的设计取舍**
 * (按神话谱系收,不硬凑凡品/良品),故那一类只守「高品不弱于低品」;
 * 法宝那边没有一句「天品留空」的说法,故刚补了一件守「九档皆不空」
 * (见 core/artifactQualityLadder.spec)。功法这边也没有任何一句「地品留空」——
 * 而地品是**中间那一档**,不是尾巴:玩家从玄品一路参悟上来,在玄品与天品之间
 * 撞上一段没有功法可参的路,那不是取舍,是断档。
 *
 * ## 判据守什么
 *
 * 只说一件事:**九档每一档都至少有一部功法**。它不规定地品该有几部、在哪一境、
 * 主修还是辅修、给什么词条 —— 那些归别的判据(`gongfaBranch.spec` 守分支份量阶梯、
 * `gongfaRealmCoverage.spec` 守每境有非主修、`contentDensity.spec` 守每境有新功法)。
 *
 * 另有一条钉住文件头那张分布表与真实件数同源:表若会撒谎,这一档再空下去也没人知道。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { GONGFA } from "@/data/gongfa";
import { QUALITIES, qualityDef } from "@/data/qualities";

/** 各档功法件数,按品质 rank 索引 */
function countByQuality(): number[] {
  const counts = new Array(QUALITIES.length).fill(0) as number[];
  for (const def of GONGFA) {
    const rank = qualityDef(def.quality).rank;
    counts[rank] = (counts[rank] ?? 0) + 1;
  }
  return counts;
}

/** 把分布读成一行,红的时候直接贴在消息里 */
function describeCounts(counts: number[]): string {
  return QUALITIES.map((q) => `${q.name} ${counts[q.rank] ?? 0}`).join(" · ");
}

describe("功法九档 · 地品不许空缺", () => {
  it("地品至少有一部功法", () => {
    const counts = countByQuality();
    const earthRank = qualityDef("earth").rank;
    expect(
      counts[earthRank],
      `功法库里地品 ${counts[earthRank] ?? 0} 部 —— 九档里唯独这一档是空的;` +
        `玩家从玄品参悟上来,在玄品与天品之间会撞上一段没有功法可参的路。` +
        `当前分布:${describeCounts(counts)}`,
    ).toBeGreaterThan(0);
  });

  it("九档都有货 —— 不只地品,哪一档空了都是同一类缺口", () => {
    const counts = countByQuality();
    const empty = QUALITIES.filter((q) => (counts[q.rank] ?? 0) === 0).map((q) => q.name);
    expect(
      empty,
      `这些档位一部功法都没有:${empty.join(" / ")} —— 当前分布:${describeCounts(counts)}`,
    ).toEqual([]);
  });

  it("文件头的品阶分布表与实际件数对得上 —— 表不许撒谎", () => {
    const header = readSource("src/data/gongfa.ts").slice(0, 2500);
    const counts = countByQuality();
    const m = header.match(/品阶分布[^\n]*\n?[^\n]*/);
    expect(m, "文件头该有一份品阶分布表(否则这一档空着也没人看得见)").not.toBeNull();
    // 表里逐档写「凡 N · 良 N …」,每一个数都必须与实物相等
    const wrong: string[] = [];
    let seen = 0;
    for (const q of QUALITIES) {
      const hit = header.match(new RegExp(`${q.name}\\s*(\\d+)`));
      if (!hit) continue;
      seen += 1;
      const shown = Number(hit[1]);
      const actual = counts[q.rank] ?? 0;
      if (shown !== actual) wrong.push(`${q.name}:表写 ${shown},实际 ${actual}`);
    }
    expect(seen, "分布表一档都没解析到 —— 判据退化成空转了").toBeGreaterThan(6);
    expect(wrong, `文件头的品阶分布表已过期:\n  ${wrong.join("\n  ")}`).toEqual([]);
  });

  it("反空转:确实量到了功法,且不止一档有货", () => {
    expect(GONGFA.length, "一部功法都没量到").toBeGreaterThan(0);
    const filled = countByQuality().filter((n) => n > 0).length;
    expect(filled, "只有一档有功法 —— 那是另一条判据的事").toBeGreaterThan(3);
  });
});
