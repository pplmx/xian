/**
 * 寿元将尽要说得出 —— 那条警告从没被任何判据读过。
 *
 * ## 发现方式
 *
 * 把全仓模板里的 `data-*` 落点与判据脚本里读的 `data-*` 对了一遍:
 * 780 个落点里 271 个从未被读。绝大多数是**布局分区锚点**
 * (`data-adventure-masthead`、`data-dongfu-court` 之类),不读是正常的 ——
 * 它们只是给样式与调试用的。
 *
 * 但有少数是**语义落点**:名字里带 `empty` / `warning` / `state` / `total`,
 * 意味着某处存在一个状态需要被断言。`data-lifespan-warning` 就是其中一个,
 * 而且是最要紧的那个 —— 它管的是玩家的生死。
 *
 * ## 为什么它值得单独一条判据
 *
 * 这条警告的触发条件只有一个比较(`lifespanRatio < 0.15`),样式只有一条
 * (数字转朱砂色)。两处都极简,所以**很久没坏过,也就很久没人看过**。
 *
 * 而它一旦坏掉,坏法是安静的:比例算错、颜色被后面的规则盖掉、
 * 阈值改了却没同步 —— 任何一种的表现都只是「寿元将尽的玩家没被提醒」。
 * 不会报错,不会变红,玩家要到寿元归零那一刻才知道。
 *
 * ## 判据分两层
 *
 *   一 静态:那个落点仍在模板上,样式仍认它,阈值仍只有一个来源;
 *   二 真浏览器:造一个寿元将尽的存档,核那枚数字**真的**变朱砂色;
 *      再造一个寿元充裕的,核它**没变** —— 两半缺一不可,只核"出现过"会漏掉
 *      「谁的寿元都被标红」这种更坏的情形。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("寿元将尽 · 静态", () => {
  it("顶栏仍挂着那个落点,且只在低于阈值时挂", () => {
    const bar = readSource("src/components/common/TopStatusBar.vue");
    expect(bar, "落点不见了").toContain("data-lifespan-warning");
    // 条件必须是「低于阈值才挂」,不是「一直挂」
    expect(bar, "条件该是比值小于阈值").toMatch(
      /data-lifespan-warning="player\.lifespanRatio < LIFESPAN_WARN_RATIO \? '' : undefined"/,
    );
  });

  it("样式仍认这个落点 —— 否则挂了也不显眼", () => {
    const css = readSource("src/style.css");
    expect(css, "该落点没有对应样式").toContain("[data-lifespan-warning]");
    // 警告色是朱砂:本作里朱砂只给「行动」和「该注意的事」,寿元将尽属于后者
    const block = css.slice(css.indexOf("[data-lifespan-warning]"));
    expect(block.slice(0, 160), "警告色不是朱砂").toContain("cinnabar");
  });

  it("阈值只有一个来源 —— 顶栏与离线结算读同一个常数", () => {
    const constants = readSource("src/data/constants.ts");
    expect(constants, "阈值常数不见了").toContain("LIFESPAN_WARN_RATIO");
    const offline = readSource("src/core/offline.ts");
    expect(offline, "离线结算也读同一个阈值").toContain("LIFESPAN_WARN_RATIO");
    // 不许在界面里再写一次 0.15
    const bar = readSource("src/components/common/TopStatusBar.vue");
    expect(bar, "顶栏不该自己写死阈值").not.toMatch(/lifespanRatio\s*<\s*0?\.\d/);
  });
});
