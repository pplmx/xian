/**
 * 宿命传承的效果(纯函数,不读 store)—— ISS-302 的落地半边。
 *
 * 这一层此前是空的:传承只被记下来,效果没人接。这份用例把「已持有 → 改变什么」
 * 钉住,且**不用起 Pinia**(拿 id 数组直接验)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { HERITAGE_DEFS } from "@/data/heritage";
import {
  artifactSlotBonus,
  birthMajorFloor,
  carriesAllLore,
  craftGuaranteeCrafts,
  hasTalentChoiceBonus,
  keepsAllGongfa,
} from "./heritageEffects";

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

  it("其余四个效果也认传承 id", () => {
    expect(hasTalentChoiceBonus(["tonggan"])).toBe(true);
    expect(hasTalentChoiceBonus([])).toBe(false);
    expect(keepsAllGongfa(["daotong"])).toBe(true);
    expect(keepsAllGongfa([])).toBe(false);
    expect(carriesAllLore(["daoben"])).toBe(true);
    expect(carriesAllLore([])).toBe(false);
    expect(craftGuaranteeCrafts(["danxin"])).toBe(3);
    expect(craftGuaranteeCrafts([])).toBe(0);
  });

  /**
   * **声明即承诺** —— 这条判据是本轮审计的收口:8 个传承此前全声明了、却一个都没接,
   * 玩家看到的是一张空头支票。今后新增一个传承却忘了接线,这里当场红。
   *
   * 扫 core/stores 的源码(排除 data 里的定义与 spec 里的断言):每个传承 id 都必须
   * 在**玩法代码**里出现一次(被某个效果函数 / store 动作 / hook 读)。
   */
  it("每个传承 id 都在 core/stores 里有消费点(不是空头支票)", () => {
    const root = resolve(__dirname, "..");
    const files: string[] = [];
    for (const dir of ["core", "stores"]) {
      for (const f of readdirSync(join(root, dir))) {
        if (f.endsWith(".ts") && !f.endsWith(".spec.ts")) files.push(join(root, dir, f));
      }
    }
    const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
    const unwired = HERITAGE_DEFS.filter((d) => !text.includes(`"${d.id}"`));
    expect(
      unwired.map((d) => `${d.id}(${d.name})`),
      "这些传承只在 data 里声明,没接进玩法",
    ).toEqual([]);
  });
});
