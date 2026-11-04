/**
 * 名字的长度 —— 顶栏靠 truncate 兜底,而契约只写在创建页那一处。
 *
 * ## 现状(三条事实)
 *
 *   创建页    `maxlength="8"`,并且 `name.trim().slice(0, 8)` —— 两道都在
 *   store     `initCharacter` 与 `setName` **都不裁**,给什么存什么
 *   顶栏      `<p class="folio-head__name truncate">` —— 超长就截断
 *
 * 今天不出问题,因为 `setName` 唯一调用方是转世的随机道号(2–3 字)。
 * 但**这个契约没有写在任何一处代码里**:它活在创建页那一行 slice 里,
 * 而 store 是公开的、谁都能调。
 *
 * ## 为什么这值得一条判据
 *
 * 顶栏那行是**每一页都看得见的**。名字一旦超长,它会被截成「李长风长…」——
 * 玩家改过名却没在首页看到自己写的名字,第一反应是"改没生效",而不是"被截了"。
 * 而这条链上没有任何一处会报错:store 收下了,顶栏也画了,只是少了半截。
 *
 * ## 做什么
 *
 * 把「名字至多八个字」收进 store —— 与创建页那条 `maxlength="8"` 同一个数,
 * 只此一处定义。两处各写一个 8,改一处就会分岔(改了 store 忘了页面,
 * 玩家在输入框里敲第九个字,提交后才被悄悄削掉)。
 *
 * ## 不做什么
 *
 * 不改顶栏的 truncate。它仍是必要的兜底 —— 旧档里可能有超长的名字
 * (那时没有上限),而 `truncate` 保证那种档不会把版面撑破。
 * store 的上限管**新的**,truncate 管**旧的**,两者不冲突。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("名字的长度 · 上限只有一个来源", () => {
  it("store 导出那个上限,创建页读它 —— 定义已挪到 utils/nameLimit", () => {
    /*
     * 第 38 轮把定义的**位置**挪了:这个 8 不只属于道号,构筑名、挑战书名、
     * 转世名号草稿都用它,放在 store 里会让那三处为了一个常数去 import player store。
     * 故定义搬到 `utils/nameLimit` 的 NAME_MAX,`PLAYER_NAME_MAX` 保留为别名,
     * 第 37 轮建立的调用方一个都不用改。
     *
     * 判据按**意图**改:上限仍只有一个来源,只是那个来源换了地方。
     */
    const limit = readSource("src/utils/nameLimit.ts");
    expect(limit, "上限该在 utils/nameLimit 里定义").toMatch(/export const NAME_MAX\s*=\s*8/);
    const store = readSource("src/stores/player.ts");
    expect(store, "PLAYER_NAME_MAX 该是那个常数的别名").toMatch(
      /export const PLAYER_NAME_MAX\s*=\s*NAME_MAX/,
    );
    const view = readSource("src/views/CreateView.vue");
    expect(view, "创建页的 maxlength 要读同一个常数").toContain("PLAYER_NAME_MAX");
    expect(view, "不许再手写 8").not.toMatch(/maxlength="8"/);
  });

  it("setName 裁到上限 —— 公开接口自己守住契约", () => {
    const store = readSource("src/stores/player.ts");
    const at = store.indexOf("function setName(");
    expect(at, "setName 要还在").toBeGreaterThan(0);
    const block = store.slice(at, at + 400);
    expect(block, "setName 里要裁").toContain("PLAYER_NAME_MAX");
  });

  it("创建页那两处 slice 也读同一个常数", () => {
    const view = readSource("src/views/CreateView.vue");
    expect(view, "提交时也要按同一上限裁").toMatch(/slice\(0,\s*PLAYER_NAME_MAX\)/);
    expect(view, "不许再手写 slice(0, 8)").not.toMatch(/slice\(0,\s*8\)/);
  });
});

describe("名字的长度 · 空名不留白", () => {
  it("全空白时给一个默认名,不存空串", () => {
    /*
     * 创建页那句 `|| "无名散修"` 是这条规则的唯一实现。store 那侧若收到空串
     * 就照存,顶栏那行会变成一片空白 —— 而它是每一页都看得见的。
     * 这条判据不要求 store 再写一遍默认名(那是两本账),只要求**创建页那一句还在**。
     */
    const view = readSource("src/views/CreateView.vue");
    expect(view, "空名要落到默认名").toContain('"无名散修"');
  });
});
