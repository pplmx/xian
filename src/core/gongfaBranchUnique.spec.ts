/**
 * 悟道分支 —— 两部功法的「三条道」不该是同一组。
 *
 * ## 复现:《混元无极经》是《混沌一气功》的放大版
 *
 * 天品《混沌一气功》(境 6)与神品《混元无极经》(境 18)的三条分支逐条对得上:
 *
 * ```text
 * 化形  一气化形,四象俱全 / 混元化形,四象俱足   attack+def+hp 同结构
 * 归元  万法归元,道基自厚 / 万法归元,道基自厚   ← 描述一字不差
 * 开天  混沌开天,一击破界 / 无极开天,一击破界   ← 只改两个字
 * ```
 *
 * 数值约两倍(境界不同,该涨),但**名字、句式、词条组合全同** —— 玩家从人间界
 * 一路练到神界,翻开神品功法,看到的是当年那三条道的放大版。
 *
 * ## 为什么这一处要紧
 *
 * 悟道是全作唯一**一经择定终身不改**的选择(见 AGENTS「悟道是满级后的一次性选择」)。
 * 它存在的理由是「同一部功法因此走出完全不同的流派」—— 若两部功法给出同一组
 * 三选一,那句「完全不同的流派」就成了同一组选项的二周目。
 *
 * 而 `data/gongfaBranches.ts` 的文件头自己写着:
 *
 *   > 分支写什么:长在功法自己的性子上 —— 每条分支都从该功法的立意与既有词条里
 *   > 长出来…… 分支不是发词条的由头,而是把这部功法本来就在说的话说到底。
 *
 * 《混沌一气功》说的是「万法归一,一气化混沌」;《混元无极经》说的是「混元无极」。
 * 两句话本就不同,不该长出同一组枝条。
 *
 * ## 判据守什么
 *
 * 三条,都只量「跨功法的重复」,不量单部功法内部:
 *   一 两部功法之间,分支**名**不许整组撞 —— 撞一条可能巧合,三条全撞就是复刻;
 *   二 两部功法之间,分支**描述**不许逐字相同;
 *   三 词条**键组合**也不许整组相同(换个名、换句词、词条照抄,同样是复刻)。
 *
 * 为什么不要求「全库分支名唯一」:分支名本来就在不同功法之间重用过(「归一」
 * 在两部功法里各有一条,那是同一族立意的自然重合),全库唯一会把它们判成缺陷。
 * 这里量的是**整组**——该骂的是「一整套照搬」,不是「一个词撞了」。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA, gongfaDef } from "@/data/gongfa";
import { GONGFA_BRANCHES, branchesFor } from "@/data/gongfaBranches";

/** 每部功法的分支名组(排序后拼接,便于整组比较) */
function nameSignature(gongfaId: string): string {
  return branchesFor(gongfaId)
    .map((b) => b.name)
    .sort()
    .join("|");
}

/** 每部功法的分支词条键组合(每条排序后拼接) */
function keySignature(gongfaId: string): string {
  return branchesFor(gongfaId)
    .map((b) => Object.keys(b.mods).sort().join(","))
    .sort()
    .join("|");
}

describe("悟道分支 · 两部功法不该共用同一组三条道", () => {
  it("分支名不许整组撞 —— 撞一条可能巧合,全撞就是复刻", () => {
    const bySig = new Map<string, string[]>();
    for (const def of GONGFA) {
      const sig = nameSignature(def.id);
      if (!sig) continue;
      bySig.set(sig, [...(bySig.get(sig) ?? []), def.name]);
    }
    const dupes = [...bySig.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([sig, names]) => `${names.join(" / ")} 的分支名整组相同:${sig.replace(/\|/g, " · ")}`);
    expect(
      dupes,
      `这些功法的悟道分支是同一组 —— 「完全不同的流派」成了同一组选项的二周目:\n  ${dupes.join("\n  ")}`,
    ).toEqual([]);
  });

  it("分支描述不许跨功法逐字相同", () => {
    const byDesc = new Map<string, string[]>();
    for (const br of GONGFA_BRANCHES) {
      const owner = gongfaDef(br.gongfaId)?.name ?? br.gongfaId;
      byDesc.set(br.desc, [...(byDesc.get(br.desc) ?? []), `${owner}·${br.name}`]);
    }
    const dupes = [...byDesc.entries()]
      .filter(([, who]) => new Set(who.map((w) => w.split("·")[0])).size > 1)
      .map(([desc, who]) => `«${desc}» 同时属于 ${who.join(" / ")}`);
    expect(dupes, `这些分支描述跨功法一字不差:\n  ${dupes.join("\n  ")}`).toEqual([]);
  });

  it("名字与词条**同时**整组相同才算复刻 —— 只撞形状是正常的同族", () => {
    /*
     * 这一条是第一版判据的收窄版。
     *
     * 第一版单量「词条键组合」,结果抓到两对:
     *   仙灵淬体术 / 混沌体术   ——  固本(防+血) · 愈体(回+减+血) 同形状
     *   神将兵符 / 金阙玉章     ——  天罚(攻+暴+伤) · 军律(防+减+血) 同形状
     *
     * 两对的**名字、描述、数值量级全都不同**(境界差着好几档),只是词条组合
     * 撞在同一个「攻守两路」的基本形状上 —— 那是正常的同族措辞,不是复刻。
     * 判宽了会把它们一起判红,而判据该骂的是「一整套照搬」。
     *
     * 故收紧成:**名字整组相同 且 词条组合也整组相同**,才算复刻。
     * 名字那条已经单独守着了,这一条补的是「换个名、词条照抄」的漏。
     */
    const names = new Map<string, string>();
    const keys = new Map<string, string>();
    for (const def of GONGFA) {
      const n = nameSignature(def.id);
      const k = keySignature(def.id);
      if (!n) continue;
      names.set(def.id, n);
      keys.set(def.id, k);
    }
    const dupes: string[] = [];
    const ids = [...names.keys()];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i]!;
        const b = ids[j]!;
        if (names.get(a) === names.get(b) && keys.get(a) === keys.get(b)) {
          dupes.push(`${gongfaDef(a)?.name} / ${gongfaDef(b)?.name}`);
        }
      }
    }
    expect(dupes, `这些功法连名字带词条整组相同 —— 那是复刻:\n  ${dupes.join("\n  ")}`).toEqual([]);
  });

  it("反空转:确实量到了分支,且多分支功法不止一部", () => {
    expect(GONGFA_BRANCHES.length, "一条分支都没量到").toBeGreaterThan(50);
    const multi = GONGFA.filter((g) => branchesFor(g.id).length >= 2);
    expect(multi.length, "多分支功法太少,这条判据会空转").toBeGreaterThan(10);
  });
});
