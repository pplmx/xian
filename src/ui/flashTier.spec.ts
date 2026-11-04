/**
 * 闪光的分量 —— 那道光要跟着这一件走。
 *
 * 判据六组:
 *   一 默认不变:没有印的 rare(转世/突破/里程碑)保持原金色与 1.1s;
 *   二 低于稀有段不分层:灵/玄/地虽也 rare,那道光是默认的;
 *   三 分层:天仙一档、神品一档,时长严格递增;
 *   四 色从品质表来:有印时 colorToken 就是那一档的 token,不是恒定金色;
 *   五 只是分类:本模块不 import 任何与 DOM / 结算有关的东西;
 *   六 真接线:提示条按这条判据给光。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES, qualityDef } from "@/data/qualities";
import { FLASH_DEFAULT, flashPlanOf } from "./flashTier";

describe("闪光的分量 · 默认不变", () => {
  it("没有印时是原金色、1.1 秒 —— 转世/突破/里程碑那一支不许变", () => {
    expect(flashPlanOf(undefined)).toEqual(FLASH_DEFAULT);
    expect(FLASH_DEFAULT.seconds).toBe(1.1);
    expect(FLASH_DEFAULT.colorToken, "默认那道光由 CSS 自带色,不该由这里给").toBeNull();
  });

  it("低于稀有段的印也不分层 —— 灵/玄/地虽 rare,不值得更重的光", () => {
    for (const q of QUALITIES.filter((x) => x.rank < 6)) {
      expect(flashPlanOf(q.id), `${q.name} 不该分到更重的光`).toEqual(FLASH_DEFAULT);
    }
  });
});

describe("闪光的分量 · 稀有段分层", () => {
  it("天与仙一档,神品单占一档", () => {
    expect(flashPlanOf("heaven").tier).toBe("rare");
    expect(flashPlanOf("immortal").tier).toBe("rare");
    expect(flashPlanOf("divine").tier).toBe("top");
  });

  it("时长严格递增,且都比默认久", () => {
    const plain = flashPlanOf(undefined).seconds;
    const rare = flashPlanOf("heaven").seconds;
    const top = flashPlanOf("divine").seconds;
    expect(rare).toBeGreaterThan(plain);
    expect(top).toBeGreaterThan(rare);
    expect(top).toBe(1.6);
  });

  it("色取自那一档的 token,不是恒定金色", () => {
    for (const id of ["heaven", "immortal", "divine"] as const) {
      const plan = flashPlanOf(id);
      expect(plan.colorToken).toBe(qualityDef(id).color);
      expect(plan.colorToken, `${id} 的色不该退成默认`).not.toBeNull();
    }
    // 三档的 token 互不相同 —— 否则"跟这一件走"就是句空话
    const tokens = (["heaven", "immortal", "divine"] as const).map(
      (id) => flashPlanOf(id).colorToken,
    );
    expect(new Set(tokens).size).toBe(3);
  });
});

describe("闪光的分量 · 声与光同一份判定", () => {
  it("三档的光各自配一声,且与稀有段同一条界", () => {
    expect(flashPlanOf(undefined).sfx).toBe("rare");
    expect(flashPlanOf("earth").sfx, "灵/玄/地不升声").toBe("rare");
    expect(flashPlanOf("heaven").sfx).toBe("rareHigh");
    expect(flashPlanOf("immortal").sfx).toBe("rareHigh");
    expect(flashPlanOf("divine").sfx).toBe("rareTop");
  });

  it("光升一档,声也升一档 —— 两件事不许分叉", () => {
    const tian = flashPlanOf("heaven");
    const shen = flashPlanOf("divine");
    expect(tian.tier).toBe("rare");
    expect(tian.sfx).toBe("rareHigh");
    expect(shen.tier).toBe("top");
    expect(shen.sfx).toBe("rareTop");
    // 没有一种组合是「光到顶了,声还在底」或反过来
    for (const q of QUALITIES) {
      const plan = flashPlanOf(q.id);
      const lightRank = plan.tier === "top" ? 2 : plan.tier === "rare" ? 1 : 0;
      const soundRank = plan.sfx === "rareTop" ? 2 : plan.sfx === "rareHigh" ? 1 : 0;
      expect(soundRank, `${q.name} 的光与声档位分叉了`).toBe(lightRank);
    }
  });
});

describe("闪光的分量 · 只是分类", () => {
  it("不碰 DOM、不碰结算 —— 色值留给界面求", () => {
    const src = readSource("src/ui/flashTier.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["document", "getComputedStyle", "window."]) {
      expect(src, `纯函数里不该出现 ${banned}`).not.toContain(banned);
    }
    // 只许 import 品质表(那是数据的唯一来源)
    const imports = [...src.matchAll(/^import[^;]*from ["']([^"']+)["']/gm)].map((m) => m[1]!);
    for (const from of imports) {
      // 只许品质表(数据的唯一来源)与同层的 rareSfx(声与光同一份判定)
      expect(from, `不该 import ${from}`).toMatch(/^@\/data\/qualities$|^@\/types$|^\.\/rareSfx$/);
    }
  });
});

describe("闪光的分量 · 真接线", () => {
  it("提示条按这条判据给光,并把时长写到动画上", () => {
    const host = readSource("src/components/common/ToastHost.vue");
    expect(host, "提示条要读这份分类").toContain("flashPlanOf(");
    expect(host, "要有稳定落点供真浏览器复核").toContain("data-rare-flash-tier");
  });

  it("CSS 那边认一个时长变量,而不是写死 1.1s", () => {
    const css = readSource("src/style.css");
    expect(css, "闪光的时长要可由调用方给").toMatch(/\.rare-flash[^}]*var\(--flash-ms/);
  });
});
