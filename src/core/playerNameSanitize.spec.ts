/**
 * 道号也要 sanitize —— `sanitize()` 修了十几个字段，唯独没修 name。
 *
 * ## 由来（第 170 轮，坏档压力测试）
 *
 * 往存档里塞一个错类型的道号（`name: 12345`），页面顶栏照原样印出来:
 *
 * ```text
 * 玄 一 12345 炼气·一层 320/150载 0 1
 * ```
 *
 * 同一份坏档里，`major: "abc"` 被规整成炼气·一层、`NaN` 灵石被规整成 0、
 * `sub: null` 被夹回 0 —— **`sanitize()` 把别的字段都修了，只有道号没修。**
 *
 * ## 为什么这个字段也要修
 *
 * `sanitize()` 的判据一条不是「好看」，而是**下游会崩或会撒谎**。道号两样都沾:
 *
 * - **会崩**:名字进模板插值。一个对象/数组进来会印成 `[object Object]` 或一长串；
 *   更实际的是一条超长字符串把顶栏顶穿（`setName` 裁到 8 字，读档这条路不裁）;
 * - **会撒谎**:数字 `12345`、布尔 `true`、`null` 进来时，界面会当作真名印出去 ——
 *   玩家看到的不是「无名散修」而是某种残留物，而**没有任何一处提示这份档是坏的**。
 *
 * 与 `lifespanBonusYears` 那条注释同一个口径:「写坏(字符串/NaN)会让它变 NaN」——
 * 只是道号坏掉时不会立刻死，而是**悄悄显示一个不是名字的东西**。
 *
 * ## 判据
 *
 * ① 读档后道号必须是**非空字符串**，且不超 `PLAYER_NAME_MAX`;
 * ② 坏值回落到默认道号（`无名散修`），不是空串 —— 空串会让顶栏那一格塌掉;
 * ③ 正常名字原样保留（sanitize 不许改写合法数据）。
 *
 * ## 故障注入
 *
 * 把 `player.sanitize()` 里那段道号修形删掉 → 五条同时红（数字/null/对象/超长/空白）。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePlayerStore, PLAYER_NAME_MAX } from "@/stores/player";

const DEFAULT_NAME = "无名散修";

/** 造一个已初始化的 store，然后直接改 name（模拟坏档读进来） */
function withName(raw: unknown): string {
  setActivePinia(createPinia());
  const player = usePlayerStore();
  player.initCharacter("测试道号", { roots: [] } as never);
  (player as unknown as { name: unknown }).name = raw;
  player.sanitize();
  return player.name as string;
}

describe("道号 · 读档之后必须是一个名字", () => {
  it("数字进来 → 回落到默认道号，不是「12345」", () => {
    const name = withName(12345);
    expect(name, "数字被当成道号印出来了").toBe(DEFAULT_NAME);
  });

  it("null / undefined / 布尔 → 回落到默认道号", () => {
    expect(withName(null)).toBe(DEFAULT_NAME);
    expect(withName(undefined)).toBe(DEFAULT_NAME);
    expect(withName(true)).toBe(DEFAULT_NAME);
  });

  it("对象进来 → 不印成 [object Object]", () => {
    const name = withName({ evil: true });
    expect(name).toBe(DEFAULT_NAME);
    expect(name).not.toContain("[object");
  });

  it("超长名字要裁到上限 —— setName 裁了，读档这条路也得裁", () => {
    const long = "玄".repeat(PLAYER_NAME_MAX + 20);
    const name = withName(long);
    expect(name.length, "读档进来一个超长道号，顶栏会被顶穿").toBeLessThanOrEqual(PLAYER_NAME_MAX);
    expect(name).not.toBe(DEFAULT_NAME);
  });

  it("空串 / 全空白 → 回落到默认道号（不是留一个空格子）", () => {
    expect(withName("")).toBe(DEFAULT_NAME);
    expect(withName("   ")).toBe(DEFAULT_NAME);
  });

  it("合法名字原样保留 —— sanitize 不许改写正常数据", () => {
    expect(withName("萧听雪")).toBe("萧听雪");
    // 上限边界:正好 PLAYER_NAME_MAX 个字
    const edge = "玄".repeat(PLAYER_NAME_MAX);
    expect(withName(edge)).toBe(edge);
  });
});
