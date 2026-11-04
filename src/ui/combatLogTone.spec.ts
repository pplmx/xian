/**
 * 战报里的法宝 —— 神品那一件出手,不该与凡品那一件长得一样。
 *
 * ## 缺口:战报是全作唯一没有品阶通道的一屏
 *
 * 品阶在这一作里已经有很完整的表达(角章 / 光 / 声 / 停留时长 / 器铭),
 * 唯独**战斗回放里那几十行字**没有任何品阶信息:
 *
 *   每行只有 `t`(atk / skill / crit / shield / heal / dodge / proc / info / win / lose)
 *   与 `text`,颜色按 `t` 分档(见 adventure.css 的 data-log-kind 规则)。
 *
 * 而法宝自动出手走的是 `t: "proc"` —— 与「锋连诀」「罡盾崩碎」这些**同一个桶**,
 * 且 CSS 根本没给 proc 写规则,于是它落回默认墨色。
 *
 * 结果:一颗凡品「墨玉葫芦」回血,与一件神品「混沌钟」轰出 205% 单位伤害,
 * 在战报里是**一模一样的灰字**。
 *
 * ## 为什么值得补
 *
 * 战报是玩家**反复看**的那一屏:每场战斗都回放一遍,一场几十行。
 * 而法宝出手是玩家自己攒出来、配上去的东西 —— 它该在回放里认得出自己。
 * 玩家攒了一件神品,看到它在战报里与凡品同色,那种「攒到好东西」的喜悦会被抹平。
 *
 * ## 只加一个可选字段,不动任何既有形状
 *
 * `CombatLogEntry` 加 `quality?: QualityId`。老存档没有这一栏 ——
 * 与 `LastBattleView.loot` / `firstSight` 同一条先例:缺省即"没有品阶",渲染退回原样。
 * 不改 `t` 的联合类型(那会让所有按 t 分支的地方都要加 case)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { qualityDef } from "@/data/qualities";
import { logQualityTone } from "./combatLogTone";

describe("战报法宝 · 数据结构", () => {
  it("战报条目带了可选的品阶栏 —— 老存档缺它就是没有", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface CombatLogEntry");
    expect(at, "CombatLogEntry 要还在").toBeGreaterThan(0);
    const block = types.slice(at, types.indexOf("}", at) + 1);
    expect(block, "要加可选的品阶栏").toMatch(/quality\?:\s*QualityId/);
  });

  it("法宝出手那几处把品阶递进去 —— 不是只加字段不填", () => {
    const combat = readSource("src/core/combat.ts");
    /*
     * 数「带【法宝名】的日志行」有几处,再看其中几处带上了 art.quality。
     * 用 `[\s\S]` 跨行匹配:有几处是 push( 后换行的多行调用,单行正则会漏掉
     * (第一版就漏成 2/7,判据红了才发现)。
     */
    const artNameSites = [...combat.matchAll(/【\$\{art\.name\}】/g)];
    expect(artNameSites.length, "法宝出手的几处都该找到").toBeGreaterThanOrEqual(4);
    const qualitySites = [...combat.matchAll(/art\.quality/g)];
    expect(
      qualitySites.length,
      `每一处法宝出手都要带 art.quality —— 少一处那一类法宝就还是灰字` +
        `(${artNameSites.length} 处出手,只有 ${qualitySites.length} 处带品阶)`,
    ).toBeGreaterThanOrEqual(artNameSites.length);
  });

  it("不改 t 的联合类型 —— 那是所有按 kind 分支的地方的共同前提", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface CombatLogEntry");
    const block = types.slice(at, types.indexOf("}", at) + 1);
    expect(block, "t 仍是原来那十个").toContain('"atk" | "skill" | "crit"');
    expect(block, "不该为法宝另立一种 t").not.toContain('"artifactProc"');
  });
});

describe("战报法宝 · 品阶折成语气", () => {
  it("稀有档与寻常档分开 —— 神品与凡品不落同一档", () => {
    expect(logQualityTone("divine")).toBe("top");
    expect(logQualityTone("mortal")).toBe("plain");
  });

  it("天仙归一档,神品再上一档 —— 与品质表同一条稀有二段", () => {
    expect(logQualityTone("heaven")).toBe("rare");
    expect(logQualityTone("immortal")).toBe("rare");
    expect(logQualityTone("divine")).toBe("top");
  });

  it("灵/玄/地仍是寻常 —— 战报里不值得为它们另起一种颜色", () => {
    for (const q of ["mortal", "fine", "excellent", "spirit", "profound", "earth"] as const) {
      expect(logQualityTone(q), `${qualityDef(q).name} 不该另起档`).toBe("plain");
    }
  });

  it("没有品阶(老存档)就是寻常 —— 不猜、不补", () => {
    expect(logQualityTone(undefined)).toBe("plain");
    expect(logQualityTone(null)).toBe("plain");
  });

  it("认不得的品阶 id 落回寻常 —— 不让一个坏键把整行染成一档不存在的色", () => {
    expect(logQualityTone("no_such" as never)).toBe("plain");
  });
});

describe("战报法宝 · 只是描色,不改结算", () => {
  it("不 import store / core / DOM —— 与 flashTier / toastLife 同一条纪律", () => {
    const src = readSource("src/ui/combatLogTone.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:战报按品阶给行加落点", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "要读品阶语气").toContain("logQualityTone(");
    expect(panel, "要有稳定落点供真浏览器复核").toContain("data-log-quality");
  });
});
