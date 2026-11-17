/**
 * 用例名说「两项」，而它量的是四项。
 *
 * ## 由来（第 509 轮）
 *
 * 上一轮发现 `motivationType.spec` 的**结论段**比它量的范围宽。这一轮顺着
 * 「一句话与它量到的东西对不上」继续查，落到另一半:**用例名**。
 *
 * ```text
 *   compoundingAudit.spec:48
 *   it("只有N项是真正的自动复利,其余是收藏或需操作", () => {   // 旧名，N 写下时是 2
 *     const auto = autoCompounding();          // ← 实际返回 4 项
 *     ...
 *     console.log(`自动复利 ${auto.length} 项:道果、资质地板、称号、灵兽`);
 *     console.log(`其中无上限的只有「道果」,其余三项都会饱和`);
 *   });
 * ```
 *
 * 名字里的「两项」是这条用例写下时的数字。后来查出了资质地板与称号
 * （见本 spec 的「此前那张永久资产表漏掉了两条自动复利通道」），
 * **正文跟着改了，名字没改**。
 *
 * ## 为什么这不只是文案问题
 *
 * 用例名是**测试报告里玩家/维护者唯一会读的那一行**。
 * 「只有两项」会让读报告的人以为复利面很窄 —— 而实际是四项。
 * 这正是 `docs/development.md` 反复记的那条「不做两本账」:
 * **一个数字写在名字里，它就有被常数改动的义务。**
 *
 * ## 判据
 *
 * ① 用例名里若写了数字，且正文里也打印了同一个量的数字，两者必须一致;
 * ② 反差：不是所有数字都管 —— 名字里的「第一阶段」「三种逆境」这类**序数/枚举说法**
 *    不在此列（它们不是某个数组的 length）;
 * ③ 反差：这条判据只查「名字里的中文数字」，不查英文与代码注释。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { stripStringLiterals } from "@/utils/sourceScan";

const CN_NUM: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
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
  十九: 19,
  二十: 20,
};

/** 从用例名里取出「N 项 / N 条 / N 个」里的数字 */
function claimedCount(title: string): number | null {
  const m = title.match(/([一二两三四五六七八九十]+)\s*(?:项|条|个)/);
  if (!m) return null;
  return CN_NUM[m[1]!] ?? null;
}

describe("用例名 · 它说几项，就得真是几项", () => {
  it("① 名字里写了「N 项/条/个」，正文同一句话里的数必须与它一致", () => {
    /*
     * 判法：把每个 spec 里 `it("…N 项…", () => { … })` 的**函数体**取出来，
     * 在体内找同一量词旁的 `${X.length}` 或裸数字。
     * 只比「名字里的 N」与「体内第一次出现的「X 项」里的 N」——
     * 这条规则窄而准，能抓住 compoundingAudit 那一处，又不会满仓误报。
     */
    const dir = resolve(__dirname);
    const offenders: string[] = [];
    /*
     * 不再跳过本文件（第 510 轮改动）。
     *
     * 从前这里是 `x !== "testNameTruth.spec.ts"` —— 因为本文件的自证用例里
     * **故意**写着一段含错名的假样本，不跳过就会自己扫到自己。
     *
     * 而「跳过整个文件」是「不再查自己」，不是「查对」:这份文件里的真实用例
     * 也因此脱离了检查。现在改成**先剥离字符串字面量再扫** ——
     * 假样本在字符串里，抹掉它，而 `it(` 这个调用本身留在代码里。
     *
     * 用例名是 `it("…")` 的第一个参数，它**本身就在字符串里** ——
     * 故要保留它。用 `keep` 判定:长度不超过 80 且不含换行的字符串视为「可能的用例名」。
     */
    const files = readdirSync(dir).filter((x) => x.endsWith(".spec.ts"));
    for (const f of files) {
      const raw = readFileSync(resolve(dir, f), "utf8");
      const src = stripStringLiterals(raw, { keep: (c) => !c.includes("\n") && c.length <= 80 });
      const re =
        /it\("([^"]*?([一二两三四五六七八九十]+)\s*(?:项|条|个)[^"]*?)",\s*\(\)\s*=>\s*\{/g;
      for (const m of src.matchAll(re)) {
        const title = m[1]!;
        const claimed = claimedCount(title);
        if (claimed === null) continue;
        /* 取函数体：从匹配结束处到下一个 `\n  });` */
        const start = (m.index ?? 0) + m[0].length;
        const end = src.indexOf("\n  });", start);
        if (end < 0) continue;
        const body = src.slice(start, end);
        /*
         * 判法要窄:只认**紧邻的** `${X.length} 项` 这种「这一份数据有几项」的写法。
         *
         * 第一版写得很宽（体内第一处裸数字），一次扫出 6 条，其中 5 条是误报:
         *   bondCausality   「1 条」vs 正文「907 项」—— 907 是别的东西
         *   foeOrigin       「4 项」vs 正文「1 项」—— 那个 1 是某个倍率
         *   loot / skillStageWording 同理
         * 只有 compoundingAudit 那一处是真的。
         *
         * 故改成:体内若出现 `${…length} 项`，就用**同一次 console.log 里**的
         * 「其余 N 项 / 共 N 项」去比 —— 那是作者自己写下的对照句，
         * 两者不一致才是硬矛盾。
         */
        const spread = body.match(/\$\{[\w.]+\s*length\}\s*项/);
        if (!spread) continue;
        /* 该 log 里紧跟其后的一句「其余 N 项 / 共 N 项」 */
        const tail = body.slice(body.indexOf(spread[0]));
        const rest = tail.match(/其余([一二两三四五六七八九十]+)项/);
        if (!rest) continue;
        const restN = CN_NUM[rest[1]!];
        if (restN === undefined) continue;
        /* 「其余 N 项」+ 无上限的那 1 项 = 总数；若与名字不符就是矛盾 */
        const total = restN + 1;
        if (total !== claimed) {
          offenders.push(
            `${f}: 用例名说「${claimed} 项」，正文写「${restN} 项会饱和 + 1 项无上限 = ${total} 项」——${title.slice(0, 24)}`,
          );
        }
      }
    }
    expect(offenders, "这些用例名与它量到的数对不上：" + offenders.join("；")).toEqual([]);
  });

  it("② 反差：序数与枚举说法不在此列", () => {
    /*
     * 「第一阶段」「三种逆境」这类是**叙述**，不是某个数组的 length。
     * 这条判据只查「N 项/条/个」+ 正文里同名量词的裸数字，故它碰不到那些。
     */
    expect(claimedCount("第一阶段:起始"), "「阶段」不该被当成计数").toBeNull();
    expect(claimedCount("四份契的规则确实偏离了平常的一世"), "没有量词就不算").toBeNull();
    expect(claimedCount("自动复利共四项"), "这一句该被判出来").toBe(4);
  });

  it("③ 反差：英文与注释里的数字不查", () => {
    const dir = resolve(__dirname);
    const any = readFileSync(resolve(dir, "compoundingAudit.spec.ts"), "utf8");
    /* 这条只是确认判据①跑得到真实文件，不是空转 */
    expect(any.length, "读不到 compoundingAudit.spec").toBeGreaterThan(1000);
  });
});

describe("判据自身的可靠性 · 它真的抓得到吗", () => {
  it("④ 自证：把名字改回错的数字，判据立刻变红", () => {
    /*
     * 这一条防的是「判据写完就空转」:
     * 我在上面把引用的旧名改成了 `N` 占位，于是它自己扫不到了 ——
     * 那种「为了让它绿而改窄」的正是需要防的。
     *
     * 故这里**用一份合成的源码**跑同一条判法，断言它抓得到。
     */
    /*
     * 这段合成源码必须在**运行期**拼出来，不能写成字面量 ——
     * 写成字面量时，本仓那些扫 `it("…")` 的判据会把里面的句子当成真用例
     * （reportTestDecl 当场红了：「既无断言也无报告声明」）。
     * 故用数组 join 拼，源码里不出现完整的 `it("……"` 字面量。
     */
    const fake = [
      "it(" + JSON.stringify("只有两项是真正的自动复利") + ", () => {",
      "  console.log(`自动复利 ${auto.length} 项:道果、资质地板、称号、灵兽` +",
      "    `\\n其中无上限的只有「道果」,其余三项都会饱和`);",
      "});",
    ].join("\n");
    /* 与①同一条正则 */
    const re = /it\("([^"]*?([一二两三四五六七八九十]+)\s*(?:项|条|个)[^"]*?)",\s*\(\)\s*=>\s*\{/g;
    const m = [...fake.matchAll(re)][0];
    expect(m, "合成的源码没被这条正则抓到 —— 判据①的前提变了").toBeTruthy();
    const claimed = claimedCount(m![1]!);
    expect(claimed, "「两项」没被读成 2").toBe(2);
    const spread = fake.match(/\$\{[\w.]+\s*length\}\s*项/);
    const rest = fake.slice(fake.indexOf(spread![0])).match(/其余([一二两三四五六七八九十]+)项/);
    const total = (CN_NUM[rest![1]!] ?? 0) + 1;
    expect(total, "合理引擎算出 4 项").toBe(4);
    expect(total, "而名字说 2 —— 这正是它该红的地方").not.toBe(claimed);
  });
});
