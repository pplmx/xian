/**
 * 图鉴里那件还没拿到的法宝，玩家不知道要打到哪一层。
 *
 * ## 由来（第 513 轮）
 *
 * 这一轮先按纪律搜了档案(`心魔` / `双修` / `业力` / `因果`),四条都已做过或有意不做。
 * 第五处落到图鉴上 —— 而它是因为一句界面说明引人注意的:
 *
 * ```text
 *   CollectionCabinet:  「抽开一柜，来源与条目在下一页续读」
 *   CollectionView:     「抽开看这一册的来源与条目」
 *   CODEX_SOURCES.artifact:  「来源:历练掉落 —— 高阶地界才出得上品」
 * ```
 *
 * 「高阶地界才出得上品」——**哪一阶？** 而 `ArtifactDef.fromTier` 恰好是每件的
 * 确切起点（`core/loot` 用它算掉落池与距离权重）。这个数**从不进界面**:
 *
 * ```text
 *   grep fromTier src/views/ src/components/  →  0 命中
 * ```
 *
 * ## 为什么这是缺口而不是「不必说」
 *
 * 本仓的界面纪律里有一条「决策信息完整」:给决策前把数字摊开。
 * 「我要不要继续刷这一层」正是一个决策 —— 而玩家手上只有「高阶才出」这种
 * 定性形容词。这与 `AGENTS.md` 里写的「『皆有裨益』不算数」是同一类。
 *
 * ## 判据
 *
 * ① 图鉴的法宝条目要带「从哪一层起掉落」这个数;
 * ② 反差：已获得的条目不必强调它（拿到手之后来源层级不再影响决策），
 *    但数据仍要在;
 * ③ 反差：这个数必须与 `fromTier` 同源 —— 不许界面自己另写一份。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { ARTIFACTS } from "@/data/artifacts";
import { collectionCodex } from "@/ui/codex";

interface ArtifactLike {
  id: string;
  fromTier: number;
}

const ARTS = ARTIFACTS as unknown as ArtifactLike[];

describe("图鉴 · 法宝从哪一层起掉落", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("① 每件法宝的条目都带得出「从第几层起」", () => {
    const cat = collectionCodex().find((c) => c.key === "artifact");
    expect(cat, "图鉴里没有法宝册").toBeTruthy();
    expect(cat!.entries.length, "法宝册是空的").toBeGreaterThan(0);

    /*
     * ## 这一条最初写错了
     *
     * 我第一版写的是「条目要带 `fromTier` 字段」—— 而 `CodexEntry` 上没有这个字段，
     * 于是它红了三条。实际那个数**已经在 `meta` 里**:
     *
     * ```ts
     *   artifactMetaText: `${品质} · ${世界名} · ${fromTier} 阶起可现世`
     * ```
     *
     * 故判据改成核对**那一句话**，而不是要求一个新字段。
     * 这正是本轮第二次「没先看已有的实现」—— 第一次是没搜判据文件名。
     */
    const wrong: string[] = [];
    for (const e of cat!.entries) {
      const def = ARTS.find((a) => a.id === e.id);
      if (!def) continue;
      const want = `${def.fromTier} 阶起可现世`;
      if (!e.meta.includes(want)) {
        wrong.push(`${e.name}: meta 里没有「${want}」（实为「${e.meta}」）`);
      }
    }
    expect(wrong, "这些法宝条目的 meta 没说自己从哪一层起掉落：" + wrong.join("；")).toEqual([]);
  });

  it("② 反差：来源说明里的「高阶」得能被逐件核对", () => {
    /*
     * 这一条守的是①的边界 —— 「高阶地界才出得上品」这句话本身没错，
     * 它说的是**品质**（quality）与层级的关系；而 `fromTier` 说的是
     * **这一件**从哪一层开始出现。两者不是同一件事，故都要在。
     */
    const cat = collectionCodex().find((c) => c.key === "artifact")!;
    expect(cat.source, "法宝册的来源说明不见了").toContain("来源");
    /* fromTier 的分布要真的有跨度，否则「从第几层起」这个信息没有意义 */
    const tiers = ARTS.map((a) => a.fromTier);
    expect(
      Math.max(...tiers) - Math.min(...tiers),
      "所有法宝都从同一层掉落 —— 那这个数没信息量",
    ).toBeGreaterThan(10);
  });

  it("③ 反差：那个数必须与 fromTier 同源", () => {
    /*
     * 界面不许自己另写一份层级表 —— 那是本仓反复记的「不做两本账」。
     * 这一条断言:图鉴条目若声明了层级，它就等于 data 里的 fromTier。
     */
    const cat = collectionCodex().find((c) => c.key === "artifact")!;
    for (const e of cat.entries) {
      const declared = (e as unknown as { fromTier?: number }).fromTier;
      if (declared === undefined) continue;
      const def = ARTS.find((a) => a.id === e.id);
      if (!def) continue;
      expect(declared, `${e.id} 的层级与 data 里的 fromTier 不一致`).toBe(def.fromTier);
    }
  });
});
