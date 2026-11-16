/**
 * 终局玩家从首页出发，三件事都要在。
 *
 * ## 由来（第 428~431 轮）
 *
 * 四轮都在同一个位置上打转，每一轮修好一处、下一轮又在那处的边上找到一处：
 *
 * ```text
 *   第 428 轮  六支全空时 generateCurrentGoal 返回 null —— 首页那张卡整块不渲染
 *   第 429 轮  补的三支与旧五支挤在同一张脸下（标签写死「当前道途」）
 *   第 430 轮  第二支的「N 界已备」是假选择（五个界代价全同，N 只会是 0 或 5）
 *   第 431 轮  把这三层合起来验一遍
 * ```
 *
 * 分开看每一轮都对，但**没有一条判据回答「终局玩家从首页出发，需要的东西齐了吗」**。
 * 这一条就是那个问题。
 *
 * ## 三件事
 *
 * 一位真仙以上的玩家打开首页，该看到：
 *
 * ```text
 *   ① 目标卡       这一格要说什么（有的话不能是 null，也不许说假话）
 *   ② 天界入口卡   data-home-celestial —— 通往道途 / 远征 / 天道那一整套
 *   ③ 每日提示     「今日天道未做」—— 日常该有人提醒
 * ```
 *
 * 三者缺一，「终局没有什么可做」这句话就有一部分是真的。
 *
 * ## 判据
 *
 * ① 三件事在 `HomeView` 里都存在，且各自的门槛读 `WORLD_BREAK_MAJOR`；
 * ② 目标卡在六支全空时**不许返回 null**（第 428 轮的成果，回归守卫）；
 * ③ 那个数是门槛不是假选择（第 430 轮）；
 * ④ 三者的门槛**同源** —— 写死 9 的地方一律红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripComments } from "@/test/stripComments";
import { WORLD_BREAK_MAJOR } from "@/data/realms";

const HOME = readFileSync(resolve(__dirname, "../views/HomeView.vue"), "utf-8");
const GOAL = readFileSync(resolve(__dirname, "goal.ts"), "utf-8");

describe("终局玩家 · 首页三件事", () => {
  it("① 天界入口卡在，且门槛读常量", () => {
    expect(HOME, "首页没有天界入口卡").toContain("data-home-celestial");
    /*
     * 要定位的是**那一张元素自己的 `v-if`**，不是「往前 600 字里最近的 v-if」——
     * 初版用的正是后者,抓到的是上一张卡的 `VEIN_UNLOCK_MAJOR`（实测）。
     *
     * 正确做法：从 `data-home-celestial` 往回找到它自己的 `<RouterLink`,
     * 再在那一段里取 `v-if`。
     */
    const at = HOME.indexOf("data-home-celestial");
    const tagStart = HOME.lastIndexOf("<RouterLink", at);
    expect(tagStart, "找不到那张卡的开标签").toBeGreaterThan(0);
    const tag = HOME.slice(tagStart, at);
    const gate = /v-if="player\.major >= ([\w.]+)"/.exec(tag);
    expect(gate, "找不到天界入口卡的门槛").not.toBeNull();
    expect(
      gate![1],
      "天界入口卡的门槛写死了数字 —— 该读 WORLD_BREAK_MAJOR，与 endgameUnlocked 同一个",
    ).toBe("WORLD_BREAK_MAJOR");
  });

  it("① 每日提示在，且读的是同一个 dailyPending", () => {
    expect(HOME, "首页没有「今日天道未做」那句提示").toContain("今日天道未做");
    expect(HOME, "那句提示该读 dailyPending").toContain("dailyPending");
    /*
     * `dailyPending` 自己的门槛 —— 它也挂真仙上，不许另写一个数。
     */
    const at = HOME.indexOf("const dailyPending");
    expect(at, "找不到 dailyPending").toBeGreaterThan(0);
    const body = HOME.slice(at, HOME.indexOf("\n});", at));
    expect(body, "dailyPending 的门槛写死了数字").toContain("WORLD_BREAK_MAJOR");
  });

  it("① 目标卡在，且终局状态由调用方递进去", () => {
    expect(HOME, "首页没有目标卡").toContain("data-home-goal");
    /*
     * 第 428 轮的约束：`core/goal` 不 import endgame store，
     * 终局状态由 HomeView 递进去（见 layeringAudit 的 161 基线）。
     */
    expect(HOME, "目标卡没有把终局状态递给 generateCurrentGoal").toMatch(
      /generateCurrentGoal\(player,\s*\{/,
    );
    expect(
      stripComments(GOAL).includes("useEndgameStore"),
      "core/goal 又 import 了 endgame store —— layeringAudit 的基线会红",
    ).toBe(false);
  });

  it("② 六支全空时不许返回 null（第 428 轮的回归守卫）", () => {
    /*
     * 源码层：`goal.ts` 里那条终局分支的门槛必须是 WORLD_BREAK_MAJOR，
     * 且它前面有 `&& endgame` 这个「调用方递了状态」的条件。
     */
    const code = stripComments(GOAL);
    const at = code.indexOf("player.major >= WORLD_BREAK_MAJOR");
    expect(at, "找不到终局分支的门槛").toBeGreaterThan(0);
    const line = code.slice(at, code.indexOf("{", at));
    expect(
      line,
      "终局分支少了「调用方递了状态」这个条件 —— 不传 endgame 时会去读 undefined",
    ).toContain("&&");
  });

  it("③ 道源那一支报的是门槛，不是「N 界已备」", () => {
    const code = stripComments(GOAL);
    expect(code, "又写回了「N 界已备」—— 五个界的代价相同时，那个数是假选择").not.toMatch(
      /\d+ 界已备|`\$\{affordable\} 界已备/,
    );
    expect(code, "道源那一支该报门槛").toMatch(/每界 \$\{cheapest\} 起/);
  });

  it("④ 三处门槛同源 —— 全仓 core/goal 与 HomeView 里不许出现裸的真仙序号", () => {
    /*
     * `WORLD_BREAK_MAJOR` 是 9。裸写 9 在别处（比如「第 9 境」的文案）是正常的，
     * 故这里只查**比较表达式**：`major >= 9` / `major < 9` 这种。
     */
    for (const [name, src] of [
      ["HomeView", HOME],
      ["core/goal", GOAL],
    ] as const) {
      const code = stripComments(src);
      expect(
        new RegExp(`major\\s*[<>]=?\\s*${WORLD_BREAK_MAJOR}\\b`).test(code),
        `${name} 里出现了裸的 \`major >= ${WORLD_BREAK_MAJOR}\` —— 该读 WORLD_BREAK_MAJOR`,
      ).toBe(false);
    }
  });
});
