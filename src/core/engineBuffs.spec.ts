/**
 * 增益系统的三条契约 —— 文件头列了,此前没有判据。
 *
 * ## 缺口(第 111 轮实测)
 *
 * 扫「文件头列了多条契约但连 spec 都没有」的模块,共 5 个。
 * `engineBuffs.ts`(228 行)是其中最大、也最有实质逻辑的一个。它的文件头写着:
 *
 * ```text
 *   · 内容表写的是**秒**,而运行时时钟与存档都是**毫秒**(Date.now()),
 *     故建库时声明 clock: 'ms' —— 库里的 endsAt 就是存档里的 endsAt,不再各处 ×1000;
 *   · 存档里的键叫 defId,库里叫 id(换名要动所有老档,不值当),进出口各转一次。
 *   · 读取口径:问的是「此刻还算不算数」(库的 active,到期即散),
 *     而不是「列表里有没有」—— 列表里那些已经过期、还没被心跳剪掉的,
 *     不该继续算进属性(见 ISS-231)。
 * ```
 *
 * 另有一条 ISS-232 的时长上限:**单颗时长的 2 倍**(`CONSUMABLE_BUFF_CAP_MULT`)。
 *
 * ## 为什么时钟那一条最要紧
 *
 * 秒与毫秒混用是这类系统最经典的 bug:某处忘了 ×1000,增益就只持续 1/1000 的时长;
 * 某处多乘了一次,就变成 1000 倍。注释说「不再各处 ×1000」,意思是**换算只发生在建库时**。
 * 判据要看的就是:**源码里没有散落的 1000**。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { CONSUMABLE_BUFF_CAP_MULT } from "./engineBuffs";

const SRC = readFileSync(join(ROOT, "src/core/engineBuffs.ts"), "utf8");

describe("增益系统 · 三条契约", () => {
  it("① 时钟声明为毫秒 —— 换算只在建库时发生", () => {
    expect(SRC, '建库配置里没有 clock: "ms" —— 秒与毫秒会在各处混用').toContain('clock: "ms"');

    /*
     * 更要紧的是**别处不许再转换**。注释说「不再各处 ×1000」:
     * 若源码里出现 `* 1000` 或 `/ 1000`,说明换算被搬回了一处调用点,
     * 而建库时已经声明了单位 —— 两处各转一次,结果会差 1000 倍。
     *
     * 排除:注释行。注释里出现「×1000」是在说明历史,不是代码。
     */
    const codeLines = SRC.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
    const strays = codeLines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /[*/]\s*1000\b/.test(l))
      .map(({ l }) => l.trim().slice(0, 60));
    expect(
      strays,
      '代码里出现了散落的 ×1000 或 ÷1000 —— 建库已声明 clock: "ms",再转一次就差 1000 倍:' +
        strays.join(" / "),
    ).toEqual([]);
  });

  it("② defId ↔ id 的转换在进出口各一次", () => {
    /*
     * 存档用 `defId`、库用 `id`。判据只查两件事:
     * - 有这么一处映射(把 defId 读成 id、或反过来);
     * - 类型定义里 `BuffInstance` 的 `defId` 仍被引用(说明这层转换还需要存在)。
     */
    expect(/defId/.test(SRC), "源码里找不到 defId —— 存档与库的键名转换不见了").toBe(true);
    expect(
      /id:\s*\w*\.defId|defId:\s*\w*\.id/.test(SRC),
      "找不到 defId ↔ id 的映射 —— 存档读进来会缺 id,或写出去会丢 defId",
    ).toBe(true);
  });

  it("③ 时长上限是「单颗时长的 2 倍」,且只封可消耗的那一类", () => {
    expect(CONSUMABLE_BUFF_CAP_MULT, "上限倍数不再是 2 —— 注释与界面文案都要一起复查").toBe(2);

    // 上限只给可消耗增益:条件分支必须存在
    expect(
      SRC.includes("CONSUMABLE_BUFF_IDS.has("),
      "找不到 CONSUMABLE_BUFF_IDS 的判定 —— 所有状态都会被封顶",
    ).toBe(true);

    /*
     * `maxDurationSec` 与 `buffCapSec` 必须**读同一个乘数**。
     * 若一处写 `× 2`、另一处读常量,改常量时两边就分叉 —— 界面说「至多 X」、
     * 结算按另一个数,正是 AGENTS.md 说的「改常数就撒谎」。
     */
    const multUses = SRC.match(/CONSUMABLE_BUFF_CAP_MULT/g) ?? [];
    expect(
      multUses.length,
      `CONSUMABLE_BUFF_CAP_MULT 只被用了 ${multUses.length} 次 —— 建库与 buffCapSec 应各一次`,
    ).toBeGreaterThanOrEqual(2);
    // 不许有字面量 2 冒充乘数
    const literalMults = SRC.split("\n")
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .filter((l) => /durationSec\s*\*\s*2\b/.test(l));
    expect(
      literalMults,
      "有地方直接把 durationSec 乘 2 —— 改常量时这里不会跟着变:" + literalMults.join(" / "),
    ).toEqual([]);
  });

  it("反空转:源码读得到,三契约的关键 token 都在", () => {
    expect(SRC.length, "engineBuffs.ts 读不到").toBeGreaterThan(3000);
    for (const token of ["createBuffSystem", "clock", "CONSUMABLE_BUFF_CAP_MULT", "defId"]) {
      expect(SRC.includes(token), `源码里找不到 ${token} —— 结构变了,这条判据要重写`).toBe(true);
    }
  });
});
