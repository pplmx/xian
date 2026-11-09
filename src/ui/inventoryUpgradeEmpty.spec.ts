/**
 * 行囊「可动槽」的空态 —— 说「为什么没有」，不说第二遍「没有」
 *
 * ## 缺口:相邻两处各说一遍「没有可换的」
 *
 * 行囊首屏「今日检点」那一块,`upgradeRows` 为空时相邻渲染两段:
 *
 * ```text
 *   可动槽
 *     没有空槽,也没有更强藏品。        ← 空态说明
 *   [ 已无可换之器 ]                  ← 紧跟着的禁用按钮
 * ```
 *
 * 两句的**意思完全一样**。而这一块的版式本来是「读数 + 候选列表 + 动作」:
 * 上方已经有「可换 0 无事」这个读数了,再加两句同义的空话,读完三遍才知道
 * 「现在没什么可换」。
 *
 * ## 空态该说什么
 *
 * 它不是「没有」的第二次宣告,而是**解释为什么没有** —— 玩家真正会问的是
 * 「是不是我漏了什么?要不要去刷点装备?」。故空态要说出这个判定依据:
 * 只比真实战力(不是比品阶、不是比名字),所以品阶更高但战力更低的不算。
 * 那句话已经在同一块(`只计真实战力更高`)出现过一次,空态正好接住它。
 *
 * ## 按钮文案不动
 *
 * 禁用按钮写「已无可换之器」是对的 —— 它描述的是**这个按钮此刻不能做**。
 * 断言里要保住它,不能为了去重把按钮也改掉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const view = () => readSource("src/views/InventoryView.vue");

describe("行囊 · 可动槽的空态", () => {
  it("空态不再复述「没有空槽也没有更强藏品」这句话", () => {
    const src = view();
    const at = src.indexOf("inventory-briefing__empty");
    expect(at, "找不到空态 —— 判据会空转").toBeGreaterThan(0);
    const near = src.slice(Math.max(0, at - 400), at + 700).replace(/<!--[\s\S]*?-->/g, "");
    expect(near, "空态别再只说一遍「没有」—— 那与紧邻的按钮文案同义").not.toContain(
      "没有空槽,也没有更强藏品",
    );
  });

  it("空态要解释判定依据 —— 只比真实战力,不比品阶高低", () => {
    const src = view();
    const at = src.indexOf("inventory-briefing__empty");
    const near = src.slice(Math.max(0, at - 400), at + 700).replace(/<!--[\s\S]*?-->/g, "");
    expect(near, "空态要说清「为什么没有」").toMatch(/真实战力|战力/);
  });

  it("按钮的禁用文案保留 —— 「已无可换之器」描述的是按钮此刻不能做", () => {
    const src = view();
    expect(src, "禁用按钮那句不许被一起去重").toContain("已无可换之器");
  });

  it("席数从 EQUIP_SLOT_NAMES 现读,不写死「九」", () => {
    /*
     * 空态那句「比过 N 席」是它唯一说明判定范围的地方。写死「九席」的话,
     * 哪天增删一个席位,这句话就成了假的 —— 而它正是玩家据以判断「要不要去刷装备」的依据。
     */
    const src = view();
    const at = src.indexOf("inventory-briefing__empty");
    const near = src.slice(Math.max(0, at - 400), at + 700).replace(/<!--[\s\S]*?-->/g, "");
    expect(near, "席数要走 equipSlotCount 现读").toContain("equipSlotCount");
    expect(near, "空态里不许出现字面的「九席」").not.toMatch(/九\s*席/);
    /*
     * 席数必须读 `SLOTS`(这一页陈列的那九席),**不能**读
     * `Object.keys(EQUIP_SLOT_NAMES)` —— 那张表有十项,第十项 `artifact`
     * 单独成册、不在九佩里。第一版读错了表,实测渲染成「比过 十 席」,
     * 而同一页章首写着「9 / 9 已佩」,两个数当场打架。
     */
    // 只取那一行声明 —— 截太宽会把邻近的注释与别的 import 一起卷进来
    const declAt = src.indexOf("const equipSlotCount");
    expect(declAt, "找不到席数声明").toBeGreaterThan(0);
    const def = src.slice(declAt, src.indexOf("\n", declAt));
    expect(def, "席数要读 SLOTS.length").toContain("SLOTS.length");
    expect(def, "不许读 EQUIP_SLOT_NAMES —— 它含不在九佩里的法宝").not.toContain(
      "EQUIP_SLOT_NAMES",
    );
  });

  it("防空转:那一块真的在讲换装,不是别处", () => {
    const src = view();
    const at = src.indexOf("inventory-briefing__empty");
    const near = src.slice(Math.max(0, at - 1200), at + 700);
    expect(near, "这块该是「可动槽」那一区").toContain("可动槽");
  });
});
