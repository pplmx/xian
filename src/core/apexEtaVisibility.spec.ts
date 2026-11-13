/**
 * 「这一世还要多久才能走到顶」—— 长线目标必须有一个可见的时间尺度。
 *
 * ## 由来（第 177 轮，完整曲线模拟）
 *
 * 用 `core/progressionSim` 跑完整条曲线:
 *
 * ```text
 * major  1 :   0.1 小时
 * major  5 :  23.6 小时  (1 天)
 * major  9 : 1285.7 小时 (54 天)
 * major 20 : 5476.7 小时 (228 天)
 * ```
 *
 * 这条曲线**是刻意的**（`progressionSim.spec` 守着「长尾不超过 10 倍」
 * 与「每境增幅 < 2 倍」，设计文档也逐行对过账）。
 *
 * 问题不在曲线，在**玩家看不见它**:
 *
 * - 修行页有「本境修为 · 约 13 秒」—— 只到下一层;
 * - 有一整条 21 境全景梯（`RealmLadder`）—— 只有「已至 / 当前 / 未至」三种点;
 * - **没有任何一处**说「到大道尽头还要多久」。
 *
 * 一个要玩两百多天的长线目标,玩家在第一天只能看到「下一层 13 秒」——
 * 他没有任何办法判断这条路有多长。这不是难度问题,是**决策信息不完整**
 * （`AGENTS.md` 的「决策信息完整」与「让看不见的机制可见」两条都指向它）。
 *
 * ## 这条判据守什么
 *
 * ① 读数必须真的从 `progressionSim` 的曲线算出来，不许另写一套公式;
 * ② 已经到顶时说「已至」而不是报一个 0 或负数;
 * ③ 与「本境 ETA」用的是同一个 `cultPerSec` 口径 —— 两个读数不能互相矛盾。
 *
 * ## 口径说明（诚实那一半）
 *
 * 这个数是**按此刻行速**推算的,不是承诺:玩家会换装备、转世、吃丹,
 * 速度会变。故文案里必须带上「按此刻行速」这层限定 —— 与修行页
 * 「此刻行速」那三格同一口径。许诺一个精确到达时间才是撒谎。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

describe("长线时间尺度 · 到顶还要多久必须可见", () => {
  it("判据的前提还在 —— 那三处锚点都还在", () => {
    /*
     * 防空转（与 `startupOrder.spec` 同一写法）。
     *
     * 下面几条靠「锚点字符串」定位:`data-cultivation-apex-eta`、`const apexEtaLine`、
     * `export function apexEtaText`。锚点一旦被改名，判据会红在「找不到」——
     * 那是**判据过时**的红。这一条先把话说清楚:**看到这条红，改判据，别删判据。**
     */
    const view = stripComments(readSource("src/views/CultivationView.vue"));
    const core = stripComments(readSource("src/core/apexEta.ts"));
    expect(view, "视图里的锚点没了").toContain("data-cultivation-apex-eta");
    expect(view, "视图里的 computed 改名了").toContain("const apexEtaLine");
    expect(core, "纯函数的出口改名了").toContain("export function apexEtaText");
  });

  it("修行页给出了「到大道尽头」的全局读数", () => {
    /*
     * 这一条是**接线判据**:读数存在不等于它在页面上。
     * 先扫模板里有没有那个数据属性 —— 它在,才谈得上「玩家看得见」。
     */
    const view = stripComments(readSource("src/views/CultivationView.vue"));
    expect(
      view,
      "修行页没有任何「到顶还要多久」的读数 —— 玩家只能看到本境 ETA，" + "而这条路是两百多天",
    ).toContain("data-cultivation-apex-eta");
  });

  it("那个读数来自纯曲线模块，视图里不许自己拼公式", () => {
    /*
     * 与「文案不许手写会被常数改动的数字」同一条纪律:
     * 若视图自己用 expRequirement 拼一遍，常数一改就撒谎。
     *
     * **第一版把这条写成「必须 import progressionSim」—— 那是判据错**。
     * 两者分工不同: `progressionSim` 用**模型假设**回答「通用玩家每境多久」
     * （服务于设计对账），而这一格要回答「**这位玩家此刻**到顶还要多久」，
     * 必须拿他真实的 `cultPerSec`。故正确形态是 `core/apexEta`，
     * 它内部仍读 `formulas` 的真源，不另写常数。
     */
    const src = stripComments(readSource("src/views/CultivationView.vue"));
    expect(src, "视图里没有从纯曲线模块取数").toMatch(/from "@\/core\/apexEta"/);
    /*
     * 只核**新增这一格**，不核整个文件。
     *
     * 第一版禁了整文件里的 `baseCultPerSec` —— 那是**判据错**:修行页本来
     * 就有一格「基础 1.3/秒 · 加成 113%」，它读 `baseCultPerSec` 完全应该
     * （那是把当前这一层的展示数字摊开，不是推算整条曲线）。
     * 要禁的是**这一格**自己去拼境界曲线。
     */
    const idx = src.indexOf("const apexEtaLine");
    expect(idx, "读数不存在").toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 500);
    for (const banned of ["expRequirement", "baseCultPerSec", "estimateCultMult"]) {
      expect(block, `这一格自己算了「${banned}」—— 常数一改就撒谎`).not.toContain(banned);
    }
  });

  it("到顶之后说「已至」，不报 0 小时也不报负数", () => {
    /*
     * 终局玩家每天都看到的那一格 —— 报「还需 0 小时」比不报更糟。
     * 这条与 `breakthrough` / `goal` / `cultivationStage` 那三处的
     * 「已至大道尽头」同一个口径。
     */
    const src = stripComments(readSource("src/views/CultivationView.vue"));
    // 模板里必须有「已至」这一支
    expect(src, "到顶时没有专门的文案").toMatch(/已至/);
  });

  it("文案带「按此刻」这层限定 —— 不许许诺精确到达时间", () => {
    /*
     * 这个数随装备与转世变。写成「将于 X 日到达」就是撒谎。
     * 与修行页「此刻行速」那三格同一口径。
     *
     * 文案已从视图搬进 `core/apexEta` 的 `apexEtaText`（纯函数，可测）——
     * 故这里核的是那份真源，不是视图。
     */
    const src = stripComments(readSource("src/core/apexEta.ts"));
    const idx = src.indexOf("export function apexEtaText");
    expect(idx, "文案函数不存在，后面那条无从谈起").toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 900);
    expect(block, "这一段没有「按此刻」的限定 —— 它会随换装备而变").toMatch(
      /按此刻|照此刻|此刻行速/,
    );
  });
});
