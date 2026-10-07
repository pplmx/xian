/**
 * 宿命传承的效果(纯函数,不读 store)—— ISS-302 的落地半边。
 *
 * 这一层此前是空的:传承只被记下来,效果没人接。这份用例把「已持有 → 改变什么」
 * 钉住,且**不用起 Pinia**(拿 id 数组直接验)。
 */
import { describe, expect, it } from "vite-plus/test";
import { artifactSlotBonus, birthMajorFloor } from "./heritageEffects";

describe("宿命传承的效果", () => {
  it("元婴凝实:出生境界下限抬到筑基,其余仍从炼气", () => {
    expect(birthMajorFloor([])).toBe(0);
    expect(birthMajorFloor(["danxin"])).toBe(0);
    expect(birthMajorFloor(["yuanying"])).toBe(1);
    expect(birthMajorFloor(["danxin", "yuanying"])).toBe(1);
  });

  it("化神百炼:额外一个法宝位;没持有则不加", () => {
    expect(artifactSlotBonus([])).toBe(0);
    expect(artifactSlotBonus(["baihuang"])).toBe(1);
  });
});
