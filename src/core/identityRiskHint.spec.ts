/**
 * 「行迹尚浅，还不足以判读风险取向」—— 而门槛只是一次行动。
 *
 * ## 由来（第 536 轮）
 *
 * 顺着第 535 轮那个形状（界面说清当下、没说下一步）扫「不足」类文案，
 * 落到 `IdentityDialog` 的风险一行:
 *
 * ```ts
 *   return "行迹尚浅，还不足以判读风险取向。";
 * ```
 *
 * 而它的判据在 `identityService`:
 *
 * ```ts
 *   kills + explores + breakthroughs > 0 ? (kills >= explores * 2 ? "gamble" : "steady") : null
 * ```
 *
 * **门槛只是一次行动。** 故这句话只出现在「这一世一次都还没动过」的时候 ——
 * 而那时玩家需要的不是「还差多少」，是「去做什么」。
 *
 * ## 判据
 *
 * ① 那一句要给出下一步（去历练 / 出手 / 破境 之类）;
 * ② 反差：有行迹之后不许再出现这一句（那时它有结论）;
 * ③ 反差：门槛与 `identityService` 同源 —— 不许在这里另写一个数。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIALOG = readFileSync(
  resolve(__dirname, "../components/character/IdentityDialog.vue"),
  "utf8",
);
const SERVICE = readFileSync(resolve(__dirname, "identityService.ts"), "utf8");

describe("行迹 · 尚浅之后去做什么", () => {
  it("① 那一句要给出下一步", () => {
    const m = DIALOG.match(/"行迹尚浅[^"]*"/);
    expect(m, "找不到那一句 —— 判据的前提要重看").toBeTruthy();
    const text = m![0];
    /*
     * 门槛是「一次行动都没做过」，故该说「去出手 / 去历练 / 去破境」。
     */
    expect(
      text,
      `那句只说了「还判不出来」，没说「去做什么」—— 而门槛只是一次行动。现在写的是：${text}`,
    ).toMatch(/历练|出手|一行|破境|走一遭|动手/);
  });

  it("② 反差：有行迹之后不许再出现这一句", () => {
    /*
     * 这一条守的是①的边界 —— 那句话只该在 null 分支里。
     * 若它被搬到有结论的分支，就成了一句永远说「不知道」的废话。
     */
    const at = DIALOG.indexOf("const riskLine");
    expect(at, "riskLine 定位不到").toBeGreaterThan(0);
    const body = DIALOG.slice(at, at + 700);
    /* 两个有结论的分支各自返回自己的句子 */
    expect(body, "gamble 分支不见了").toContain('risk === "gamble"');
    expect(body, "steady 分支不见了").toContain('risk === "steady"');
  });

  it("④ 道痕「未成形」也要说差几则 —— 同一句口径", () => {
    /*
     * ## 同一形状的第二处（第 536 轮）
     *
     * `ApexSeal` 那一行:
     *
     * ```text
     *   道痕   12 则   「道痕尚浅,画像未成形」
     * ```
     *
     * 有当前值、有结论，而**没有门槛** —— 玩家不知道还差几则。
     * 门槛是 `PROFILE_MIN_MARKS = 5`（core/identity），就在旁边却没说。
     *
     * 这与第 529 轮那条「差额要给出来」是同一条纪律，只是那里是花费、
     * 这里是进度。
     */
    const seal = readFileSync(resolve(__dirname, "../components/cultivation/ApexSeal.vue"), "utf8");
    expect(seal, "找不到「画像未成形」那一句 —— 判据的前提要重看").toMatch(/道痕尚浅|画像未成形/);
    const at = seal.indexOf("道痕尚浅");
    const near = seal.slice(Math.max(0, at - 900), at + 400);
    expect(near, "「画像未成形」没说门槛也没说差多少 —— 玩家看到 N 则，却不知道该攒到几则").toMatch(
      /PROFILE_MIN_MARKS|成形需|还需|尚差|\/ *\{\{/,
    );
  });

  it("5. 首页那张终局简报也要报门槛 —— 同一份数据的第二处", () => {
    /*
     * ## 同一份数据的第二处（第 537 轮）
     *
     * 上一轮给 `ApexSeal` 补了「已 N 则，成形需 5 则」。而 `record.marks`
     * 在首页那张终局简报里**也出现一次**:
     *
     * ```text
     *   此生已尽 · 第 3 世 · 12 部功法 · 12 则道痕
     * ```
     *
     * 那里只有当前值，既没有结论（成没成形），也没有门槛 ——
     * 与上一轮修掉的 `ApexSeal` 是同一个数、同一件事，两处说的不一样。
     *
     * 判据：两处要么都说门槛，要么都不说 —— 不许一处说、一处不说。
     */
    const brief = readFileSync(resolve(__dirname, "../components/common/ApexBriefing.vue"), "utf8");
    expect(brief, "首页简报不再报道痕 —— 判据的前提要重看").toMatch(/record\.marks/);
    const at = brief.indexOf("record.marks");
    const near = brief.slice(Math.max(0, at - 500), at + 400);
    expect(
      near,
      "首页简报只报「N 则道痕」，既不说成没成形，也不说门槛 —— " +
        "而同一份数据在修行页已经报了「已 N 则，成形需 M 则」",
    ).toMatch(/PROFILE_MIN_MARKS|成形|尚未成/);
  });

  it("③ 反差：门槛与 identityService 同源", () => {
    /*
     * 界面不该另写一个门槛数。这一条确认真正判「有没有行迹」的那一行还在
     * `identityService`（`… > 0`），而不是被搬进视图。
     */
    expect(SERVICE, "identityService 里那条门槛不见了 —— 判据③的前提变了").toMatch(
      /kills \+ explores \+ breakthroughs > 0/,
    );
  });
});
