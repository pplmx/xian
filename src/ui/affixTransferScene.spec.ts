/**
 * 词条转移 —— 从一件抽一条,落到另一件上;而这一屏只有名字。
 *
 * ## 现状
 *
 * 装备详情里的「词条转移」是一整块功能面板(368 行,最后一个完全无画的功能面板):
 * 选源件词条 → 选目标件 → 选址落位 → 付费。整块只有字。
 *
 * ## 身份是现成的,而且是**两件**,不是一件
 *
 * 源件与目标件各自带着 `templateId`,而 `equipmentTemplate(...).slot` 就是它的部位;
 * `sceneTerrainOfSlot`(器评帖那一轮建的)已经把九个部位各画了一片天。
 *
 * 而 `transferCandidates` 里写得很清楚:目标件**允许是别的部位**
 * (`sameSlot` 只用于排序优先,不是准入条件 —— `targetBlock` 才是)。
 * 故「源 → 目标」这一趟可以是**跨部位**的,那正是这一屏最该画出来的事:
 * 从这一席挪到那一席,而不是「又选了一次同一件东西」。
 *
 * ## 判据守什么
 *
 *   一 两件各自取景,且**读各自的部位**(源读源、目标读目标);
 *   二 两处的部位真的可能不同 —— 不许写死成同一个值;
 *   三 画不占布局:这一块正文是词条按钮、候选行与价签。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const PANEL = "src/components/equipment/AffixTransferPanel.vue";

describe("词条转移 · 从这一席挪到那一席", () => {
  it("源件与目标件各自按**自己**的部位取景", () => {
    const src = readSource(PANEL);
    expect(src, "词条转移仍是纯文字 —— 368 行模板里一个 svg 都没有").toContain("<InkScene");
    /*
     * 取景在 `computed` 里算、模板上按 `:terrain` 传 —— 故两处都要查:
     * computed 读的部位(源读源、目标读目标),与模板上绑的到底是哪一个。
     */
    const terrainProps = [...src.matchAll(/:terrain="(\w+)"/g)].map((m) => m[1] ?? "");
    expect(terrainProps.length, "这一屏是**两件**,该有两处取景").toBeGreaterThanOrEqual(2);
    expect(
      new Set(terrainProps).size,
      "两处绑了同一个值 —— 跨部位这件事没画出来",
    ).toBeGreaterThanOrEqual(2);
    expect(terrainProps, "源件读源件的部位").toContain("sourceSlotTerrain");
    expect(terrainProps, "目标件读目标件的部位").toContain("targetSlotTerrain");
  });

  it("两个部位真的各自算出来,不是写死的常数", () => {
    const src = readSource(PANEL);
    /*
     * 两个 computed 都要从 `equipmentTemplate(...)` 读 `slot` ——
     * 写死成 `"weapon"` 之类也能让上一条绿(参数不同即可),但那是假的。
     */
    for (const name of ["sourceSlotTerrain", "targetSlotTerrain"]) {
      const def = src.match(new RegExp(`const ${name} = computed\\([\\s\\S]*?\\);`))?.[0] ?? "";
      expect(def, `定位不到 ${name} —— 判据会空转`).not.toBe("");
      expect(def, `${name} 要从模板读部位`).toMatch(/equipmentTemplate\(/);
      expect(def, `${name} 要读 slot`).toMatch(/slot/);
    }
  });

  it("画是一小条、不自作主张长大", () => {
    const src = readSource(PANEL);
    const rule = src.match(/\.affix-transfer__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
    expect(rule, "定位不到 .affix-transfer__scene —— 判据会空转").not.toBe("");
    /*
     * 这一处的落法与「卷首一条」不同:这一块正文密集(说明、收起、词条按钮、
     * 候选行、价签),铺底会压在字上 —— 实测第一版就是如此(源件那片盖住
     * 「词条转移」、目标那片盖住「收起」)。故画是**一小条**定高的带子,
     * 落在该段自己的留白里。
     */
    expect(rule, "画要有定高").toMatch(/height:\s*[0-9.]+rem/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
    expect(rule, "画不许铺满这一块").not.toMatch(/inset:\s*0/);
  });
});
