/**
 * 元判据 —— 扫描型判据必须能证明自己扫到了东西。
 *
 * ## 守的是什么
 *
 * 一类判据长这样:遍历 `src`、收集违规、`expect(offenders).toEqual([])`。
 * 它们有个共同的失效方式:**空数组有两种含义** —— 真的一处违规都没有,或者
 * 根本没扫到文件(路径写错、扩展名过滤变严、`walkFiles` 参数改了)。
 * 后者会让判据静默地永远通过,而屏幕上什么异常都看不到。
 *
 * `ui/copyPunctuation` 早就有三条「判据确实扫得到东西(防空转)」;Round 53 又给
 * `listRender` / `colorVar` / `typeScale` / `keepNumberUnit` 四条补上了。
 * 但那是**人工逐个补**的 —— 下一个新写的判据照样会漏。故把这件事本身变成判据。
 *
 * ## 判定口径
 *
 * 扫 `src/**\/*.spec.ts`,找出同时具备两个特征的:
 *   ① 出现 `readdirSync(` 或 `walkFiles(`(说明是遍历,输入规模不固定)
 *   ② 出现 `expect(<变量>…).toEqual([])`(说明在断言空集)
 *
 * 这类文件必须至少有一处「数量下限」: `toBeGreaterThan(数字)` / `toBeGreaterThanOrEqual(数字)` /
 * `.length).toBe(` / 或注释里写明防空转(假绿 / 扫得到 / 防空转)。

 * ## 为什么只查「目录遍历」那一类
 *
 * 全仓有 216 个「收集进数组 → 断言空集」的判据,而这条只覆盖其中 21 个文件。
 * 差额不是漏,是**输入是否可能为空**的判断:
 *
 *   · 遍历 `src` 的那 21 个,输入规模由路径与过滤条件决定 —— 写错就变空,要守;
 *   · 其余绝大多数遍历的是**常量数据表**(`ARTIFACTS` / `REALMS` / `PROPHECIES` 等),
 *     而那些表自己就有人数判据(`ARTIFACTS.length > 40`、`REALMS.length === MAX_MAJOR + 1`),
 *     表空不了,内层循环也就空不了。
 *
 * 无条件给每一处都加防空转,会退化成"断言常量非空"的冗余。**判据要加在会变的地方。**
 *
 * **裸 `readdirSync("某个固定子目录")` 也算遍历**,同样纳入 —— 它的输入规模不固定。
 *
 * ## 为什么允许注释豁免
 *
 * `visualRhythm` 与 `folioChapterHead` 用 `readdirSync(resolve(ROOT, rel))`,
 * 路径错会**抛异常**而不是返回空,天然不存在空转。这类"安全"是推理出来的,
 * 写一句注释说明比加一个恒为真的断言更诚实 —— 判据接受这种说明。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");

function specFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".spec.ts")) out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

/**
 * 数量下限的**可执行**形态。
 *
 * 只认真的断言,不认注释里的说法 —— 第一版把「防空转」「假绿」这类词也当豁免,
 * 结果是:注入删掉 `typeScale` 的数量断言之后,文件里那句注释还在,判据照样绿。
 * 豁免词会让人以为"写了注释就等于守住了",而注释拦不住任何回归。
 */
const HAS_FLOOR = [/toBeGreaterThan(?:OrEqual)?\(\s*\d+/, /\.length\)\s*\.toBe\(/];

/**
 * 天然不空转的**显式声明**。
 *
 * 只认这一种句式:注释里点明 `readdirSync` 会抛异常。这类文件不需要数量下限
 * (路径错时当场崩),但理由必须写成可检索的一句话,否则没人看得出它是
 * "想清楚了"还是"漏了"。
 */
const EXPLICIT_EXEMPT = /readdirSync[^\n]*抛异常|抛异常[^\n]*readdirSync/;

/**
 * 空集断言的**任意形态** —— 同一个意思在仓里有三种写法,只认一种就等于没守。
 *
 *   expect(x).toEqual([])       最常见
 *   expect(x).toHaveLength(0)   27 处
 *   expect(x.length).toBe(0)    16 处
 *
 * 第一版只认第一种,于是「遍历 + `toHaveLength(0)`」这种同样会假绿的判据
 * 完全在检查范围之外(实测扩展口径后受检数 20 → 21)。
 */
const EMPTY_ASSERT =
  /expect\([a-zA-Z_$][\w$]*[^)]*\)\s*\.toEqual\(\[\]\)|\.toHaveLength\(0\)|\.length\)\s*\.toBe\(0\)/;
/** 遍历信号 */
const WALKS = /(?:readdirSync\(|walkFiles\()/;

describe("元判据 · 扫描型的空集断言要能证明自己扫到了东西", () => {
  const files = specFiles();

  it("扫得到用例文件 —— 集合不能是空的", () => {
    expect(files.length, "一个 spec 都没扫到 —— 路径变了").toBeGreaterThan(100);
  });

  it("每个「遍历 + 空集断言」的判据都有数量下限或说明", () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf-8");
      if (!WALKS.test(text) || !EMPTY_ASSERT.test(text)) continue;
      checked += 1;
      if (HAS_FLOOR.some((re) => re.test(text)) || EXPLICIT_EXEMPT.test(text)) continue;
      offenders.push(file.slice(SRC.length + 1).replace(/\\/g, "/"));
    }
    // 防空转:一个都没查到时,下面的空集不算数
    expect(checked, "一个「遍历 + 空集断言」的判据都没找到 —— 口径失效了").toBeGreaterThan(10);
    expect(
      offenders,
      "这些判据在遍历后断言空集,却没有任何数量下限 —— 路径写错时会静默地永远通过:" +
        "补 `expect(scanned).toBeGreaterThan(N)`,或用注释写明为什么天然不空转",
    ).toEqual([]);
  });

  it("自证:口径能认出该认的、不误伤安全的", () => {
    // 该抓的:遍历 + 空集 + 无任何数量下限
    const risky = "for (const f of walkFiles(SRC)) { x.push(f); }\nexpect(offenders).toEqual([]);";
    expect(WALKS.test(risky) && EMPTY_ASSERT.test(risky), "口径认不出风险样本").toBe(true);
    expect(
      HAS_FLOOR.some((re) => re.test(risky)),
      "风险样本被误判成安全",
    ).toBe(false);
    expect(EXPLICIT_EXEMPT.test(risky), "风险样本被豁免规则误判").toBe(false);
    // 不该抓的①:有可执行的数量下限
    const safe = risky + "\nexpect(scanned).toBeGreaterThan(100);";
    expect(
      HAS_FLOOR.some((re) => re.test(safe)),
      "安全样本被误判成风险",
    ).toBe(true);
    // 不该抓的②:写明 readdirSync 抛异常(这条路天然不空转)
    const exempt = risky + "\n// 路径错时 readdirSync 会抛异常,不会返回空数组";
    expect(EXPLICIT_EXEMPT.test(exempt), "显式豁免没生效").toBe(true);
    // 三种空集写法都要认出来 —— 只认一种就等于给另外两种开了口子
    for (const form of [
      "expect(offenders).toEqual([])",
      "expect(offenders).toHaveLength(0)",
      "expect(offenders.length).toBe(0)",
    ]) {
      expect(EMPTY_ASSERT.test(`walkFiles(SRC);\n${form};`), `没认出这种空集写法:${form}`).toBe(
        true,
      );
    }
    // 关键:**只说"防空转"不算数** —— 那是注释,拦不住回归
    const fake = risky + "\n// 这里已经防空转了";
    expect(
      HAS_FLOOR.some((re) => re.test(fake)),
      "光写「防空转」三个字不该被当成守卫",
    ).toBe(false);
  });
});
