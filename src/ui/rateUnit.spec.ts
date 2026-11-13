/**
 * 速率单位的唯一出口 —— 「/秒」只许由 `formatRate` 写一次。
 *
 * ## 由来
 *
 * `utils/format` 的 `formatRate()` 返回值**自带单位**:`formatGN(v) + "/秒"`。
 * 于是任何一处 `每秒 ${formatRate(x)}` 都会在界面上印成「每秒 4.4/秒」——
 * 玩家读到的是「结果除以结果」,而那个数其实是**速率**。
 *
 * 实测(390×844,真构建)抓到的四处:
 *
 * ```text
 * /cultivation  闭关后每秒 ≈ 4.034亿/秒(现 2.355亿/秒)·5分钟约多收 503.6亿/秒 修为
 * /cultivation  灵气浮层「还差」行:每秒 445.3万/秒
 * /cultivation  修为浮层「还需」行:每秒 2.355亿/秒
 * /              顶栏灵气浮层「还差」行:每秒 445.3万/秒
 * ```
 *
 * 同一句「闭关后…约多收」还有第二个毛病:那一笔 `retreatExtra` 是**五分钟的
 * 总量**(`(perSec - perSec0) * durationSec`),却借了 `formatRate` 的口径,
 * 于是总量被说成了速率 —— 「约多收 503.6亿/秒 修为」既重复了单位,又量错了东西。
 *
 * ## 为什么用静态扫描而不是组件测试
 *
 * 这四处散在三个文件里、分属三个不同的浮层,没有一处是"同一个组件渲染出来的"。
 * 逐个挂载组件要装 test-utils(本仓没有)、还要造 store 夹具;而**错的形状只有
 * 一种**:单位被手写了两遍。故扫源码里的字面量组合,与 `copyPunctuation.spec`
 * 同一类做法 —— 它守的也是"同一页里不该有两种写法"这类形状。
 *
 * ## 这条判据守不住什么
 *
 * 它只看「`每秒` 与 `formatRate` 挨得很近」这一种写法。拼接变量、模板里写字面量
 * 「/秒」等其它写法它都看不见 —— 那些归 `formatRate` 自己的用例与真浏览器门。
 */
import { describe, expect, it } from "vite-plus/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ROOT, isSourceFile, walkFiles } from "@/test/readSource";

interface Hit {
  path: string;
  line: number;
  text: string;
}

/**
 * 源码语料 —— 模板与脚本都要扫。
 *
 * 四处里有三处在 `.vue`、一处在 `.ts`(顶栏的浮层行是 computed 里拼的),
 * 只扫模板会漏掉后一处,那正是「判据只伸到一半」的老毛病。
 */
const FILES = walkFiles(resolve(ROOT, "src"), isSourceFile).map((full) => ({
  path: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
  text: readFileSync(full, "utf8"),
}));

/**
 * 抹掉注释 —— 注释里**举例**说明「这里曾经印成 `每秒 ${formatRate(...)}`」时,
 * 那段字不是玩家看得见的文案,不该算违规。
 *
 * 抹法是等长替换(保留换行与偏移),报出的行号仍对应原文件。三套注释都要认:
 * JS 行注释、JS 块注释、以及 `.vue` 模板里的 `<!-- -->`。
 */
function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

/**
 * `每秒` 后面紧跟着 `formatRate(` —— 包括插值 `{{ }}` 与模板串 `${}` 两种包法,
 * 中间只允许出现 `≈`、空格、`+`、`:` 之类不改变语义的字符。
 *
 * 为什么允许中间有东西:`闭关后每秒 ≈ {{ formatRate(...) }}` 里夹着 `≈ {{ `。
 * 但**不允许跨行**或跨到下一句,否则「上句说每秒、下句用 formatRate 报总量」
 * 这种正当写法会被误伤。
 */
const DOUBLE_UNIT = /每秒[^\n]{0,16}(?:\{\{|\$\{)?\s*(?:\+)?\s*formatRate\(/;

/** `formatRate(` 之前手写的「每秒」—— 同一条规则的另一半,分开写便于报出两类的行 */
function scan(): Hit[] {
  const out: Hit[] = [];
  for (const file of FILES) {
    stripComments(file.text)
      .split("\n")
      .forEach((text, i) => {
        if (DOUBLE_UNIT.test(text)) out.push({ path: file.path, line: i + 1, text: text.trim() });
      });
  }
  return out;
}

describe("速率单位 · 「/秒」只由 formatRate 说一次", () => {
  it("源码里没有「每秒 …formatRate(…)」这种两句都说一次单位的写法", () => {
    expect(
      scan(),
      "这些行会把速率印成「每秒 4.4/秒」—— 去掉手写的「每秒」,或者改叫 formatGN 再自己补单位",
    ).toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    // 反例造在这个用例里,而不是依赖源码里恰好有一处 —— 那处修掉之后这条就空了。
    // 同时量「语料非空」:walkFiles 若坏了,上面那条会因零命中而假绿。
    expect(FILES.length, "源码语料是空的 —— walkFiles 或 isSourceFile 坏了").toBeGreaterThan(200);
    const samples = [
      "hint: () => `每秒 ${formatRate(player.cultPerSec)}`",
      '<p class="tabular">闭关后每秒 ≈ {{ formatRate(retreatPerSec) }}',
      "const s = `每秒 ${formatRate(x)}`;",
    ];
    for (const s of samples) expect(DOUBLE_UNIT.test(s), `反例没认出来:${s}`).toBe(true);
    // 正当写法不许误伤:说「每秒」但报的是别的口径(总量用 formatGN、或整句不含 formatRate)
    for (const s of [
      "const s = `每秒 ${formatGN(x)}`;",
      "// 每秒都在涨",
      "elapsedSec > 0 ? formatRate(x) : '0'",
    ]) {
      expect(DOUBLE_UNIT.test(s), `误伤了正当写法:${s}`).toBe(false);
    }
  });
});
