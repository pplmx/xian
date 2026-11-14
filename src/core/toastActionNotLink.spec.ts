/**
 * 提示条的去路必须是**动作**，不是路由链接。
 *
 * ## 由来（第 327 轮）
 *
 * `docs/usage.md` 的「提示条的去路」那一节:
 *
 * > 带回看价值的提示现在末尾多一个「**看 ›**」，点一下直接打开对应详情……
 * >
 * > 去路是**动作**而不是路由链接:提示条浮在任意页面上，做成链接会把玩家从现在这一页
 * > 带走，而他可能正在看战斗回放。
 *
 * 理由很硬:提示条是**全局浮层**，它出现在任何页面上。做成 `<RouterLink>` 或 `href`
 * 就会导航 —— 玩家正在看的东西（战斗回放、一段叙事、一个弹窗）会当场被换掉。
 * 而「打开详情」是一个**浮层动作**，它不改变当前路由。
 *
 * ## 为什么需要判据
 *
 * ```text
 * 类型系统      模板里的 @click vs href，管不到
 * 浏览器巡游    ui-smoke 点得到、有反应，看不出「有没有把玩家带走」
 * 既有判据      toastTarget.spec 八条都在守「目标认不认得、写坏的怎么办」，
 *               一条都没守「去路的形态」
 * ```
 *
 * 故把 `<RouterLink>` 换成 `<a href>` 会悄悄成立:点击照样打开详情，但玩家被带走了。
 *
 * ## 判据
 *
 * ① `ToastHost.vue` 里确实有可点的去路（防空转）;
 * ② 那个去路走的是 `@click`（动作）;
 * ③ 它**不是** `RouterLink` / `router-link` / `href`。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const HOST = readSource("src/components/common/ToastHost.vue");

describe("提示条 · 去路是动作，不是链接", () => {
  it("可点的去路还在（防空转）", () => {
    expect(HOST.length, "ToastHost 读出来是空的 —— 路径变了").toBeGreaterThan(500);
    expect(HOST, "找不到 openToastTarget —— 去路被删了或改名了").toContain("openToastTarget");
  });

  it("去路走 @click —— 它是一次动作", () => {
    expect(HOST, "去路不是 @click 了 —— 若改成路由，玩家正在看的页面会被换掉").toMatch(
      /@click\s*=\s*"ui\.openToastTarget\(/,
    );
  });

  it("去路不是 RouterLink / href —— 提示条浮在任意页面上", () => {
    const offenders = ["<RouterLink", "<router-link", "router-link ", "href="].filter((s) =>
      HOST.includes(s),
    );
    expect(
      offenders,
      "提示条用了链接形态 —— 玩家正在看战斗回放时点它会被带走:" + offenders.join(" / "),
    ).toEqual([]);
  });
});
