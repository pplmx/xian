/**
 * 共鸣缺口 —— 三种「差」必须分开说,且不许改判定。
 *
 * 判据五组:
 *   一 件数与定义同源:够件数时缺口为 0、整句为空;
 *   二 只报缺的那几件:一套三件、穿两件时,第三件不该被算进缺口;
 *   三 三种处境分得开:在行囊 / 见过 / 未曾见,各给不同的下一步;
 *   四 槽位序固定:同一套的缺口顺序不随数据表书写顺序漂;
 *   五 不改判定:能否共鸣仍由 core/equipSet 说了算,本模块不给数值也不改 hook。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { equipSetDef } from "@/data/equipSets";
import { resonanceGap, templatesOfSet } from "./resonanceGap";

const TIEBI = equipSetDef("s_tiebi")!;

describe("共鸣缺口 · 件数与定义同源", () => {
  it("已穿够件数时没有缺口,整句为空", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const worn = tpl.slice(0, TIEBI.required).map((t) => t.id);
    const gap = resonanceGap(TIEBI, worn, [], [], tpl);
    expect(gap.short).toBe(0);
    expect(gap.pieces).toEqual([]);
    expect(gap.line, "已共鸣时不该还写「还差」").toBe("");
  });

  it("一件没穿时报的缺口正好是所需件数", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const gap = resonanceGap(TIEBI, [], [], [], tpl);
    expect(gap.short).toBe(TIEBI.required);
    expect(gap.pieces).toHaveLength(TIEBI.required);
  });

  it("一套三件、穿两件:第三件不算进缺口 —— 够数就是够数", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    expect(tpl.length).toBeGreaterThanOrEqual(3);
    const worn = tpl.slice(0, 2).map((t) => t.id);
    const gap = resonanceGap(TIEBI, worn, [], [], tpl);
    expect(gap.short).toBe(0);
    expect(gap.pieces).toEqual([]);
  });
});

describe("共鸣缺口 · 三种处境分得开", () => {
  it("在行囊 / 见过 / 未曾见,各给不同的下一步", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    // 穿一件,其余两件一件在包里、一件从没见过
    const worn = [tpl[0]!.id];
    const gap = resonanceGap(TIEBI, worn, [tpl[1]!.id], [], tpl);
    expect(gap.short).toBe(1);
    // 缺口只取前 1 件(按槽位序),但处境的判法要对得上
    const all = resonanceGap(TIEBI, worn, [tpl[1]!.id], [], tpl);
    expect(all.pieces.length).toBeLessThanOrEqual(1);
    // 换成缺两件:一件在包、一件没见过,两种处境各出现在句子里
    const gap2 = resonanceGap({ ...TIEBI, required: 3 }, [tpl[0]!.id], [tpl[1]!.id], [], tpl);
    const states = gap2.pieces.map((p) => p.state);
    expect(states, "在行囊的那件该读作 owned").toContain("owned");
    expect(states, "没有且没见过的那件该读作 unknown").toContain("unknown");
    expect(gap2.line).toContain("在行囊");
    expect(gap2.line).toContain("未曾见");
  });

  it("见过但手上没有:读「去刷」而不是「未曾见」", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const gap = resonanceGap(
      TIEBI,
      [],
      [],
      tpl.map((t) => t.id),
      tpl,
    );
    expect(gap.pieces.every((p) => p.state === "seen")).toBe(true);
    expect(gap.line).toContain("去刷");
    expect(gap.line, "见过的件不该被说成未曾见").not.toContain("未曾见");
  });

  it("每一句都点出槽位与名字 —— 「还差 1 件」不算话", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const gap = resonanceGap(TIEBI, [], [], [], tpl);
    for (const piece of gap.pieces) {
      expect(gap.line, `缺口里该点名「${piece.name}」`).toContain(piece.name);
      expect(gap.line, `缺口里该点出槽位「${piece.slotName}」`).toContain(piece.slotName);
    }
  });
});

describe("共鸣缺口 · 顺序与边界", () => {
  it("同一套的缺口按槽位固定序排,不随数据表书写顺序漂", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const forward = resonanceGap(TIEBI, [], [], [], tpl);
    const reversed = resonanceGap(TIEBI, [], [], [], [...tpl].reverse());
    expect(reversed.pieces.map((p) => p.templateId)).toEqual(
      forward.pieces.map((p) => p.templateId),
    );
  });

  it("一套里一件都没有时不抛,给空缺口", () => {
    const gap = resonanceGap(TIEBI, [], [], [], []);
    expect(gap.short).toBe(TIEBI.required);
    expect(gap.pieces).toEqual([]);
    expect(gap.line).toContain("还差");
  });

  it("已穿的件数超过所需时,缺口夹在 0,不出现负数", () => {
    const tpl = templatesOfSet("s_tiebi", EQUIPMENT_TEMPLATES);
    const gap = resonanceGap(
      TIEBI,
      tpl.map((t) => t.id),
      [],
      [],
      tpl,
    );
    expect(gap.short).toBe(0);
  });
});

describe("共鸣缺口 · 不改判定", () => {
  it("本模块不 import 战斗 / 属性 / 快照 —— 它只拼一句人话", () => {
    const src = readSource("src/ui/resonanceGap.ts");
    for (const banned of ["combat", "playerSnap", "statsCalc", "engineWorld"]) {
      expect(src, `共鸣缺口不该认得 ${banned}`).not.toContain(banned);
    }
    expect(src, "能不能共鸣仍由 core/equipSet 说了算").not.toContain("hasActiveSet");
  });

  it("器评帖里真读它,并给真浏览器留落点", () => {
    const dialog = readSource("src/components/equipment/EquipmentDetailDialog.vue");
    expect(dialog, "器评帖要读共鸣缺口").toContain("resonanceGap(");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-equipment-resonance-gap");
  });
});
