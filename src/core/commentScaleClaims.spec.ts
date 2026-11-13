/**
 * 注释里的规模数：**两处写着 551，而实际是 669**。
 *
 * ## 由来（第 174 轮）
 *
 * `core/balanceCoverage` 的文件头用一组数来论证一件事:
 *
 * ```text
 * 第一版只扫 `src/core/` —— 而全仓 551 个 spec 里有 **225 个不在 core 下**
 * (`src/data/`、`src/ui/`、`src/stores/`、`src/composables/` …)。
 * …**量尺只伸到了 60% 的地方**,而它报出来的缺口看起来跟真的一样。
 * ```
 *
 * 那段论证**是对的、也值得留着**。但三个数全都过时了:
 *
 * ```text
 * 写的   551 总 / 225 非 core（= 60%）
 * 实际   669 总 / 279 非 core（= 58%）
 * ```
 *
 * 同一组数还出现在 `balanceCoverage.spec` 的第 101 行 —— 一个数写两处，
 * **两处一起过期**，而没有任何门会红：它们只是注释。
 *
 * ## 为什么这算缺陷，而不是「注释而已」
 *
 * `docs/design.md` 里那条「注释里的规模数，是最难发现的那本账」说的就是它:
 * 文档有 `docs-check` 对账，而**注释没有**。一段论证若靠数字支撑，
 * 数字一旦漂了，那段论证就开始骗人 —— 后来者会拿它当依据（"量尺只到 60%"），
 * 而它其实已经不是那个数。
 *
 * ## 判据
 *
 * ① 注释里出现的「全仓 N 个 spec」「M 个不在 core 下」这类**规模断言**，
 *    N / M 必须与真实数量一致;
 * ② 同一组数不许写两处（一处过期两处一起骗）。
 *
 * 只认这一种断言:「spec 文件数」是本判据能**精确数出来**的东西。
 * 别的规模数（"8 种机制家族""64 套数值"）依赖各自的数据源，不能在这里硬编码 ——
 * 那会把一条好判据变成第二本账。
 *
 * ## 故障注入
 *
 * 往 `core/balanceCoverage` 塞回「全仓 551 个 spec」→ 当场红。
 * 把正则改成匹配不到（比如加个 `NOMATCH` 后缀）→ 「地基」那条红，证明它没有空转。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSpecFile, readSource, isSourceFile } from "@/test/readSource";

/** 真实的 spec 数量 —— 从文件系统现数，不从任何地方抄 */
function realSpecCounts(): { total: number; outsideCore: number } {
  const all = walkFiles("src", isSpecFile);
  const core = all.filter((f) => f.startsWith("src/core/"));
  return { total: all.length, outsideCore: all.length - core.length };
}

/**
 * 认出「全仓 N 个 spec」与「M 个不在 core 下」两类断言。
 *
 * 数字与量词之间允许空格（注释里常见「全仓 551 个 spec」）。
 */
const TOTAL_CLAIM = /全仓\s*(\d+)\s*个\s*spec/g;
const OUTSIDE_CLAIM = /(\d+)\s*个\s*不在\s*core\s*下/g;

describe("注释里的 spec 规模数 · 必须与真实数量一致", () => {
  it("源码与用例里写下的 spec 总数是对的", () => {
    const { total, outsideCore } = realSpecCounts();
    expect(total, "一个 spec 都没数到 —— 判据空转").toBeGreaterThan(100);

    const offenders: string[] = [];
    const files = walkFiles("src", (f) => isSourceFile(f) || isSpecFile(f));
    for (const f of files) {
      /*
       * **排除本文件** —— 它的说明与「地基」里逐字引着那组过期数字
       * （551 / 225），扫进来就变成判据举报自己。要排除的永远只有它自己。
       */
      if (f.endsWith("commentScaleClaims.spec.ts")) continue;
      const src = readSource(f);
      for (const m of src.matchAll(TOTAL_CLAIM)) {
        if (Number(m[1]) !== total) {
          offenders.push(`${f}: 写「全仓 ${m[1]} 个 spec」，实际 ${total} 个`);
        }
      }
      for (const m of src.matchAll(OUTSIDE_CLAIM)) {
        if (Number(m[1]) !== outsideCore) {
          offenders.push(`${f}: 写「${m[1]} 个不在 core 下」，实际 ${outsideCore} 个`);
        }
      }
    }
    expect(offenders, "注释里的规模数漂了 —— 靠它支撑的那段论证已经开始骗人").toEqual([]);
  });

  it("判据自己认得出那两种断言（地基）", () => {
    // 认得出
    expect([..."全仓 669 个 spec".matchAll(TOTAL_CLAIM)].length, "认不出总数断言").toBe(1);
    expect(
      [..."其中 279 个不在 core 下".matchAll(OUTSIDE_CLAIM)].length,
      "认不出 core 外断言",
    ).toBe(1);
    // 空格变体
    expect([..."全仓 551 个  spec".matchAll(TOTAL_CLAIM)].length).toBe(1);
    // 不误伤:别的量词、别的规模数都不该命中
    expect([..."共 8 种机制家族".matchAll(OUTSIDE_CLAIM)].length).toBe(0);
    expect([..."全仓 12 部功法".matchAll(TOTAL_CLAIM)].length).toBe(0);
  });

  it("那两处已经改成「不写绝对数」—— 注释里没有门对账，写死就会漂", () => {
    /*
     * 这一条替掉原来那句「那两个文件现在写的是真数」。
     *
     * **写对一次不等于守得住**：数字每加一个 spec 就漂，而改它的人不会重跑这条判据
     * （它只在测试里红，不在改注释时红）。更稳的改法是**压根不写绝对数** ——
     * 用「约四成」这种不随规模漂的说法，把精度让给真正会读它的判据。
     *
     * 故这里核的是**那两处不写绝对数**，而不是「那两处写得对」。
     */
    const { total, outsideCore } = realSpecCounts();
    for (const f of ["src/core/balanceCoverage.ts", "src/core/balanceCoverage.spec.ts"]) {
      const src = readSource(f);
      const totalHit = [...src.matchAll(TOTAL_CLAIM)].map((m) => Number(m[1]));
      for (const n of totalHit) expect(n, `${f} 又写回了绝对数 —— 它会再漂一次`).toBe(total);
      expect(totalHit.length, `${f} 里又出现了硬编码的 spec 总数`).toBe(0);
      expect(outsideCore, "这个数仍然可用于判据自身（防空转）").toBeGreaterThan(0);
    }
  });
});
