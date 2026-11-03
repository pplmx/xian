/**
 * 灵兽契语 —— 一句只对你说的话,四十只各说各的。
 *
 * 判据钉三件:
 *   一 覆盖:每只灵兽都有一句契语,且没有登记了却不存在于灵兽表的死条目;
 *   二 不撒谎:契语里不带数字(数字归 `mods` 与 `petTraitText` 管),也不与 desc 重复
 *      —— 两句在同一屏并排,说同一件事就等于只说了一句;
 *   三 不越权:契语不给任何值、不进排序,`petVow` 是纯查表。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { PETS } from "@/data/pets";
import { PET_VOWS, petVow } from "@/data/petVows";

describe("灵兽契语 · 覆盖与一一对应", () => {
  it("每只灵兽都有契语,没有多出来的死条目", () => {
    const missing = PETS.filter((p) => !PET_VOWS[p.id]).map((p) => p.name);
    expect(missing, "这些灵兽没有契语 —— 相伴时它们会闭嘴").toEqual([]);
    const known = new Set(PETS.map((p) => p.id));
    const orphans = Object.keys(PET_VOWS).filter((id) => !known.has(id));
    expect(orphans, "这些契语指向了不存在于灵兽表的 id").toEqual([]);
    expect(Object.keys(PET_VOWS).length).toBe(PETS.length);
  });

  it("没有契语 / id 为空时返回空串,不吐 undefined", () => {
    expect(petVow(null)).toBe("");
    expect(petVow(undefined)).toBe("");
    expect(petVow("")).toBe("");
    expect(petVow("pet_不存在")).toBe("");
  });

  it("查得到的那几只,返回的就是表里那一句", () => {
    for (const pet of PETS) {
      expect(petVow(pet.id), `${pet.name} 的契语取不到`).toBe(PET_VOWS[pet.id]);
    }
  });
});

describe("灵兽契语 · 不撒谎、不重复", () => {
  it("契语里不写数字 —— 数字归 mods 与 petTraitText,两处混写就会各自漂", () => {
    for (const [id, vow] of Object.entries(PET_VOWS)) {
      expect(vow, `${id} 的契语里带了数字`).not.toMatch(/[0-9０-９/]/);
    }
  });

  it("契语不重复:四十只是四十句话", () => {
    const seen = new Set<string>();
    for (const [id, vow] of Object.entries(PET_VOWS)) {
      expect(seen.has(vow), `${id} 的契语与别只重复了:${vow}`).toBe(false);
      seen.add(vow);
    }
  });

  it("契语不与 desc 同句 —— 同屏并排的两句要说两件事", () => {
    for (const pet of PETS) {
      expect(PET_VOWS[pet.id], `${pet.name} 的契语与它的 flavor 一字不差`).not.toBe(pet.desc);
      // 不许把 flavor 原样抄进来再补半句:长度上就露馅(desc 是很短的一句)
      expect(PET_VOWS[pet.id]!.includes(pet.desc), `${pet.name} 的契语把 desc 整句抄了进去`).toBe(
        false,
      );
    }
  });

  it("契语不写数值口径的黑话:不出现「%」「+」这类结算符号", () => {
    for (const [id, vow] of Object.entries(PET_VOWS)) {
      expect(vow, `${id} 的契语写得像一条词条`).not.toMatch(/[%+]/);
    }
  });
});

describe("灵兽契语 · 不越权", () => {
  it("data/petVows 不依赖任何结算模块 —— 它只是一张字表", () => {
    const src = readSource("src/data/petVows.ts");
    expect(src, "契语表只该认得灵兽表").not.toMatch(
      /from "@\/core\/(statsCalc|engineWorld|petPersonality|loot|combat)"/,
    );
    expect(src, "契语不给任何属性 / 加成入口").not.toContain("StatMods");
  });

  it("结缘、唤伴、护主三处都说得出这一句 —— 且读的是同一张表", () => {
    const event = readSource("src/core/eventEngine.ts");
    const explore = readSource("src/core/exploration.ts");
    const view = readSource("src/views/TitlesView.vue");
    for (const [name, src] of [
      ["结缘回执", event],
      ["护主提示", explore],
      ["唤伴提示", view],
    ] as const) {
      expect(src, `${name}没有接上契语`).toContain("petVow(");
    }
    // 护主那句要点名是哪一只 —— 只写「灵兽机警」认不出是谁挡的
    expect(explore, "护主提示要署上灵兽的名字").toMatch(/petName/);
  });

  it("契语只在「相伴」处露面:名号页的此刻相伴与图鉴条目,长列表不铺", () => {
    const view = readSource("src/views/TitlesView.vue");
    const codex = readSource("src/ui/codex.ts");
    expect(view, "此刻相伴面板要读出这一句").toContain("data-pet-vow");
    expect(codex, "图鉴条目要读出这一句").toContain("petVow(");
    // 长列表每一行都印契语就成了文案墙 —— 逐行区块里不许出现它
    const rowBlock = view.slice(view.indexOf("data-pet-row="), view.indexOf("data-pet-prev"));
    expect(rowBlock, "灵兽谱的逐行里不该铺契语").not.toContain("data-pet-vow");
  });
});
