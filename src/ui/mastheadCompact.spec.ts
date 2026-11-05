/**
 * 卷首瘦身 —— 一屏先看见正文,而不是先看见「这是哪一页」。
 *
 * ## 量出来的问题(390×844,showcase 档)
 *
 * ```
 * 修行 卷首 375px  = 44% 屏  ·  正文从 442 才开始
 * 洞府 卷首 312px  = 37% 屏  ·  正文从 382 才开始
 * 道躯 卷首 205px  = 24% 屏  ·  正文从 275 才开始
 * ```
 *
 * 卷首内部:册名 33 + 副题 18 + meta 24 + 主视觉 140~151 + 印章 44 + 册目 24
 * (+ 修行页还有 140px 的内嵌首屏块)。**主视觉是最大的一块**,而它是一张
 * 装饰性的圆环 / 山门图 / 法球 —— 玩家看一眼就够,却常驻占掉四分之一屏。
 *
 * ## docs/design.md 自己写的话
 *
 *   > 页面按手机竖屏的阅读节奏排:**一屏一件事**,长列表用章线、留白与小印分组。
 *
 * 一屏一件事,前提是那一件「事」在首屏。现在首屏装的是「这是哪一页」。
 *
 * ## 做法:给卷首一个可选的 compact 档
 *
 * 不改默认版式(十六页里有十页本来就不挤,一并改会把它们掏空),
 * 只给**内容确实过密的那几页**开一个开关:
 *
 *   一 主视觉不再常驻,收进一枚「观象」按钮 → 弹框(BaseModal,与全站同一套
 *      焦点 / Esc / 读屏语义,不新造一层浮层);
 *   二 副题(那一句「根骨、灵根与道途」)一起收进同一个弹框 —— 它回答的是
 *      「这一页是关于什么」,不是「现在怎么样」;
 *   三 保留:册名、返回、册目、meta 读数、眉批「下一步」。这四样是**导航与行动**,
 *      收起来玩家就不知道该去哪了。
 *
 * ## 判据守什么
 *
 *   一 compact 档的卷首里**没有**常驻主视觉,只有一枚打开弹框的按钮;
 *   二 弹框用的是全站共享的 BaseModal(不新造浮层);
 *   三 默认档(未开 compact)版式一字不动 —— 这一条防「顺手把全站都改了」;
 *   四 导航、meta 读数、眉批三样在 compact 档里仍然在,不许一起收掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const MASTHEAD = "src/components/common/FolioPageHeader.vue";

describe("卷首 · compact 档把装饰收起来", () => {
  it("卷首认得一个 compact 开关,且默认关闭", () => {
    const src = readSource(MASTHEAD);
    expect(src, "要有 compact 这个开关").toContain("compact?: boolean");
    // 默认值必须是 false —— 未声明的页面版式不许被顺手改掉
    expect(src, "compact 默认关闭").toMatch(/compact:\s*false/);
  });

  it("compact 档里主视觉不再常驻,改成一枚可点的入口", () => {
    const src = readSource(MASTHEAD);
    // 主视觉那一段在 compact 档要由「按钮 + 弹框」取代,而不是继续直铺
    expect(src, "要有打开观象的入口").toContain("data-folio-visual-open");
    expect(src, "主视觉要能在 compact 档收起").toMatch(/compact[\s\S]{0,400}?v-if/);
  });

  it("观象弹框用全站共享的 BaseModal —— 不新造浮层", () => {
    // 卷首本身不该自带弹框(它的匾额字会被卷进弹窗刻度判据),弹框抽在独立组件里
    const folio = readSource("src/components/common/FolioVisualFolio.vue");
    expect(folio, "观象弹框要走 BaseModal").toContain("BaseModal");
    // 旧账:本仓吃过「自己铺一层 fixed inset-0」的亏(见 EnlightenmentModal 的注释)
    expect(folio, "不许自己铺一层全屏浮层").not.toMatch(/fixed\s+inset-0/);
    // 卷首只负责开合,不自己铺浮层
    expect(readSource(MASTHEAD), "卷首不许自己铺浮层").not.toMatch(/fixed\s+inset-0/);
  });

  it("导航、读数、眉批三样在 compact 档里仍然在 —— 收的是装饰,不是行动", () => {
    const src = readSource(MASTHEAD);
    for (const [what, needle] of [
      ["册目导航", "FolioIndexRail"],
      ["meta 读数槽", '<slot name="meta"'],
      ["眉批下一步", "data-folio-next-step"],
    ] as const) {
      expect(src, `${what}不许被 compact 档一起收掉`).toContain(needle);
    }
  });

  it("默认档的版式没动 —— 主视觉仍然直铺", () => {
    const src = readSource(MASTHEAD);
    // 非 compact 时 .folio-masthead__visual 仍是那个直铺的容器
    expect(src, "默认档仍要直铺主视觉").toContain("folio-masthead__visual");
  });
});

describe("卷首 · 哪些页开了 compact", () => {
  /**
   * 只给**内容确实过密**的页开。这一条不是美观判断,是量出来的:
   * 那四页的正文起点分别被推到 275~442px,而 390×844 的一屏只有 844px。
   */
  it("四个过密页开了 compact", () => {
    const dense = [
      ["道躯", "src/views/CharacterView.vue"],
      ["修行", "src/views/CultivationView.vue"],
      ["洞府", "src/views/DongfuView.vue"],
      ["藏珍", "src/views/CollectionView.vue"],
    ] as const;
    const missing = dense
      .filter(([, path]) => !/\bcompact\b/.test(readSource(path)))
      .map(([name, path]) => `${name}(${path})`);
    expect(missing, `这些页的卷首仍把正文推到首屏之外:${missing.join(" / ")}`).toEqual([]);
  });
});
