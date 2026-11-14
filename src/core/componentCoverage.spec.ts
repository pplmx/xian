/**
 * 组件层的覆盖基线 —— 134 个 `.vue` 里只有 4 个没被任何 spec 提到。
 *
 * ## 由来（第 236 轮，沿用第 235 轮那个方法）
 *
 * 上一轮量的是 `export function`（1364 个，96 个零覆盖）。这一轮把同一个方法用到
 * `.vue` 组件上:
 *
 * ```text
 * src 下 .vue 组件          134
 * 在任何 spec 里被提到       130
 * 零提及                      4
 *   components/common/InstallToHomeNotice.vue
 *   components/common/SectionMark.vue
 *   components/common/UpdatePrompt.vue
 *   components/common/ValueRow.vue
 * ```
 *
 * 抽查那四个:
 *
 * ```text
 * UpdatePrompt        36 行模板，逻辑全在 useServiceWorkerUpdate（那个有 spec）
 * ValueRow            29 行纯展示，无业务逻辑
 * SectionMark         13 行纯展示
 * InstallToHomeNotice 46 行，安装提示条
 * ```
 *
 * **没有一个是「该有 spec 却没有」的。** 97% 的覆盖也不是判据逼出来的，是自发习惯。
 *
 * ## 那为什么还要一条判据
 *
 * `core/moduleCoverage.spec` 扫了 `src/components` 与 `src/views` 的**文本**，
 * 但它的判据体只遍历 `src/core`:
 *
 * ```ts
 * for (const file of readdirSync(join(ROOT, "src/core")))
 * ```
 *
 * 也就是说组件只是「被搜到的语料」，本身从不被点名判。**今天 97% 是习惯，
 * 明天可以是 40%，没有东西会红。**
 *
 * ## 这条判据守什么
 *
 * 不要求每个组件都有 spec —— 那会把 `SectionMark` 这种 13 行纯展示也逼出一条测试。
 * 它只守**基线不再变差**:零提及的组件清单不许超过本次记录的那一批。
 *
 * 新增一个组件而又不被任何 spec 提到，就会挤破这个名额并红；那时要么给它一条测试，
 * 要么把它加进 `DISPLAY_ONLY` 并写明「为什么不需要」。
 *
 * ## 判据自己错了两次（第二十七、二十八次）
 *
 * ① 第三条「DISPLAY_ONLY 的每一条都还真的没人提」一上来就红，红的正是名单里那四个 ——
 *    因为**本文件写下了它们的名字**。判据必须排除自己，否则它在自证。
 * ② 收紧后 `ValueRow` 仍被当成「已有人提」，而 `exportReach.spec` 里那个是
 *    某个以 `Value` 开头、以 `Row` 结尾的**更长标识符** —— 子串撞名。
 *    改成「前面不能是字母」才认对。
 *
 * ## 故障注入
 *
 * 往 `src/components/common/` 放一个 `ProbeNew.vue`（无 spec、不在名单）→ 第二条红，点名它。
 */
import { describe, expect, it } from "vite-plus/test";
import { ROOT, walkFiles, readSource } from "@/test/readSource";
import { relative } from "node:path";

/**
 * 纯展示组件 —— 没有业务逻辑，靠 `layout-check` / `ui-smoke` 在真浏览器里过。
 *
 * 加一条要写明**为什么它不是「该有 spec 却没有」**。
 */
const DISPLAY_ONLY = new Map<string, string>([
  ["src/components/common/SectionMark.vue", "13 行，一个带标记的章节标题；无数值、无判断、无状态"],
  [
    "src/components/common/ValueRow.vue",
    "29 行，主读数行的版式组件（label + value + 语义色），纯 props 渲染；" +
      "`exportReach.spec` 里那个更长的标识符只是子串撞名，不算提到",
  ],
  [
    "src/components/common/UpdatePrompt.vue",
    "36 行模板；显示与「稍后」的全部逻辑在 useServiceWorkerUpdate（那个有 15 条 spec）",
  ],
  [
    "src/components/common/InstallToHomeNotice.vue",
    "46 行安装提示条；出现条件由 useInstallPrompt 决定",
  ],
]);

describe("组件覆盖 · 零提及清单不许变长", () => {
  it("扫到了足够多的组件与 spec 文本（防空转）", () => {
    const vue = walkFiles("src", (f) => f.endsWith(".vue"));
    expect(vue.length, "一个 .vue 都没扫到 —— 路径变了").toBeGreaterThan(80);
    /*
     * 排除自己：本文件里的 `DISPLAY_ONLY` 名单本身就会写下这四个组件名，
     * 若不排除，「它们有没有被提到」会永远为真 —— 第一版正是这么红的（实测）。
     */
    const specText = walkFiles("src", (f) => f.endsWith(".spec.ts"))
      .filter((f) => !f.endsWith("componentCoverage.spec.ts"))
      .map((f) => readSource(f))
      .join("\n");
    expect(specText.length, "spec 文本太短 —— 扫错地方了").toBeGreaterThan(100_000);
  });

  it("零提及的组件都在 DISPLAY_ONLY 里", () => {
    /*
     * 排除自己：本文件里的 `DISPLAY_ONLY` 名单本身就会写下这四个组件名，
     * 若不排除，「它们有没有被提到」会永远为真 —— 第一版正是这么红的（实测）。
     */
    const specText = walkFiles("src", (f) => f.endsWith(".spec.ts"))
      .filter((f) => !f.endsWith("componentCoverage.spec.ts"))
      .map((f) => readSource(f))
      .join("\n");
    const zero: string[] = [];
    for (const full of walkFiles("src", (f) => f.endsWith(".vue"))) {
      const rel = relative(ROOT, full).split("\\").join("/");
      if (DISPLAY_ONLY.has(rel)) continue;
      const base = rel
        .split("/")
        .pop()!
        .replace(/\.vue$/, "");
      /* 前面的字符不能是字母：更长标识符里的 `ValueRow` 不算提到（实测误判过一次） */
      if (!new RegExp(`(?<![A-Za-z])${base}\\b`).test(specText)) zero.push(rel);
    }
    expect(
      zero,
      "这些组件没有被任何 spec 提到 —— 要么给它一条测试，要么加进 DISPLAY_ONLY " +
        "并写明为什么它是纯展示:" +
        zero.join(" / "),
    ).toEqual([]);
  });

  it("DISPLAY_ONLY 的每一条都还真的没人提（提了就该销账）", () => {
    /*
     * 排除自己：本文件里的 `DISPLAY_ONLY` 名单本身就会写下这四个组件名，
     * 若不排除，「它们有没有被提到」会永远为真 —— 第一版正是这么红的（实测）。
     */
    const specText = walkFiles("src", (f) => f.endsWith(".spec.ts"))
      .filter((f) => !f.endsWith("componentCoverage.spec.ts"))
      .map((f) => readSource(f))
      .join("\n");
    const nowCovered = [...DISPLAY_ONLY.keys()].filter((rel) => {
      const base = rel
        .split("/")
        .pop()!
        .replace(/\.vue$/, "");
      return new RegExp(`(?<![A-Za-z])${base}\\b`).test(specText);
    });
    expect(
      nowCovered,
      "这些组件已经有人提了 —— 把它们从 DISPLAY_ONLY 里删掉（名单不常驻）:" +
        nowCovered.join(" / "),
    ).toEqual([]);
  });

  it("DISPLAY_ONLY 的每一条都写了理由", () => {
    for (const [rel, why] of DISPLAY_ONLY) {
      expect(why.length, `${rel} 没写为什么可以不测`).toBeGreaterThan(10);
    }
  });
});
