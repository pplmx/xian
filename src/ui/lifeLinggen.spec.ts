/**
 * 历世履历的灵根徽记 —— 「转世就是灵根重生」这件事，履历里要读得到。
 *
 * ## 缺口：数据与界面各缺一半
 *
 * `docs/superpowers/specs/2026-09-14-reincarnation-linggen-visibility-design.md`
 * 的交付 2 写着两件事：`LifeRecord` 记下本世灵根、修仙录的历世履历把它印出来。
 * 实测只做了前一半的一半 —— `ReincarnationView.nextLinggen`（转世弹窗那侧）做完了，
 * 而 `LifeRecord` 里**根本没有**灵根字段：`recordLife` 归档时只取境界、寿数、命题、
 * 宿慧与逆旅契。
 *
 * 于是玩家转过十世，翻历世履历看到的每一行都只有「旧境 X · 寿 N 载」——
 * 每一世开局抽到的是天灵根还是杂灵根，一栏都没记。转世弹窗在**当次**能看见来世灵根，
 * 翻旧账时就再也看不见了。
 *
 * ## 做法：归档时取一份浅拷贝，履历只做只读翻译
 *
 * 快照必须发生在 `player.rebirth()` **之前**（此刻 `player.linggen` 仍是这一世那副），
 * 并且必须是拷贝 —— 若把 `roots` 数组原样塞进去，来世再改灵根时旧世的记录会跟着变，
 * 十世履历会一起显示成最新那世的牌面。
 *
 * 这一层只做「存档字段 → 可显示的一行」：不读 store、不改任何状态，
 * 与 `ui/lifeTrialArchive` 同一条纪律。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { lifeLinggen, linggenSpoken } from "./lifeLinggen";
import { ELEMENTS } from "@/data/linggen";

describe("历世灵根 · 读得出那一世的牌面", () => {
  it("品阶名与逐根徽记都翻出来，色与字取自 data/linggen", () => {
    const row = lifeLinggen({
      gradeName: "真灵根",
      roots: [
        { element: "water", aptitude: 63 },
        { element: "wood", aptitude: 44 },
      ],
    });
    expect(row).not.toBeNull();
    expect(row!.grade).toBe("真灵根");
    expect(row!.roots.map((r) => r.element)).toEqual(["water", "wood"]);
    expect(row!.roots[0]!.char).toBe(ELEMENTS.water.char);
    expect(row!.roots[0]!.color).toBe(ELEMENTS.water.color);
    expect(row!.roots[0]!.aptitude).toBe(63);
  });

  it("同一份根骨读两遍，出来的字与色一字不差 —— 不另造一套五行牌面", () => {
    const raw = {
      gradeName: "变异灵根",
      roots: [
        { element: "fire" as const, aptitude: 88 },
        { element: "thunder" as const, aptitude: 71 },
      ],
    };
    const a = lifeLinggen(raw);
    const b = lifeLinggen({
      gradeName: raw.gradeName,
      roots: raw.roots.map((r) => ({ ...r })),
    });
    expect(a).toEqual(b);
  });

  it("读屏一行说得出「哪一系、资质多少」，与人物页灵根牌面同一口径", () => {
    const row = lifeLinggen({
      gradeName: "天灵根",
      roots: [{ element: "metal", aptitude: 92 }],
    });
    expect(row!.roots[0]!.spoken).toBe(`${ELEMENTS.metal.char}系 · 资质 92`);
  });

  it("老存档没有这一栏 → 空，不编一副灵根出来", () => {
    expect(lifeLinggen(undefined)).toBeNull();
    expect(lifeLinggen(null)).toBeNull();
  });

  it("坏档（品阶不是字、根不是数组）→ 空，不印半行残章", () => {
    expect(lifeLinggen({ gradeName: 42, roots: [] } as never)).toBeNull();
    expect(lifeLinggen({ gradeName: "", roots: [] })).toBeNull();
    expect(lifeLinggen({ gradeName: "真灵根", roots: "water" } as never)).toBeNull();
  });

  it("认不得的五行 id 丢掉那一枚，余下的照常印 —— 不整行消失", () => {
    const row = lifeLinggen({
      gradeName: "真灵根",
      roots: [{ element: "water", aptitude: 63 }, { element: "nope", aptitude: 50 } as never],
    });
    expect(row!.roots.map((r) => r.element)).toEqual(["water"]);
  });

  it("根全认不得时只剩品阶名 —— 品阶是存档里的事实，仍要说", () => {
    const row = lifeLinggen({
      gradeName: "杂灵根",
      roots: [{ element: "nope", aptitude: 50 } as never],
    });
    expect(row).not.toBeNull();
    expect(row!.grade).toBe("杂灵根");
    expect(row!.roots).toEqual([]);
  });

  it("资质坏值的根仍留徽记，只是不编一个资质数", () => {
    const row = lifeLinggen({
      gradeName: "真灵根",
      roots: [{ element: "water", aptitude: Number.NaN }],
    });
    expect(row!.roots).toHaveLength(1);
    expect(row!.roots[0]!.aptitude).toBeNull();
    expect(row!.roots[0]!.spoken).toBe(`${ELEMENTS.water.char}系`);
  });
});

describe("历世灵根 · 只是读", () => {
  it("不 import store / core —— 与其余读法同一条纪律", () => {
    const src = readSource("src/ui/lifeLinggen.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线：历世履历把这一世的灵根印出来", () => {
    const view = readSource("src/views/LegacyView.vue");
    expect(view, "履历要读灵根").toContain("lifeLinggen(");
    expect(view, "要有稳定落点").toContain("data-life-linggen");
    /*
     * 圆章是纯视觉的（「水雷」连读不成话、色值更念不出），故徽记整组 aria-hidden，
     * 另给一句读屏文本。判据两侧都量：隐藏了，而且补上了那句。
     */
    expect(view, "徽记圆章要退出读屏").toMatch(
      /legacy-history__linggen-marks"\s+aria-hidden="true"/,
    );
    expect(view, "要有一句读屏文本把牌面说全").toContain("linggenSpoken(l.linggenRow)");
  });

  it("读屏那一句把品阶、逐系与资质都说全 —— 不是「真灵根水木」", () => {
    const row = lifeLinggen({
      gradeName: "真灵根",
      roots: [
        { element: "water", aptitude: 63 },
        { element: "wood", aptitude: 44 },
      ],
    });
    expect(linggenSpoken(row!)).toBe("真灵根，水系 · 资质 63，木系 · 资质 44");
  });

  it("根一枚都认不得时只说品阶 —— 品阶是存档里的事实,仍要说", () => {
    const row = lifeLinggen({ gradeName: "杂灵根", roots: [] });
    expect(linggenSpoken(row!)).toBe("杂灵根");
  });

  it("反空转：履历真的用到了 LifeRecord 的这一栏", () => {
    const view = readSource("src/views/LegacyView.vue");
    expect(view).toMatch(/l\.linggen/);
  });
});
