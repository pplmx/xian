/**
 * 定价法则的**条数** —— 标题与判据里各写过一份,而它们都停在旧值上。
 *
 * ## 缺口(第 141 轮实测)
 *
 * `alchemy.md` 的标题原写「九条法则(A–H + I/I2)」,而 `pillValue.spec` 的注释写
 * 「立七条法则」—— **两处各说一个数,谁都不对**。实际编号是 15 个:
 *
 * ```text
 *   A  B  C  D  E  E2  E3  E4  F  G  G2  H  I  I2  J
 * ```
 *
 * 这不是打错字,是**法则一条条长出来的过程中,两处标题都没回头改**。
 * 而这类「条数」比单个数值更难发现:它不在任何一行数据里,只在两句说明里,
 * 没有任何判据会去数「【法则 X】」这种标记出现了几种。
 *
 * 已改:
 *
 * ```text
 *   alchemy.md      ## 定价法则(十五条:A–J,含子条 C2 / E2~E4 / G2 / I2)
 *   pillValue.spec  于是这里立十五条法则(A–J,含子条),让每一味丹各安其位
 * ```
 *
 * ## 判据
 *
 * ① 扫 `pillValue.spec` 里所有 `【法则 X】` 标记,去重后的种数就是真实条数;
 * ② `alchemy.md` 标题里写的数与 ① 相等;
 * ③ `pillValue.spec` 注释里写的数与 ① 相等。
 *
 * ②③ 都要 --- 因为这两处是**各自独立写下的**,一处改了另一处不会自动跟。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const SPEC = readFileSync(join(ROOT, "src/core/pillValue.spec.ts"), "utf8");
const DOC = readFileSync(join(ROOT, "docs/alchemy.md"), "utf8");

/** spec 里出现过的所有法则编号(A / E2 / I2 …),去重 */
function lawIds(): string[] {
  const ids = new Set<string>();
  for (const m of SPEC.matchAll(/【法则 ([A-Z][0-9]?)】/g)) ids.add(m[1]!);
  return [...ids].sort();
}

/** 中文数字 → 阿拉伯数字(只覆盖本文件用得到的范围) */
const CN: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
  十六: 16,
  十七: 17,
  十八: 18,
};

describe("定价法则 · 条数", () => {
  it("① spec 里的法则编号种数 = 真实条数", () => {
    const ids = lawIds();
    expect(ids.length, "一个 `【法则 X】` 标记都没扫到 —— 标记格式变了").toBeGreaterThan(7);
    /*
     * 打印出来供人看:这既是断言失败时的证据,也是下次加法则时的现状。
     */
    process.stdout.write(`\n—— 定价法则 ${ids.length} 条 ——\n  ${ids.join("  ")}\n`);
  });

  it("② alchemy.md 标题里写的条数 = 实际条数", () => {
    const real = lawIds().length;
    const m = /^## 定价法则[^(\n]*\(([^)]*)\)/m.exec(DOC);
    expect(m, "alchemy.md 里找不到「## 定价法则(…)」这一行").not.toBeNull();
    const cn = /([一二三四五六七八九十]+)条/.exec(m![1]!)?.[1];
    expect(cn, `标题里没有「N 条」这个说法:${m![1]}`).toBeDefined();
    const declared = CN[cn!];
    expect(declared, `认不出「${cn}条」这个数`).toBeDefined();
    expect(
      declared,
      `alchemy.md 标题写「${cn}条」,而 spec 里有 ${real} 条编号(${lawIds().join(" ")})` +
        ` —— 法则一条条长出来,标题没跟着改`,
    ).toBe(real);
  });

  it("③ pillValue.spec 的注释里写的条数 = 实际条数", () => {
    const real = lawIds().length;
    const m = /立([一二三四五六七八九十]+)条法则/.exec(SPEC);
    expect(m, "spec 注释里找不到「立 N 条法则」").not.toBeNull();
    const declared = CN[m![1]!];
    expect(declared, `认不出「${m![1]}条」`).toBeDefined();
    expect(
      declared,
      `pillValue.spec 的注释写「立${m![1]}条法则」,而实际有 ${real} 条 —— 两份标题各停在一个旧值上`,
    ).toBe(real);
  });

  it("④ 编号本身要连续:主号 A–J 不许断,子号挂在已有的主号下", () => {
    const ids = lawIds();
    const mains = ids.filter((id) => id.length === 1).map((id) => id.charCodeAt(0));
    expect(mains.length, "主号太少").toBeGreaterThanOrEqual(8);
    // 主号从 A 起连续
    for (let i = 1; i < mains.length; i += 1) {
      expect(
        mains[i]!,
        `主号断了:A=${String.fromCharCode(mains[0]!)}… 当前 ${String.fromCharCode(mains[i]!)}`,
      ).toBe(mains[i - 1]! + 1);
    }
    // 子号的父号必须存在
    for (const id of ids) {
      if (id.length === 1) continue;
      const parent = id[0]!;
      expect(ids, `子号 ${id} 的父号 ${parent} 不存在`).toContain(parent);
    }
  });

  it("反空转:两份文件读得到,标记格式正常", () => {
    expect(SPEC.length, "pillValue.spec 太短").toBeGreaterThan(10000);
    expect(DOC.length, "alchemy.md 太短").toBeGreaterThan(2000);
    expect(SPEC, "标记格式变了 —— 找不到【法则").toContain("【法则");
  });
});
