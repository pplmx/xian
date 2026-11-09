/**
 * 空态文案的版式 —— 十六处「这里暂时没东西」，写法有四种
 *
 * ## 观察（不是假设，是量出来的）
 *
 * 全站 16 条 `*__empty` 规则的实测：
 *
 * ```text
 *   字号   --type-note（12）· --type-body（14）· --type-title（16）  三种
 *   padding 无 · 0.48rem 0.2rem · 0.58rem 0.08rem · 0.9rem 0 · 1rem · 1.1rem 0   五种
 * ```
 *
 * 其中 `apprentice-roster__empty-seal`（2.4rem 的「庭」字方印）与
 * `soul-seat__empty` 是**视觉元素**，不属于文字空态，不算在内。
 *
 * ## 为什么这不是「风格多样」而是「各写各的」
 *
 * 空态在这一作里是**一句话**：「此处暂时没有可看的东西」。它出现在
 * 行囊可动槽、坊市货架、寄卖架、器魂台、斗法录……同一个角色、同一个用途。
 * 同一个角色有五种留白与三种字号，读起来像五个不同的界面拼在一起。
 *
 * 而 `docs/design.md` 的字阶本来是**有语义**的:
 *   `--type-note`   注文/次要说明(10px)
 *   `--type-body`   正文(11px)
 *   `--type-title`  小标题(14px)
 *
 * **但统一到一档是错的。** 实测后分成两类,它们的正确字号本就不同:
 *   · **一句话空态**(「此事未留下数值账目。」「此战无录」)—— 是一条注,走 `--type-note`
 *   · **说明式空态**(「此刻尚无行藏加成。功法、装备、丹药与天时落定后,
 *     四类行藏会在这里逐项现身。」)—— 是两句话的引导,走 `--type-body`
 * 把后者也压成 10px 会让那两句引导挤成小字,反而更难读。
 *
 * 故判据按**文案长短**分档,而不是按选择器硬编码 —— 硬编码会在下次新增空态时失效。
 *
 * ## 判据只钉「文字空态」,不碰视觉元素
 *
 * `apprentice-roster__empty-seal`(印章)、`soul-seat__empty`(座位图)是图形,
 * 它们的字号不是字阶问题。判据按选择器名把它们排除,而不是放宽整条规则 ——
 * 放宽会让下一个偷偷写成 `--type-title` 的文字空态混过去。
 *
 * ## 这一份测的是「一致性」,不是「好不好看」
 *
 * 统一之后好不好看是另一回事;这里只回答一个可验证的问题:
 * **同一个角色,是不是同一套尺寸。**
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 全站样式文件的合并文本(空态规则散在十几个 pages/*.css 里) */
const styles = () => {
  const files = [
    "adventure",
    "apprentice",
    "build",
    "celestial",
    "character",
    "collection",
    "inventory",
    "market",
    "souls",
    "dongfu",
    "legacy",
    "cultivation",
  ];
  return files.map((f) => readSource(`src/styles/pages/${f}.css`)).join("\n");
};

/**
 * 空态文案 —— 判据按**文案长短**分档,故这里得留着每一处的原文。
 *
 * 长度阈值 24 字:超过它就不是「一句话」了,而是一段引导。
 * 新增空态时要在这里登记一句,否则判据跳过它(宁可漏判,不拿错标准评判)。
 */
const EMPTY_COPY: Record<string, string> = {
  "event-slip__empty": "此事未留下数值账目。",
  "character-modifier-desk__empty":
    "此刻尚无行藏加成。功法、装备、丹药与天时落定后,四类行藏会在这里逐项现身。",
  "inventory-briefing__empty": "按真实战力比过九席,没有更高的了。",
  "market-consign__empty": "寄卖架空着 —— 挑一件行囊里舍得的兵刃上架。",
  "combat-report__empty": "这一战没有留下战报。",
  "celestial-gauntlet__empty": "此战无录",
};

/** 视觉元素空态 —— 印章 / 座位图,它们的字号不是字阶问题 */
const VISUAL_EMPTY = ["apprentice-roster__empty-seal", "soul-seat__empty"];

/** 抽出所有 `*__empty` 规则的 { selector, body } */
function emptyRules(css: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = [];
  const re = /\.([\w-]*__empty[\w-]*)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    out.push({ sel: m[1]!, body: m[2]! });
  }
  return out;
}

describe("空态版式 · 同一个角色要同一套尺寸", () => {
  it("判据读得到东西 —— 别空转", () => {
    const rules = emptyRules(styles());
    expect(rules.length, "一条空态规则都没扫到 —— 判据在空转").toBeGreaterThan(8);
  });

  it("一句话空态走 --type-note,说明式空态走 --type-body —— 按文案长短分档", () => {
    /*
     * 分档依据是**这一处空态写了几句话**,不是它叫什么名字:
     *   · 一句话(≤ 24 字)是一条注 → `--type-note`
     *   · 两句话以上的引导 → `--type-body`
     * 故这里把「空态文案」与「它的规则」配起来看,任何一侧越档都算越界。
     */
    const copyOf = EMPTY_COPY;
    const bad = emptyRules(styles())
      .filter((r) => !VISUAL_EMPTY.includes(r.sel))
      .filter((r) => {
        const size = /font-size:\s*([^;]+);/.exec(r.body)?.[1]?.trim();
        // 没写 font-size 的规则继承父级,不是另立一套 —— 不判
        if (!size) return false;
        const copy = copyOf[r.sel];
        // 没有登记文案的规则不猜:宁可漏判,也不拿错的标准去评判
        if (!copy) return false;
        const isOneLiner = copy.length <= 24;
        const want = isOneLiner ? "var(--type-note)" : "var(--type-body)";
        return size !== want;
      })
      .map((r) => {
        const size = /font-size:\s*([^;]+);/.exec(r.body)?.[1]?.trim();
        const copy = copyOf[r.sel]!;
        const isOneLiner = copy.length <= 24;
        return `${r.sel}（${copy.length} 字,该走 ${isOneLiner ? "note" : "body"}）→ ${size}`;
      });
    expect(
      bad,
      "这些空态的字号与它的文案长短对不上 —— 一句话走 note,两句以上的引导走 body",
    ).toEqual([]);
  });

  it("视觉元素空态不受这条约束 —— 印章与座位图有自己的尺寸", () => {
    /*
     * 这一条是**反面**判据:证明上面那条真的排除了它们,而不是碰巧没扫到。
     * 若哪天有人把 `empty-seal` 改成 `--type-note`,这张印章会缩成一行小字。
     */
    const css = styles();
    const seal = emptyRules(css).find((r) => r.sel === "apprentice-roster__empty-seal");
    expect(seal, "找不到那一枚印章 —— 排除名单可能已过期").toBeTruthy();
    expect(seal!.body, "印章的字号不是字阶问题,它该有自己的尺寸(而不是 --type-note)").toMatch(
      /font-size:\s*var\(--type-title\)/,
    );
  });
});
