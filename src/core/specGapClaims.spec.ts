/**
 * spec 里说「缺的是 X」，而 X 已经做了。
 *
 * ## 由来（第 453 轮）
 *
 * `bondCausality.spec` 有两条测试说:
 *
 * ```text
 *   缺的不是解释文本,是过程中的足迹
 *   十位道侣各有所求,足迹文本可由它派生 —— 缺的是机制,不是内容
 * ```
 *
 * 而机制早就在了 —— 第 409 轮补的 `data/bondFootprints` 按 ripeness 分三档吐句子,
 * 第 410 轮经 `useBondOverview.latestFootprintLine` 接进 `BondDialog`。
 * 同一份文件里第 178 行那条判据还一直在守「她开口」不掉回突兀。
 *
 * **判据是新的，而旁边的说明没跟上。** 两者说同一件事，一处已更新、一处没更新。
 *
 * ## 判据
 *
 * 扫 spec 文件里的「缺的是 X」/「缺的不是 A，是 B」这类**断言某物缺失**的句子,
 * 再到 `src/` 里找那个名字是否存在。存在就报 —— 并指出该改哪一句。
 *
 * ## 口径
 *
 * 保守:只登记**具体的名字**（不是泛泛的「机制」「内容」），且那些名字要有
 * 明确的实现痕迹（文件、导出、UI 字段）。不加泛化规则。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/**
 * 每一条都是**具体的一对**:spec 里说缺什么，而它在哪已经实现。
 *
 * 加一条时要写清「缺」的说法与「已实现」的证据 —— 模糊的条目会让这条判据变噪。
 */
const PAIRS: {
  what: string;
  /** spec 里断言它缺失的说法 */
  gapClaim: RegExp;
  /** 它已经实现的证据（相对 src/ 的路径） */
  evidence: string;
}[] = [
  {
    what: "道侣足迹",
    gapClaim: /缺的是机制,不是内容|缺的不是解释文本,是过程中的足迹/,
    evidence: "data/bondFootprints.ts",
  },
  {
    what: "总览取消出发",
    /*
     * `overviewNecessity.spec` 曾建议「保留总览,取消常规出发」,
     * 而产品保留了出发 —— MortalWorldView 的 `depart()` 仍在。
     * 那个文件自己第 105 行已写了「事后更正」,但第 165 行那条测试
     * 直到第 454 轮才跟着改。
     */
    gapClaim: /建议:保留总览,取消常规出发/,
    evidence: "views/MortalWorldView.vue",
  },
];

describe("spec 说「缺的是 X」· X 是否已经做了", () => {
  it("没有「spec 断言缺失、而实现已在」的条目", () => {
    const hits: string[] = [];
    for (const p of PAIRS) {
      const done = existsSync(resolve(ROOT, "src", p.evidence));
      if (!done) continue;
      /*
       * 实现已存在 —— 再去看还有哪些 spec 在说它缺。
       * 注意要排除**记录这次修正**的句子（与第 445 轮同一个坑）:
       * 「原来说…缺的是…」是在讲历史，不是当下的断言。
       */
      const NON_CLAIM =
        /原来说|原来写|此前(?:是|写|说)|改过一次|曾(?:写|说|是)|旧说法|已做的|已经做了/;
      for (const f of readdirSync(resolve(ROOT, "src/core")).filter(
        /*
         * 排除本文件 —— 它自己必须提到那些说法（在 PAIRS 与文件头里），
         * 否则这条判据无从定义。**判据不该把自己的定义当成被检对象。**
         */
        (x) => x.endsWith(".spec.ts") && x !== "specGapClaims.spec.ts",
      )) {
        const src = readFileSync(resolve(ROOT, "src/core", f), "utf-8");
        for (const line of src.split("\n")) {
          if (NON_CLAIM.test(line)) continue;
          if (p.gapClaim.test(line))
            hits.push(`${f}: 说「${p.what}」缺，而 src/${p.evidence} 已在`);
        }
      }
    }
    expect(
      hits,
      "这些 spec 还断言某物缺失，而它已经实现了 —— " +
        "读到这里的人会去重做一件做完的事：" +
        hits.join("；"),
    ).toEqual([]);
  });

  it("反差：实现若真的不在，这条判据不该报", () => {
    /*
     * 判据的前提是「实现存在」。这条确认证据路径本身是对的 ——
     * 若哪天 `bondFootprints.ts` 被删，前一条会自然放行（而不是误报），
     * 而这正是它该有的行为。
     */
    for (const p of PAIRS) {
      expect(existsSync(resolve(ROOT, "src", p.evidence)), `证据路径写错了: ${p.evidence}`).toBe(
        true,
      );
    }
  });
});
