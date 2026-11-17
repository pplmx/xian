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
import { stripComments } from "@/test/stripComments";

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

  it("6. 历世卷那张终局印记也要报门槛 —— 同一份数据的第三处", () => {
    /*
     * ## 第三处（第 539 轮）
     *
     * 第 536 轮修了 `ApexSeal`，第 537 轮修了 `ApexBriefing` ——
     * 而 `record.marks` **还有第三处**:`LegacyView` 的「此世终笔」那一格。
     *
     * ```text
     *   {{ apexRecordRow.daoText }} · {{ apexRecordRow.marks }} 则道痕 ·
     *   {{ apexRecordRow.milestones.done }}/{{ ... }} 枚碑记
     * ```
     *
     * 只有当前值，没有成形与否、没有门槛。
     *
     * > 前两轮我各修一处、以为改完了。这一轮才把「同一个数有几处」问到底 ——
     * > 而答案是三处，不是两处。
     */
    const legacy = readFileSync(resolve(__dirname, "../views/LegacyView.vue"), "utf8");
    expect(legacy, "历世卷不再报道痕 —— 判据的前提要重看").toMatch(/apexRecordRow\.marks/);
    /*
     * ## 这一条收紧过一次（第 539 轮）
     *
     * 第一版把窗口开到 ±700/500 字符去找 `PROFILE_MIN_MARKS` ——
     * 而那个文件**早就 import 了** `PROFILE_MIN_MARKS`（供别处用），
     * 于是窗口里总能扫到它，**判据恒绿**，注入把门槛删掉也测不出来。
     *
     * 收紧成:紧跟在 `apexRecordRow.marks` 之后那一小段里要同时出现
     * 「门槛常量」与「原位」。窗口从 700 收到 240。
     */
    const at = legacy.indexOf("{{ apexRecordRow.marks }}");
    expect(at, "历世卷那一行的写法变了 —— 判据的前提要重看").toBeGreaterThan(0);
    const near = legacy.slice(at, at + 240);
    expect(
      near,
      "历世卷只报「N 则道痕」，既不说成没成形，也不说门槛 —— " +
        "而同一个数在修行页与首页都已经报了「已 N 则，成形需 M 则」。近处实际是：" +
        near.slice(0, 120),
    ).toContain("PROFILE_MIN_MARKS");
    expect(near, "没报成没成形 —— 与本仓另两处不一致").toMatch(/profileFormed|成形|尚浅/);
  });

  it("7. 三处显示同一份数的地方，每一处的字段都要齐", () => {
    /*
     * ## 把前三轮的人工数次数，变成一条自动的（第 540 轮）
     *
     * 第 536/537/539 轮各修一处 `record.marks` 的显示点，三次都是「找到一处、改好、以为完了」。
     * 而那是**人工数**出来的 —— 下一个人加第四处时，没有任何东西会提醒他。
     *
     * 这一条守的是**三处必须同时具备同样的字段**:
     *
     * ```text
     *   marks           当前值
     *   profileFormed   成没成形
     *   门槛            成形需几则（PROFILE_MIN_MARKS）
     * ```
     *
     * 任意一处缺一项，它就与另两处说得不一样。
     */
    const sites = [
      "components/cultivation/ApexSeal.vue",
      "components/common/ApexBriefing.vue",
      "views/LegacyView.vue",
    ] as const;
    for (const rel of sites) {
      /*
       * ## 这一条也补过一次（第 540 轮）
       *
       * 第一版直接在原文里找 `PROFILE_MIN_MARKS` —— 而三处的**注释里都提到了它**
       * （那几轮改动时写的说明），于是把 import 与用法一起删掉，判据照样绿。
       *
       * 与第 539 轮同一个毛病:判据要守的那个名字，文件里本来就有别处在用它 ——
       * 只是那一轮的「别处」是 import，这一轮的「别处」是注释。
       *
       * 剥掉注释再查。`stripComments` 是本仓现成的（`stripCommentsParity.spec` 守着只许有一份）。
       */
      const src = stripComments(readFileSync(resolve(__dirname, "..", rel), "utf8"));
      for (const field of ["marks", "profileFormed", "PROFILE_MIN_MARKS"]) {
        expect(src, `${rel} 缺了「${field}」—— 它与另两处对同一份数的说法不一致了`).toContain(
          field,
        );
      }
    }
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
