/**
 * 同一件事的两种读法 —— 今日写了「雷伤 +8%」，明日还写着「渡劫×1.08」。
 *
 * ## 由来（第 165 轮，新手第一屏）
 *
 * 上一轮把今日那一枚从裸乘数改成了带单位的:
 *
 * ```text
 * 今日   · 天时 雷鸣   灵气… · 今日渡劫 · 雷伤 +8%
 * ```
 *
 * 而**明日预告**那一句读的是另一处代码（`tomorrowBrief`），没跟着改:
 *
 * ```text
 * 下一天时雷鸣(攻击 +5% · 御劫 -5% · 渡劫×1.08)
 * ```
 *
 * 于是同一屏上并排出现两种读法:一个说「雷伤 +8%」，一个说「渡劫×1.08」。
 * 新手第一屏就会看到这两句 —— 他没法知道它们其实是同一件事。
 *
 * ## 这不是「上一轮漏了一处」
 *
 * 上一轮的判据只钉了 `HomeView` 里 `今日渡劫` 那一行，而 `tomorrowBrief` 是
 * 另一个 computed、另一种拼法（`` ` · 渡劫×${t.tribulationMult}` ``）。
 * 判据按「那一行长什么样」写的，就只守住了那一行。
 *
 * 这一条改成守**出口**:天时倍率出现在界面上时，单位词必须跟着它走 ——
 * 无论是今日还是明日、是本行还是预告。
 *
 * ## 判据
 *
 * ① 天时倍率在视图里只有**一处**拼法（今日与明日共用），不许各拼各的；
 * ② 任何一个 `tribulationMult` 的渲染点，近旁都要有单位词；
 * ③ 明日预告不许再出现裸的 `渡劫×N`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { WEATHERS } from "@/core/weather";

const HOME = readSource("src/views/HomeView.vue");

/** 抹掉注释 —— 注释里举例说明旧写法时，那段字不是玩家看得见的文案 */
function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CODE = stripComments(HOME);

describe("天时倍率 · 一个出口，一种读法", () => {
  it("倍率作用在雷伤上（语义）", () => {
    const withMult = WEATHERS.filter((w) => w.tribulationMult > 1);
    expect(withMult.length, "至少得有一个加险的天时").toBeGreaterThan(0);
    for (const w of withMult) expect(w.tribulationMult).toBeGreaterThan(1);
  });

  it("视图里不许再有裸的「渡劫×N」", () => {
    /*
     * 这一条正是**上一轮漏掉的那一句**。它写成模板字符串里的
     * `` ` · 渡劫×${t.tribulationMult}` ``，与今日那一行不是同一处。
     */
    expect(CODE, "明日预告还在用裸乘数").not.toMatch(/渡劫×\$\{/);
    expect(CODE, "渲染出来的文字里也不许出现裸「渡劫×」").not.toMatch(/>[^<]*渡劫×\s*\d/);
  });

  it("今日与明日走同一个出口，不是一个各拼一句", () => {
    /*
     * 判那件事:两处都调**同一个**格式化函数（`tribulationLine`），
     * 而不是各自往模板里拼一句。上一轮的病根正是「各拼一句」——
     * 判据若只验「两处都出现了雷伤二字」，改成两处各写一遍也照样绿。
     */
    expect(CODE, "要有一个共用的格式化函数").toMatch(
      /function tribulationLine|const tribulationLine/,
    );

    /*
     * 取「模板里那一次调用」—— 不能只找 `weatherTribulation` 这几个字:
     * 它在 computed 的定义里也出现（`weather.value.tribulationMult > 1 ? ...`），
     * 而从那里往后 300 字都走不到模板。故直接找模板里那一行。
     */
    const todayBlock =
      />\s*今日渡劫[^<]*tribulationLine\(weatherTribulation\)[^<]*</.exec(CODE)?.[0] ?? "";
    expect(todayBlock, "今日那一行没有调共用的函数").not.toBe("");

    const tomorrowBlock = /tomorrowBrief\s*=\s*computed[\s\S]{0,700}?\}\);/.exec(CODE)?.[0] ?? "";
    expect(tomorrowBlock, "找不到明日那一句").not.toBe("");
    expect(tomorrowBlock, "明日那句也要调同一个函数").toMatch(/tribulationLine\(/);

    // 那个函数本身得说出单位
    const fnBlock = /function tribulationLine\([\s\S]{0,300}?\n\}/.exec(CODE)?.[0] ?? "";
    expect(fnBlock, "找不到函数体").not.toBe("");
    expect(fnBlock, "函数里没有单位词").toMatch(/雷伤|雷威|每道雷|伤害/);
  });
});
