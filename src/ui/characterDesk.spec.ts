import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { STAT_NAMES } from "@/data/statNames";
import type { AnyStatKey, StatMods } from "@/types";
import { readStyleCss } from "@/test/readStyleCss";
import {
  characterChapter,
  characterChapters,
  characterModifierDesk,
  characterModifierSummary,
  modifierGroupHeadline,
} from "@/ui/characterDesk";

const source = readSource;

describe("道躯案 · 三章连续卷与行藏周天", () => {
  it("章序只装配一次:总案、行藏、目录三章不缺不乱", () => {
    expect(characterChapters().map(({ key, index, title }) => ({ key, index, title }))).toEqual([
      { key: "foundation", index: "壹", title: "道躯总案" },
      { key: "modifiers", index: "贰", title: "行藏周天" },
      { key: "catalog", index: "叁", title: "卷末云笈" },
    ]);
    expect(characterChapter("modifiers")).toMatchObject({
      hint: "修行、历练、斗法与百艺,四类收成一册,拆卷再看逐项来路",
    });

    const copy = characterChapters();
    copy[0]!.title = "改过的章名";
    expect(characterChapter("foundation").title).toBe("道躯总案");
    expect(() => characterChapter("unknown" as never)).toThrow("unknown character chapter");
  });

  it("每一枚属性键都归入四类行藏,没有静默漏项", () => {
    const all = characterModifierDesk({}, []).flatMap((group) => group.keys);
    const expected = Object.keys(STAT_NAMES) as AnyStatKey[];

    expect(all.slice().sort()).toEqual(expected.sort());
    expect(characterModifierDesk({}, []).map((group) => group.title)).toEqual([
      "修行",
      "历练",
      "斗法",
      "百艺",
    ]);
  });

  it("页面文案写的「四类」与 GROUP_SEEDS 的组数绑在一起", () => {
    /*
     * `CharacterView.vue` 第 300 行写着「四类行藏共 N 项」——「四类」是**写死的中文数字**,
     * 而 `characterModifierDesk` 的组数由 `GROUP_SEEDS` 决定。
     *
     * 这两个事实原本各管各的:上面那条判据虽然断言了四组的**标题**,但页面文案里的
     * 「四类」是另一个字符串,加一组时它不会跟着变 —— 玩家会看到「四类行藏共 12 项」
     * 而下面铺开的是五组。
     *
     * 这条把两者绑起来:文案里那个中文数字必须等于 `GROUP_SEEDS` 的实际组数。
     */
    const view = readSource("src/views/CharacterView.vue");
    /*
     * **先剥注释再查** —— 这个文件里「四类行藏」「四行账目」在注释中还出现五六次
     * (说明版式来由时用的),那些是记录,不该被这条判据管。玩家看得见的是模板。
     */
    const template = view.replace(/<!--[\s\S]*?-->/g, "");
    const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    const groups = characterModifierDesk({}, []);
    const toNum = (s: string) => (s === "两" ? 2 : CN.indexOf(s));

    /*
     * 同一个事实在模板里有两种写法,都要绑:
     *   · 「四类行藏会在这里逐项现身」—— 空态那句
     *   · 「四类行藏共 N 项 … 合上这册仍回到四行账目」—— 有值那句
     * 第一版只查了后者(`类行藏共`),漏了空态那句。
     */
    const claims = [...template.matchAll(/([一二两三四五六七八九十])类行藏/g)].map((m) => m[1]);
    expect(claims.length, "模板里找不到「N 类行藏」这句文案").toBeGreaterThan(0);
    for (const c of claims) {
      expect(toNum(c!), `模板说「${c}类行藏」,而 GROUP_SEEDS 实际是 ${groups.length} 组`).toBe(
        groups.length,
      );
    }
    const rows = [...template.matchAll(/([一二两三四五六七八九十])行账目/g)].map((m) => m[1]);
    expect(rows.length, "模板里找不到「N 行账目」这句文案").toBeGreaterThan(0);
    for (const c of rows) {
      expect(toNum(c!), `模板说「${c}行账目」,而 GROUP_SEEDS 实际是 ${groups.length} 组`).toBe(
        groups.length,
      );
    }
  });

  it("行藏只报真值,逐项带来源数、软上限与另乘标记", () => {
    const mods: StatMods = {
      cultivationSpeed: 0.42,
      critRate: 0.8,
      attackPct: 0.12,
      dodgeRate: 0,
      craftSalvage: 0.1,
    };
    const groups = characterModifierDesk(mods, [
      { name: "功法", mods: { cultivationSpeed: 0.22, critRate: 0.2 } },
      { name: "灵根", mods: { cultivationSpeed: 0.2 } },
      { name: "道果", mods: { attackPct: 0.08 }, onTop: true },
      { name: "天赋", mods: { dodgeRate: 0 } },
    ]);
    const rows = groups.flatMap((group) => group.rows);

    expect(rows.map((row) => row.key)).toEqual([
      "cultivationSpeed",
      "attackPct",
      "critRate",
      "craftSalvage",
    ]);
    expect(rows.map((row) => row.sourceCount)).toEqual([2, 1, 1, 0]);
    expect(rows.find((row) => row.key === "critRate")?.capped).toBe(true);
    expect(rows.find((row) => row.key === "attackPct")?.hasOnTop).toBe(true);
    expect(characterModifierSummary(groups)).toEqual({
      active: 4,
      groups: 3,
      softCapped: 1,
    });
  });

  it("四类行藏收成四行账目时,组抬头读组内头两项的同一份值", () => {
    const groups = characterModifierDesk(
      {
        cultivationSpeed: 1.105,
        qiRegen: 0.03,
        breakthroughRate: 0.02,
        attackPct: 0.729,
        defensePct: 0.809,
      },
      [],
    );
    const practice = groups.find((group) => group.key === "practice")!;
    const combat = groups.find((group) => group.key === "combat")!;
    const craft = groups.find((group) => group.key === "craft")!;

    // 抬头不按数值大小重排 —— 键序就是重要度序,同一份存档每次读到的都是同一批位置
    expect(modifierGroupHeadline(practice)).toBe("修炼速度 +110.5% · 灵气恢复 +3%");
    expect(modifierGroupHeadline(combat)).toBe("攻击 +72.9% · 防御 +80.9%");
    expect(modifierGroupHeadline(practice, 1)).toBe("修炼速度 +110.5%");
    expect(modifierGroupHeadline(craft)).toBe("");
    // 格式与行内同一枚 formatPercent,不另造口径
    expect(modifierGroupHeadline(combat)).toContain(
      `+${(combat.rows[0]!.value * 100).toFixed(1)}%`,
    );
  });

  it("人物页三章同住一册开口续卷,旧属性卡与双列小字不再退回", () => {
    const view = source("src/views/CharacterView.vue");
    const register = view.match(/<article class="character-register[\s\S]*?<\/article>/)?.[0] ?? "";

    expect(view).toContain("data-character-register");
    expect(register).not.toContain("card-ink");
    expect(view).not.toContain('<SectionTitle title="行藏加成"');
    expect(view).not.toContain("grid grid-cols-2 gap-x-4 gap-y-1");
    expect(
      [...view.matchAll(/data-character-chapter="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual(["foundation", "modifiers", "catalog"]);
    expect(view).toContain("<FolioChapterHead");
    expect(view).toContain("<CharacterModifierRow");
  });

  it("续卷只留上下账线,桌面两列行藏,极窄档不把来源挤回主行", () => {
    const css = readStyleCss();

    expect(css).toMatch(
      /\.character-register \{[\s\S]{0,320}?border-top: 1px solid[\s\S]{0,180}?border-bottom: 1px solid/,
    );
    expect(css).toMatch(
      /\.character-register \{[\s\S]{0,420}?background: transparent;[\s\S]{0,80}?box-shadow: none;/,
    );
    expect(css).toMatch(
      /@media \(min-width: 720px\) \{[\s\S]{0,900}?\.character-modifier-groups \{[\s\S]{0,140}?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\) \{[\s\S]{0,2600}?\.character-modifier-row \{[\s\S]{0,180}?grid-template-areas:[\s\S]{0,80}?"name value"[\s\S]{0,80}?"sources arrow"/,
    );
  });

  it("真浏览器门核三章、四组行藏与来源拆卷的开关", () => {
    const layout = source("scripts/layout-check.mjs");

    expect(layout).toContain("async function taskCharacterFold()");
    expect(layout).toContain('document.querySelector("[data-character-register]")');
    expect(layout).toContain('register?.querySelectorAll("[data-character-chapter]")');
    expect(layout).toContain('register?.querySelectorAll("[data-character-modifier-group]")');
    expect(layout).toContain("[data-character-modifier-detail]");
    expect(layout).toContain("[data-character-modifier-close]");
    expect(layout).toContain('["道躯三章与行藏拆卷", taskCharacterFold]');
  });
});
