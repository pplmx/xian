/**
 * 每一境都要有「主修之外」的东西可参 —— 主修席位只有一个。
 *
 * ## 复现:元婴境只有两部主修,辅修与秘术一部都没有
 *
 * 把功法按准入境界摊开看,境界 4(元婴)只有:
 *
 *     大光明普照经(主修)· 幽冥噬魂录(主修)
 *
 * 而主修席位是**唯一**的(见 AGENTS.md「main 占唯一主修席」)。
 * 于是元婴境的玩家在功法这件事上其实只有一个选择:两部里挑一部戴上,
 * 另一部连同整个辅修/秘术两层都摸不到 —— 一直要等到境界 5 才有辅修。
 *
 * ## 这不是我发明的标准,是数据文件自己写的
 *
 * `data/gongfa.ts` 里补仙界那几境时留了这条注释:
 *
 *   > 仙界其余四境各补一部 —— 此前 10-13 境的人只有一件本境功法可参,
 *   > 「主修只此一部、辅修只此一部」的时候,**参悟这件事就没有选择可言**。
 *
 * 作者已经认定"没得选"是要修的缺陷,并按此补过内容。境界 4 是那轮补漏
 * 之后的残留:它有 2 部,但**同为主修** —— 席位数不变,选择数还是 1。
 *
 * ## 判据守什么
 *
 * 只说一件事:**每个准入境界都至少有一部非主修功法**(辅修或秘术)。
 * 它不规定每境几部、什么品质、什么效果 —— 那是内容设计的事;
 * 它只钉住"玩家在这一境,除了那唯一的主修席之外还有东西可参"。
 *
 * 为什么不用「每境三类齐全」:开局几境本就该轻(境界 0 有 9 部可挑),
 * 拿"三类齐全"去卡会把一个健康的节奏判成红的。少一档不是缺陷,
 * **只剩一个选择**才是。
 */
import { describe, expect, it } from "vite-plus/test";
import { GONGFA } from "@/data/gongfa";
import { GONGFA_TYPE_NAMES } from "@/data/gongfa";
import { REALMS } from "@/data/realms";

/** 每一准入境界收着哪几类功法 */
function typesByRealm(): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (const def of GONGFA) {
    const set = map.get(def.minRealm) ?? new Set<string>();
    set.add(def.type);
    map.set(def.minRealm, set);
  }
  return map;
}

describe("功法 · 每境都要有主修之外的选择", () => {
  it("每个准入境界至少有一部辅修或秘术", () => {
    const byRealm = typesByRealm();
    const starved: string[] = [];
    for (const [realm, types] of [...byRealm.entries()].sort((a, b) => a[0] - b[0])) {
      const hasNonMain = types.has("sub") || types.has("secret");
      if (!hasNonMain) {
        const names = GONGFA.filter((d) => d.minRealm === realm)
          .map((d) => `${d.name}(${GONGFA_TYPE_NAMES[d.type]})`)
          .join("、");
        starved.push(`境界 ${realm}:${names}`);
      }
    }
    expect(
      starved,
      `这些境界只有主修,而主修席唯一 —— 玩家在那儿没得选:\n  ${starved.join("\n  ")}`,
    ).toEqual([]);
  });

  it("每个准入境界都真有功法 —— 不许出现空境", () => {
    const byRealm = typesByRealm();
    // REALMS 没有序号字段,境界号就是它在表里的下标(见 data/realms)
    const empty = REALMS.map((realm, major) => ({ realm, major }))
      .filter(({ major }) => !byRealm.has(major))
      .map(({ realm, major }) => `${realm.name}(${major})`);
    expect(empty, `这些境界一部功法都没有:${empty.join(", ")}`).toEqual([]);
  });

  it("反空转:确实有主修以外的类别在用", () => {
    // 若哪天有人把所有 sub/secret 都改成 main,上面那条会失去意义
    const counts = { main: 0, sub: 0, secret: 0 };
    for (const def of GONGFA) counts[def.type] += 1;
    expect(counts.sub, "辅修一部都没有 —— 判据的前提没了").toBeGreaterThan(0);
    expect(counts.secret, "秘术一部都没有 —— 判据的前提没了").toBeGreaterThan(0);
  });
});
