/**
 * 「当前境界的功法已尽数参悟」—— 而它的条件是 `minRealm <= major + 1`。
 *
 * ## 由来（第 529 轮）
 *
 * 上一轮找到一处「三处说法一致，所以没有判据会红」的缺口（终局那句「到此为止」）。
 * 这一轮顺着同一条线索扫各类边界提示里的「已尽 / 已满 / 到头」:
 *
 * ```text
 *   奇缘      「此世的缘分已尽数走过」   —— **处理得很好**:
 *              区分了「此世」与「系统到顶」，还给出「往后的路，你们只并肩」
 *   功法参悟  「当前境界的功法已尽数参悟」 —— 措辞限定了范围，但没说「升境即可」
 *   灵脉      「灵脉容量已尽,唯有取舍」   —— 那句本身就是在说取舍，完整
 * ```
 *
 * ## 判断依据
 *
 * `comprehendGongfa` 的池子是 `minRealm <= major + 1` —— **跨过这一境就有新功法**。
 * 而那句提示只说了「这一境已尽」，没告诉玩家「再往上还有」。
 *
 * 与 `bondQuiet` 那处对照着看:它写了「这一世的……往后的路，你们只并肩」——
 * 一句话里既有「到此为止」，也有「此后如何」。功法这一句缺了后半。
 *
 * ## 判据
 *
 * ① 那一句要说明「为什么已尽」或「怎样才能再有」;
 * ② 反差：它不许被改成「功法已尽」（不限定范围）—— 那是另一件事;
 * ③ 反差：残页不足那一句不需要这种补充（缺什么说得清楚）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(resolve(__dirname, "gongfaService.ts"), "utf8");

describe("功法参悟 · 「已尽」之后还有没有", () => {
  it("① 那句提示要说清「升一境即可」或等价的去处", () => {
    /*
     * 取 `comprehendGongfa` 里那句 notify 的文本。
     */
    const m = SRC.match(/notify\("当前境界的功法已尽数参悟[^"]*"/);
    expect(m, "找不到那句提示 —— 判据的前提要重看").toBeTruthy();
    const text = m![0];
    expect(
      text,
      `那句只说「已尽」，没说「怎样才能再有」—— 而池子的条件是 minRealm <= major + 1，` +
        `跨过这一境就有新的。现在写的是：${text}`,
    ).toMatch(/升|下一境|境界再进|更高的境/);
  });

  it("② 反差：它不许被改成不限定范围的「功法已尽」", () => {
    expect(SRC, "「当前境界」这个限定词丢了 —— 那会读成「全作功法都用完了」").toContain(
      "当前境界的功法已尽数参悟",
    );
  });

  it("④ 强化上限同样要说清「怎么才能更高」", () => {
    /*
     * ## 同一类问题的第二处（第 529 轮）
     *
     * 上限是 `EQUIP_MAX_LEVEL_BASE + forgeCapBonus` —— **炼器台能把它抬高**。
     * 而"已达强化上限"这句只说了"到顶了"，没说"顶还可以往上挪"。
     *
     * 这与刚刚修的功法那句是同一形状:玩家读到的是一句完整的话，
     * 而它缺的正是"下一步"。
     */
    const forge = readFileSync(resolve(__dirname, "forge.ts"), "utf8");
    const hits = [...forge.matchAll(/notify\("已达强化上限[^"]*"/g)].map((m) => m[0]);
    expect(hits.length, "找不到那句提示 —— 判据的前提要重看").toBeGreaterThan(0);
    const bad = hits.filter((t) => !/炼器台|炉|殿|提升上限|炉火/.test(t));
    expect(
      bad,
      "这些「已达强化上限」没说上限可以抬高 —— 而它是 `EQUIP_MAX_LEVEL_BASE + forgeCapBonus`：" +
        bad.join("、"),
    ).toEqual([]);
  });

  it("5.  道果不足要给差额 —— 稀缺资源的缺口直接决定去不去凝", () => {
    /*
     * `forge.ts` 有一条好范例:「差额要给出来 —— 差 8 尘与差 8 万灵石是两种境遇」。
     * 道果是更稀缺的资源:签一份契差 8 枚与差 800 枚，是「再刷一趟」与
     * 「这一世先别签」的区别。而原句只说「道果不足」。
     */
    const src = readFileSync(resolve(__dirname, "lifeTrialService.ts"), "utf8");
    const m = src.match(/notify\(`道果不足[^`]*`/);
    expect(m, "找不到那句提示 —— 判据的前提要重看").toBeTruthy();
    expect(m![0], "道果不足没说差多少 —— 稀缺资源的缺口不能只给定性形容词").toMatch(/尚差|差 \$/);
  });

  it("③ 反差：残页不足那一句不需要这种补充", () => {
    /*
     * 「功法残页不足」缺什么已经说得很清楚（残页），
     * 故这一条断言它**保持原样** —— 不许为了统一格式去加一句废话。
     */
    expect(SRC, "残页不足那句被改动了").toContain('notify("功法残页不足", "warn")');
  });
});
