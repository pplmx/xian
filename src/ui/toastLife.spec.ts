/**
 * 提示条停多久 —— 神品落地与灵品落地,不该停同样久。
 *
 * ## 问题:四条感官里,最后一条没跟着品阶走
 *
 * 品阶早已在**三层**分层了:
 *   颜色与边框(第 18 轮)      灵/玄/地 一档、天仙 一档、神 一档
 *   全屏那道光(第 21 轮)      1.1s / 1.35s / 1.6s
 *   那一声玉振(第 22 轮)      rare / rareHigh / rareTop
 *
 * 而**提示条自己停留多久**至今只有两档:`rare ? 4200 : 2600`(见 stores/ui 的 toast)。
 * 于是「神品法宝天降」与「拾得一件灵品」在屏幕上停的时间一模一样 ——
 * 这作里最稀有的那一次,与寻常的一次,在场时长没有任何区别。
 *
 * ## 为什么停留时长是这里最有效的一把尺
 *
 * 光只有 1.1~1.6 秒,一闪而过;声音更短。而提示条是玩家**真正去读**的那一层:
 * 「天降机缘!获得法宝「混沌钟」」这种句子要读完、还要决定点不点开去看详情。
 * 神品那条更长、更值得读,却和灵品同时走 —— 读慢一点就没了。
 *
 * 且时长比颜色稳:颜色在暗场与亮场观感差别很大(品阶色有深有浅),
 * 而 4.2 秒与 5.4 秒的差别,人不需要对比就能感到 —— 与 flashTier 同一条理由。
 *
 * ## 分层的界必须与视觉/声音同源
 *
 * 三层照抄 `flashTier` 与 `rareSfx` 的界(rank < 6 / 6-7 / 8),不另立一套:
 * 同一条提示不许出现「光按神品闪、声按神品响、却按灵品的时长停」这种分叉。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { QUALITIES, qualityDef } from "@/data/qualities";
import { TOAST_LIFE, toastLifeMs } from "./toastLife";

describe("提示条停多久 · 默认不变", () => {
  it("寻常提示仍是 2600ms —— 绝大多数提示的时长一字不改", () => {
    expect(toastLifeMs({ kind: "info" })).toBe(2600);
    expect(toastLifeMs({ kind: "success" })).toBe(2600);
    expect(toastLifeMs({ kind: "warn" })).toBe(2600);
  });

  it("没有印的 rare 仍是 4200ms —— 转世/突破/里程碑那一支不许变", () => {
    expect(toastLifeMs({ kind: "rare" })).toBe(4200);
    expect(toastLifeMs({ kind: "rare", seal: undefined })).toBe(4200);
  });

  it("低于稀有段的印也不加时 —— 灵/玄/地虽 rare,不值得停更久", () => {
    for (const q of QUALITIES.filter((x) => x.rank < 6)) {
      expect(toastLifeMs({ kind: "rare", seal: q.id }), `${q.name} 不该加时`).toBe(4200);
    }
  });
});

describe("提示条停多久 · 按品阶分层", () => {
  it("天仙比寻常 rare 久,神品比天仙久 —— 严格递增", () => {
    const high = toastLifeMs({ kind: "rare", seal: "heaven" });
    const immortal = toastLifeMs({ kind: "rare", seal: "immortal" });
    const top = toastLifeMs({ kind: "rare", seal: "divine" });
    expect(high, "天品要比寻常 rare 久").toBeGreaterThan(4200);
    expect(immortal, "仙品与天品同档").toBe(high);
    expect(top, "神品最久").toBeGreaterThan(high);
  });

  it("同档内一致 —— 天与仙同长,不各写一个数", () => {
    expect(toastLifeMs({ kind: "rare", seal: "heaven" })).toBe(
      toastLifeMs({ kind: "rare", seal: "immortal" }),
    );
  });

  it("分层界与视觉/声音同源:走品质表的 rank,不自己写死 6 与 8", () => {
    // 同一条提示的四层反馈(色 / 光 / 声 / 停留)必须用同一把尺
    for (const q of QUALITIES) {
      const visualRare = q.rank >= 6;
      const got = toastLifeMs({ kind: "rare", seal: q.id });
      expect(got > 4200, `${q.name}(rank ${q.rank}) 是否加时应与稀有界一致`).toBe(visualRare);
    }
  });
});

describe("提示条停多久 · 坏值不撒谎", () => {
  it("认不得的品阶印按寻常 rare 走 —— 不长出一档不存在的时间", () => {
    expect(toastLifeMs({ kind: "rare", seal: "no_such" as never })).toBe(4200);
  });

  it("非 rare 的提示即使带了印也不加时 —— 印只在 rare 那一支有意义", () => {
    expect(toastLifeMs({ kind: "info", seal: "divine" })).toBe(2600);
  });
});

describe("提示条停多久 · 只是分类", () => {
  it("不 import store / core / DOM —— 它不该知道任何玩法", () => {
    const src = readSource("src/ui/toastLife.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:store 的 toast 读它,不再自己写三元式", () => {
    const src = readSource("src/stores/ui.ts");
    expect(src, "时长要来自共享模块").toContain("toastLifeMs(");
    expect(src, "不再就地手写两档").not.toMatch(/kind === "rare" \? 4200 : 2600/);
  });
});

describe("提示条停多久 · 三档都是正数且有序", () => {
  it("TOAST_LIFE 的每一档都大于 0,且按 base < high < top 排", () => {
    expect(TOAST_LIFE.base).toBeGreaterThan(0);
    expect(TOAST_LIFE.plainRare).toBeGreaterThan(0);
    expect(TOAST_LIFE.high).toBeGreaterThan(TOAST_LIFE.plainRare);
    expect(TOAST_LIFE.top).toBeGreaterThan(TOAST_LIFE.high);
  });

  it("神品那一条至少比寻常 rare 多出一秒 —— 够读完一整句再决定点不点", () => {
    const top = toastLifeMs({ kind: "rare", seal: "divine" });
    expect(top - 4200).toBeGreaterThanOrEqual(1000);
  });

  it("最高一档不许长到赖着不走", () => {
    expect(toastLifeMs({ kind: "rare", seal: "divine" })).toBeLessThanOrEqual(8000);
  });

  it("qualityDef 读得到每一档 —— 分层是拿真表算的,不是猜的", () => {
    expect(qualityDef("divine").rank).toBe(8);
    expect(qualityDef("heaven").rank).toBe(6);
  });
});
