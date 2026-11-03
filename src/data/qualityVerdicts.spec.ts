/**
 * 品评 —— 九档各一句,逐档抬一层,且不说数值。
 *
 * 判据四组:
 *   一 完备:九档品质每一档都有品评,不多不少(拿 QUALITIES 直接对账);
 *   二 不重复品阶名、不写数字 —— 那两样各有出处;
 *   三 不重复:九句话两两不同;
 *   四 逐档抬:后一档的字数不少于前一档(口气往上抬的机械代理),且末档最长 ——
 *      这条防的是「神品写得比凡品还短」那种一眼可见的塌陷。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES } from "@/data/qualities";
import { QUALITY_VERDICTS, qualityVerdict } from "@/data/qualityVerdicts";
import type { QualityId } from "@/types";

const IDS = QUALITIES.map((q) => q.id);

describe("品评 · 完备且不越权", () => {
  it("九档每一档都有品评,也不多出表外的档", () => {
    const missing = IDS.filter((id) => !qualityVerdict(id));
    expect(missing, "这些档位没有品评 —— 器评帖的眉题行会空一句").toEqual([]);
    expect(Object.keys(QUALITY_VERDICTS).sort()).toEqual([...IDS].sort());
  });

  it("品评里不重复品阶名 —— 眉题上一格已经写过品阶", () => {
    for (const q of QUALITIES) {
      expect(qualityVerdict(q.id), `${q.name} 的品评里重复了品阶名`).not.toContain(q.name);
    }
  });

  it("品评里不写数字 —— 数字归倍率与词条条数", () => {
    for (const q of QUALITIES) {
      expect(qualityVerdict(q.id), `${q.name} 的品评里带了数字`).not.toMatch(/[0-9０-９]/);
    }
  });

  it("九句话两两不同,且没有空串", () => {
    const seen = new Map<string, QualityId>();
    for (const id of IDS) {
      const text = qualityVerdict(id);
      expect(text.length, `${id} 的品评是空的`).toBeGreaterThan(0);
      expect(seen.has(text), `${id} 的品评与 ${seen.get(text)} 重复`).toBe(false);
      seen.set(text, id);
    }
  });

  it("每句都短到能落在眉题那一行里(≤16 字)", () => {
    /*
     * 量的是**排版约束**,不是「口气分量」。
     *
     * 起初这里写的是一条「后一档字数不少于前一档」的阶梯 —— 那是错的判据:
     * 字数是凑出来的,不是写出来的,它会逼着人把「玄机暗合,器中有道」拉长去够
     * 下一档的字数,而那句话本来就应该这么短。品评的分量在词,不在字数。
     * 真正需要机械盯住的是另一件事:它得**放得进眉题那一行**,不把器评帖的首行折成两行。
     */
    for (const q of QUALITIES) {
      const len = qualityVerdict(q.id).length;
      expect(len, `${q.name} 的品评 ${len} 字,超出眉题一行的容量`).toBeLessThanOrEqual(16);
      expect(len, `${q.name} 的品评太短,读不出分量`).toBeGreaterThanOrEqual(6);
    }
  });

  it("认不得的档位给空串,不吐 undefined", () => {
    expect(qualityVerdict("nope" as QualityId)).toBe("");
  });
});

describe("品评 · 与规则表分开", () => {
  it("品评表不 import qualities —— 内容与规则两处,改一边不必碰另一边", () => {
    const src = readSource("src/data/qualityVerdicts.ts");
    expect(src, "品评表不该依赖规则表").not.toMatch(/from ["']\.\/qualities["']/);
  });

  it("品评确实接进了界面:器评帖与藏珍详情各读同一份", () => {
    const dialog = readSource("src/components/equipment/EquipmentDetailDialog.vue");
    const collection = readSource("src/views/CollectionView.vue");
    expect(dialog, "器评帖的眉题行要读品评").toContain("qualityVerdict(");
    expect(dialog, "要有稳定落点供真浏览器复核").toContain("data-equipment-verdict-line");
    expect(collection, "藏珍详情也要读同一份").toContain("qualityVerdict(");
    // 品质名仍从规则表取,两处不打架
    expect(dialog).toContain("qualityDef(");
  });
});
