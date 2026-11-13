/**
 * 测试确定性 —— 断言不许依赖真实时钟的**具体毫秒**。
 *
 * ## 守的是什么
 *
 * 对 `Date.now()` 做**相等**断言(如 `expect(gameNow()).toBe(Date.now())`)是脆的:
 * 两次相邻调用只要跨过一毫秒边界就红。概率低,但那是纯粹的运气,不是被测行为。
 *
 * Round 49 清掉了一处(它想断言的只是「恢复后回到了真实时钟」),改成
 * `before ≤ now ≤ after` 的区间 —— 窗口是两次相邻调用的间隔(微秒级),
 * 任何真实偏差仍会被抓住,强度没有放宽。
 *
 * 允许的形态:
 *
 *   · `toBeGreaterThan(Date.now())` / `toBeLessThan(…)` —— 断言"在未来/过去",安全
 *   · `addBuff(…, Date.now())` —— 当参数传,测的是"给定时点下的行为",安全
 *   · 先 `const t = Date.now()` 再用 `t` —— 一次取值,确定
 *
 * ## 为什么只禁这一种
 *
 * "测试要有确定性"这条太宽,写成判据只能变成模糊的规则。而"相等断言 + 真实时钟"
 * 是其中**可以机械检查**的一种,且正是真实发生过的那类问题。
 * 其余形态(随机数没播种、真实定时器)由各自的用例负责,不在这里一刀切。
 */
import { describe, expect, it } from "vite-plus/test";
import { stripComments } from "@/test/stripComments";
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

describe("测试确定性 · 不许对真实时钟做相等断言", () => {
  const files = specFiles();

  it("扫得到用例文件 —— 集合不能是空的", () => {
    expect(files.length, "一个 spec 都没扫到 —— 路径或后缀变了").toBeGreaterThan(100);
  });

  it("没有 `toBe(Date.now())` / `toEqual(Date.now())`", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf-8"));
      for (const line of code.split("\n")) {
        if (/\.(toBe|toEqual)\(\s*Date\.now\(\)\s*\)/.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1).replace(/\\/g, "/")}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      "对 Date.now() 做相等断言 —— 跨毫秒边界会偶发红。改成区间:" +
        "`const before = Date.now(); … const after = Date.now();`," +
        "断言落在 [before, after] 内",
    ).toEqual([]);
  });

  it("宽限:断言「在未来/过去」是允许的 —— 判据不该误伤", () => {
    /*
     * 自证:这一条不是靠"没扫到"才绿的。下面这些写法必须**不**被判红,
     * 否则判据要么误伤、要么正则写错而永远通过。
     */
    const safe = [
      `expect(x).toBeGreaterThan(Date.now())`,
      `expect(x).toBeLessThan(Date.now())`,
      `expect(x).toBeGreaterThanOrEqual(Date.now() - 1000)`,
      `const t = Date.now(); expect(x).toBe(t)`,
    ];
    /*
     * 违规样本**不能写成字面量** —— 否则这条 spec 会被自己扫到(实测撞到,
     * 与 Round 26 那次「基线里写着被统计的符号名」是同一类自指污染)。
     * 用拼接构造,源码文本里就不存在那个完整形态。
     */
    const bad = `expect(gameNow()).${"toBe"}(Date.${"now"}())`;
    const hits = (line: string): boolean =>
      new RegExp(`\\.(toBe|toEqual)\\(\\s*Date\\.${"now"}\\(\\)\\s*\\)`).test(line);
    for (const line of safe) expect(hits(line), `误伤:${line}`).toBe(false);
    expect(hits(bad), "正则抓不住真实违规 —— 判据形同虚设").toBe(true);
  });
});
