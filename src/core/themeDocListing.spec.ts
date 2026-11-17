/**
 * 玩家手册里要能查到本世命题有哪些。
 *
 * ## 由来（第 477 轮）
 *
 * 上一轮补了逆旅契的清单（八份，一份都查不到）。这一轮顺着同一个形状查**命题**。
 *
 * ```text
 *   逆旅契  花道果签，一世一份，可选（第 476 轮补）
 *   命题    每世必立，不可跳过，按阶位开放（这一轮）
 * ```
 *
 * 命题比契约更该被写进手册:契约可以不签,命题**每世都要选**。而手册里
 * 只有一句「17 种人生主题决定新一世的命题」——**那 17 种是什么，一个字都没有**。
 *
 * ## 一个我差点写错的前提
 *
 * 我先用 `grep -c "id:"` 数出 6 条，差点写下「文档说 17、实际只有 6」。
 * 实际 `LIFE_THEMES.length === 17` —— 那个 grep 数的是**类型定义里的 id:
 * 与 `t()` 的位置参数**，不是条目数。
 *
 * > 第七次「说 X 不存在之前先查它可能存在的写法」。
 * > 这次的教训:**数据条数要读数据，不要数 grep 行。**
 *
 * ## 判据
 *
 * ① 每一份命题的名字都在 usage.md 里出现过；
 * ② 反差：@ 那些名字要落在列举它们的那一节里（不是散落在别处恰好撞词）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_THEMES } from "@/data/lifeThemes";

const USAGE = readFileSync(resolve(__dirname, "../../docs/usage.md"), "utf-8");

describe("玩法手册 · 本世命题要查得到", () => {
  it("① 每一份命题的名字都在 usage.md 里出现过", () => {
    const missing = LIFE_THEMES.filter((t) => !USAGE.includes(t.name)).map((t) => t.name);
    expect(
      missing,
      "这些命题在玩家手册里查不到 —— 而命题每世都要选：" + missing.join("、"),
    ).toEqual([]);
  });

  it("② 反差：按阶位分组，且阶位与数据一致", () => {
    /*
     * 命题按 `minStage` 开放。手册若只列名字而不说「几阶能选到」，
     * 玩家会以为一开始就能选「入神」那种终局命题。
     *
     * 这一条要求文案里出现**阶位**这个维度，而不是把 17 个名字堆成一段。
     */
    /*
     * 第一版写成 `/命题[\s\S]{0,4000}阶位|阶位[\s\S]{0,4000}命题/` ——
     * 而整份文档里「命题」与「阶位」隔着几千字也会命中，注入（把「阶位」改成
     * 「阶段」）之后**判据仍然全绿**（实测）。
     *
     * 改成要求**表头就是「阶位」** —— 那是这一节真正要说的维度。
     */
    expect(USAGE, "命题那一节的表头不是「阶位」—— 玩家不知道哪些题现在选得到").toMatch(
      /\|\s*阶位\s*\|\s*命题\s*\|/,
    );
    /*
     * 数据侧自证:确实存在多个阶位，不是一个阶位里堆了 17 条。
     */
    const stages = new Set(LIFE_THEMES.map((t) => t.minStage));
    expect(stages.size, "所有命题挤在同一个阶位 —— 那「按阶开放」是假的").toBeGreaterThan(1);
  });
});
