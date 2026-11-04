/**
 * 不可达的兜底 —— 判据要能认出「永远走不到」的那几行。
 *
 * ## 由来:一条永远不会执行的分支
 *
 * 洞府升级里曾经这样写:
 *
 * ```ts
 * if (!info.canUpgrade) { notify(info.reason, "warn"); return false; }
 * if (!resources.hasStone(info.stone) || !resources.hasSmall("ore", info.ore)) {
 *   notify("灵石或玄铁不足", "warn");   // ← 永远走不到
 *   return false;
 * }
 * ```
 *
 * 第二段的判断条件**已经被第一段包含**了:`buildingUpgradeInfo` 在资源不够时
 * 就把 `canUpgrade` 置为 false、并把差额写进 `reason`。于是第二段是一段死代码,
 * 而它的文案还是一句宽泛的「灵石或玄铁不足」—— 差多少、缺哪一样,一个字都没有。
 *
 * ## 为什么这类死代码值得单独抓
 *
 * 它**不会报错、不会变红、也测不出来**:跑遍所有路径都不会进入那一行,
 * 覆盖率工具看不到它(那一行从未被执行,而没人会去看"未覆盖"的行里写了什么)。
 * 它只是安静地留在那里,让后来的人(包括改文案的人)以为「这里有一句提示」。
 *
 * 2026 年这个仓库已经因为同类问题栽过一次:一条 `notify` 永远不触发,
 * 而玩家那边看到的是"点了没反应"。
 *
 * ## 这一条判据怎么做到"认得出来"
 *
 * 不去做静态分析(那要写一个类型系统),而是把**已知的那一类形状**钉住:
 *   「先按同一个判据 return,紧接着又用它的一个子集再判一次」
 *
 * 具体的机械判法:同一函数里,若某个 `notify(...)` 所在的分支,
 * 其条件在**前文**已经作为 return 的理由出现过,且文案是泛泛的「X 不足」,
 * 那它就是死兜底。
 *
 * 这里只对**登记在案的那一处**做精确断言:以后若有人把这条兜底加回来,
 * 判据会红;若别处也长出同款,把它登记进 `KNOWN_DEAD_FALLBACKS` 并同样清掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 去掉块注释与行注释 —— 判据认代码,不认注释里的解释 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** 已经清掉、且不许再加回来的死兜底:文件 + 那句文案的特征 */
const REMOVED_DEAD_FALLBACKS = [
  {
    file: "src/core/buildingService.ts",
    pattern: /notify\(\s*"灵石或玄铁不足"/,
    why: "buildingUpgradeInfo 已在资源不够时返回 canUpgrade=false 并把差额写进 reason,这条永远走不到",
  },
] as const;

describe("不可达的兜底 · 已清掉的几处不许回来", () => {
  it("洞府升级不再留一句走不到的「灵石或玄铁不足」", () => {
    /*
     * 只看**代码**,不看注释:清理那一段时我在原地写了一条注释解释"这里原本有什么"——
     * 若判据连注释一起扫,那句解释本身就会被当成"又长回来了"。
     * 这类误伤这个仓库已经出现过三次(品评、器铭、册目),一律用去注释再查。
     */
    for (const row of REMOVED_DEAD_FALLBACKS) {
      const code = stripComments(readSource(row.file));
      expect(code, `${row.file} 里又长回了死兜底:${row.why}`).not.toMatch(row.pattern);
    }
  });

  it("差额仍由 reason 报出 —— 清掉兜底不等于清掉信息", () => {
    const src = readSource("src/core/buildingService.ts");
    expect(src, "尚差多少仍要写出来").toContain("尚差");
    expect(src, "玄铁的那半句也要在").toContain("铁`");
  });
});

describe("不可达的兜底 · 泛泛的「X 不足」提示在全库受控", () => {
  it("资源类警告提示要么报差额,要么登记成有理由的例外", () => {
    /*
     * 不是禁掉所有「不足」提示 —— 有些地方(如引擎层没有界面上下文)确实只能这么说。
     * 要守的是:**core 里面向玩家的资源警告**,不许只说「不足」。
     * 判据扫 core 的 notify 字面量,把「只说 X 不足」的挑出来;
     * 眼下全库只剩少数几处,登记在下面的白名单里,新增一处就会红。
     */
    const ALLOWED = new Set<string>([
      // 道源不足在三处各自报差额(见 endgameService 的 `尚差 ${...}`),
      // 这里只挡"只有一个名词 + 不足"的形状
    ]);
    const files = [
      "src/core/endgameService.ts",
      "src/core/buildingService.ts",
      "src/core/forge.ts",
      "src/core/reforge.ts",
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readSource(file));
      for (const m of src.matchAll(/notify\(\s*"([^"$]{0,24}不足)"/g)) {
        const text = m[1]!;
        if (ALLOWED.has(text)) continue;
        offenders.push(`${file} → «${text}»`);
      }
    }
    expect(
      offenders,
      "这些提示只说「不足」,没说差多少 —— 要么补差额,要么在 ALLOWED 里写明为什么只能这么说",
    ).toEqual([]);
  });
});
