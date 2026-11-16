/**
 * 寿元的构成 —— 总数之外，「其中多少来自丹药与际遇」。
 *
 * ## 缺口（第 411 轮，从「只写不读的 store 字段」那一族里挑出来的）
 *
 * `player.lifespanMax` 的算式是三段：
 *
 * ```text
 *   lifespanMax = floor(base × (1 + lifespanPct) + lifespanBonusYears)
 *                  ├─ base                 境界给的基础寿元
 *                  ├─ lifespanPct          词条/天赋/丹药的百分比加成
 *                  └─ lifespanBonusYears   延寿丹与际遇**直接加的绝对年数**
 * ```
 *
 * 实测：`lifespanBonusYears` 在 26 个「只写不读」的 store 字段里，而人物页
 * 只报总数（「余 N 载 / 已过 X / Y」）。于是：
 *
 * ```text
 *   吃一颗延寿丹 → 总数变了 → 但这一颗值多少？下次要不要吃？为它凑材料值不值？
 * ```
 *
 * 全靠猜。而延寿丹是本作里**可炼、可买、有明确价目**的东西 —— 它的作用恰恰
 * 就是这一项，不露出来等于那颗丹在界面上没有分量。
 *
 * ## 判据
 *
 * ① 界面真的把那一栏印出来了（读模板，钉住 `data-character-lifespan-boons`）；
 * ② 印的是**那个数**，不是一句写死的话（插值形态，见第 410 轮踩过的坑）；
 * ③ 零值时不显示 —— 「延寿 0 载」只是噪音；
 * ④ 那一栏读的是 `player.lifespanBonusYears`，不是另算一份；
 * ⑤ 算式本身仍是三段之和（改算式会让这一栏失去意义）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(resolve(__dirname, "../views/CharacterView.vue"), "utf-8");
const STORE = readFileSync(resolve(__dirname, "../stores/player.ts"), "utf-8");

describe("寿元 · 其中多少来自丹药与际遇", () => {
  it("人物页真的把那一栏印出来了", () => {
    expect(VIEW, "人物页没有印「其中 N 载来自延寿丹与际遇」那一行").toMatch(
      /data-character-lifespan-boons/,
    );
    /*
     * ② 印的是那个数 —— 这一条是第 410 轮踩过的坑的直接产物:
     * 那时「反差」写成钉一个名字的出现,而那个名字在 `v-if` 里本来就存在,
     * 于是「把正文改成写死的文案」测不出来。这里直接要求插值形态。
     */
    expect(VIEW, "那一行没有插值那个数 —— 它会是一句永远不变的话").toMatch(
      /\{\{\s*formatNum\(lifespanFromBoons\)\s*\}\}/,
    );
  });

  it("零值时不显示 —— 「延寿 0 载」只是噪音", () => {
    /*
     * 守的是那个 `v-if="lifespanFromBoons > 0"`。
     * 若有人把它去掉，一个刚建号、还没吃过任何延寿丹的玩家也会看到
     * 「其中 0 载来自延寿丹与际遇」—— 那是把「没有」写成了一条读数。
     */
    const at = VIEW.indexOf("data-character-lifespan-boons");
    expect(at, "找不到那一行").toBeGreaterThan(0);
    // 往前找最近的 v-if（那一行的属性在此之前）
    const before = VIEW.slice(Math.max(0, at - 600), at);
    expect(before, "那一行没有「有加算才显示」的守卫").toMatch(/v-if="lifespanFromBoons > 0"/);
  });

  it("那一栏读的是 storage 里的真字段，不是另算一份", () => {
    /*
     * `lifespanFromBoons` 该从 `player.lifespanBonusYears` 取整得来。
     * 若有人改成 `lifespanMax - base` 之类，就会把百分比加成也算进「丹药与际遇」——
     * 那是两件不同的事，混在一起会让玩家以为一颗丹值那么多。
     */
    const start = VIEW.indexOf("const lifespanFromBoons");
    expect(start, "找不到 lifespanFromBoons").toBeGreaterThan(0);
    const body = VIEW.slice(start, start + 400);
    expect(body, "没有读 player.lifespanBonusYears").toMatch(/player\.lifespanBonusYears/);
    // 反差：不许拿 lifespanMax 减别的什么凑出来
    expect(body, "这一栏是从别处凑出来的 —— 会把百分比加成也算进来").not.toMatch(/lifespanMax\s*-/);
  });

  it("算式仍是三段之和 —— 改算式会让这一栏失去意义", () => {
    /*
     * 这一条钉的是**上游**:若 lifespanMax 哪天改成不再加 lifespanBonusYears，
     * 界面上那句「其中 N 载来自延寿丹」就成了假话 —— 它不再参与总寿元。
     */
    const start = STORE.indexOf("const lifespanMax = computed");
    expect(start, "找不到 lifespanMax 的算式").toBeGreaterThan(0);
    const body = STORE.slice(start, start + 400);
    expect(
      body,
      "lifespanMax 不再加 lifespanBonusYears —— 界面上那句「其中 N 载」就成了假话",
    ).toMatch(/lifespanBonusYears\.value/);
    expect(body, "lifespanMax 不再含 lifespanPct 那一项").toMatch(/lifespanPct/);
  });

  it("加算真的会在吃丹与际遇时发生 —— 那一栏不会是恒零", () => {
    /*
     * 反空转：`addLifespan` 必须真的被调用，否则界面上那一栏永远不出现，
     * 判据全绿而功能等于没做。
     */
    const engine = readFileSync(resolve(__dirname, "eventEngine.ts"), "utf-8");
    const pills = readFileSync(resolve(__dirname, "pillService.ts"), "utf-8");
    expect(engine, "际遇不再加寿元 —— 这一栏少了一半来源").toMatch(/addLifespan/);
    expect(pills, "延寿丹不再加寿元 —— 这一栏少了一半来源").toMatch(/addLifespan/);
  });
});
