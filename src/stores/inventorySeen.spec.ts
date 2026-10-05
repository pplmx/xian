/**
 * 背包「新」角标 —— 新入包的东面要有露脸标记,直到再开一次背包。
 *
 * 语义很朴素:seenUids = 最近一次打开背包时行囊里的那一批 uid。此后新入包的
 * uid 不在账上,卡片挂「新」;打开背包(InventoryView onMounted)即整批替换,
 * 数组恒等于「上次开包时的行囊」,天然有界、无需裁剪、重量为零。
 *
 * 这里守两件事:①标记语义(开包=全批已见、新件直到下次开包前都挂新);
 * ②洗档纪律 —— 老档首次清洗要把当时的行囊整批当「已见」播种(否则老玩家
 * 一开背包满屏假新),且只播这一次(播完 seenSeeded 置位,清洗不再覆盖账上
 * 已有的「新」)。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useInventoryStore } from "@/stores/inventory";

function inst(uid: string): Record<string, unknown> {
  return { uid, templateId: "w_hanfeng", quality: "fine", tier: 3, level: 0, affixes: [] };
}

describe("背包「新」角标 · 标记语义", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("打开背包 = 当时行囊整批已见;之后入包的件挂「新」直到下次开包", () => {
    const inv = useInventoryStore();
    inv.items = [inst("uA") as never, inst("uB") as never];
    inv.markInventorySeen();
    expect(inv.isNewItem("uA")).toBe(false);
    expect(inv.isNewItem("uB")).toBe(false);

    // 新入包 C(未开包):C 挂新,A/B 依然是已见
    inv.items = [inst("uA") as never, inst("uB") as never, inst("uC") as never];
    expect(inv.isNewItem("uC")).toBe(true);
    expect(inv.isNewItem("uA")).toBe(false);

    // 再开一次包:C 也入账
    inv.markInventorySeen();
    expect(inv.isNewItem("uC")).toBe(false);
  });

  it("行囊尽空后开包,账也清空(from=整批替换,不是并集)", () => {
    const inv = useInventoryStore();
    inv.items = [inst("uA") as never];
    inv.markInventorySeen();
    inv.items = [];
    inv.markInventorySeen();
    // 同一 uid 再入包时是「全新的一件」,该挂新 —— 证明账是替换不是累积
    inv.items = [inst("uA") as never];
    expect(inv.isNewItem("uA")).toBe(true);
  });

  it("hasNewItem:行囊里有没看过的才亮 —— 开包即灭(底部导航新货点的判据)", () => {
    const inv = useInventoryStore();
    expect(inv.hasNewItem).toBe(false); // 空行囊
    inv.items = [inst("uA") as never];
    inv.markInventorySeen();
    expect(inv.hasNewItem).toBe(false); // 都看过
    inv.items = [inst("uA") as never, inst("uC") as never]; // 新入包 C
    expect(inv.hasNewItem).toBe(true);
    inv.markInventorySeen(); // 开包
    expect(inv.hasNewItem).toBe(false);
  });

  it("newItemCount:没看过几件报几件 —— 开包归零(底部导航计数徽标的判据)", () => {
    const inv = useInventoryStore();
    expect(inv.newItemCount).toBe(0); // 空行囊
    inv.items = [inst("uA") as never];
    inv.markInventorySeen();
    expect(inv.newItemCount).toBe(0); // 都看过
    inv.items = [inst("uA") as never, inst("uC") as never, inst("uD") as never]; // 新入包 C/D
    expect(inv.newItemCount).toBe(2);
    inv.markInventorySeen(); // 开包
    expect(inv.newItemCount).toBe(0);
  });
});

describe("背包「新」角标 · 洗档纪律", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("旧档首次清洗把当时行囊整批播种为已见 —— 不假新", () => {
    const inv = useInventoryStore();
    inv.items = [inst("uA") as never, inst("uB") as never];
    inv.sanitize();
    expect(inv.isNewItem("uA")).toBe(false);
    expect(inv.isNewItem("uB")).toBe(false);
    expect(inv.seenSeeded).toBe(true);
  });

  it("播种只一次:此后新入包的件不被清洗顺手抹平成已见", () => {
    const inv = useInventoryStore();
    inv.items = [inst("uA") as never];
    inv.sanitize(); // 首次:播种,A 已见
    inv.items = [inst("uA") as never, inst("uC") as never];
    inv.sanitize(); // 第二次:不该再播种,否则 C 又变已见
    expect(inv.isNewItem("uC"), "清洗不得把新件抹成已见").toBe(true);
    expect(inv.seenSeeded).toBe(true);
  });

  it("清洗把写坏的账洗成纯字符串表(坏值不撑爆 includes)", () => {
    const inv = useInventoryStore();
    // 已是播种过的档(seenSeeded 落位)才有账可洗;未播种的空档会被播种覆盖,那不是坏值场景
    inv.seenSeeded = true;
    inv.seenUids = [42, "uA", null] as never;
    inv.sanitize();
    expect(inv.seenUids).toEqual(["uA"]);
  });
});
