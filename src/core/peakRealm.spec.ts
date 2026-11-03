/**
 * 历世足迹 —— 只增不减的记账,且不许被当成门槛。
 *
 * 判据五组:
 *   一 夹值:坏值 / 越界 / 小数各自回到合法区间,与 major 的 sanitize 同口径;
 *   二 只增不减:转世折回起点抹不掉足迹,平级不重复报;
 *   三 真接线:突破时记一笔、转世后仍在、存档往返不丢;
 *   四 界域志读它:谱上那一行盖「曾至」,卷首报一行;
 *   五 它不进任何门槛 —— 本模块不 import 结算 / 门槛 / 掉落模块。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { MAX_MAJOR } from "@/data/realms";
import { clampPeakMajor, notePeakMajor } from "./peakRealm";
import { usePlayerStore } from "@/stores/player";
import { realmCodexCurrent, realmCodexWorldRows } from "./realmCodex";
import { realmCodexPeakLine, realmCodexRealmEntries } from "@/ui/realmCodexDesk";

beforeEach(() => setActivePinia(createPinia()));

describe("历世足迹 · 夹值", () => {
  it("坏值一律回到起点,越界夹回最高境", () => {
    expect(clampPeakMajor(Number.NaN)).toBe(0);
    expect(clampPeakMajor(undefined)).toBe(0);
    expect(clampPeakMajor("3")).toBe(0);
    expect(clampPeakMajor(-5)).toBe(0);
    expect(clampPeakMajor(999)).toBe(MAX_MAJOR);
    expect(clampPeakMajor(2.7)).toBe(2);
  });
});

describe("历世足迹 · 只增不减", () => {
  it("到了更高的一境就刷新,并报出「真的刷新了」", () => {
    expect(notePeakMajor(2, 5)).toEqual({ peak: 5, raised: true });
  });

  it("回头走老路不降级 —— 转世折回起点抹不掉足迹", () => {
    expect(notePeakMajor(5, 0)).toEqual({ peak: 5, raised: false });
    expect(notePeakMajor(5, 3)).toEqual({ peak: 5, raised: false });
  });

  it("平级不重复报 —— 同境逐层突破不该天天说「你到过新的一境」", () => {
    expect(notePeakMajor(5, 5).raised).toBe(false);
  });

  it("空档(0)到第一境也算刷新", () => {
    expect(notePeakMajor(0, 1)).toEqual({ peak: 1, raised: true });
  });
});

describe("历世足迹 · 真接线", () => {
  it("突破之后,这一笔记在玩家身上而不是某一世", () => {
    const player = usePlayerStore();
    expect(player.reincarnation.peakMajor).toBe(0);
    // 直接推境界(与 advanceRealm 同一条口径):记一笔
    player.major = 4;
    player.notePeak();
    expect(player.reincarnation.peakMajor).toBe(4);
  });

  it("转世之后,足迹仍在 —— 这是它与 major 的区别", () => {
    const player = usePlayerStore();
    player.major = 6;
    player.notePeak();
    player.rebirth({ roots: [] } as never);
    expect(player.major, "新的一世从起点重来").toBe(0);
    expect(player.reincarnation.peakMajor, "到过的地方不该被抹掉").toBe(6);
  });

  it("存档修复把坏值夹回来", () => {
    const player = usePlayerStore();
    player.reincarnation = { ...player.reincarnation, peakMajor: 999 } as never;
    player.sanitize();
    expect(player.reincarnation.peakMajor).toBe(MAX_MAJOR);
    player.reincarnation = { ...player.reincarnation, peakMajor: -3 } as never;
    player.sanitize();
    expect(player.reincarnation.peakMajor).toBe(0);
  });
});

describe("历世足迹 · 界域志读它", () => {
  it("当前境之上、曾到过的境读「曾至」;当前境仍是「此刻」", () => {
    const row = realmCodexWorldRows(0)[0]!;
    // 这一世在炼气(0),历世到过第 3 境
    const entries = realmCodexRealmEntries(row, 0, 3);
    expect(entries[0]!.state).toBe("current");
    expect(entries[1]!.state).toBe("reached");
    expect(entries[2]!.state).toBe("reached");
    expect(entries[3]!.state).toBe("reached");
    expect(entries[4]!.state, "没到过的仍是未至").toBe("future");
    expect(entries[1]!.stateLabel).toBe("曾至");
    expect(entries[1]!.stateMark).toBe("曾");
  });

  it("历世最高就是此刻时,谱上不多出第四种态 —— 同一眼不读两遍", () => {
    const row = realmCodexWorldRows(3)[0]!;
    const entries = realmCodexRealmEntries(row, 3, 3);
    expect(entries.some((e) => e.state === "reached")).toBe(false);
    expect(entries[3]!.state).toBe("current");
  });

  it("坏档不许把谱读成一片「曾至」:负数与 NaN 当没有", () => {
    const row = realmCodexWorldRows(1)[0]!;
    for (const bad of [Number.NaN, -9, undefined]) {
      const entries = realmCodexRealmEntries(row, 1, bad as number);
      expect(
        entries.some((e) => e.state === "reached"),
        `${bad} 不该造出曾至`,
      ).toBe(false);
    }
  });

  it("卷首那一行只在「这一世还没走回」时出现", () => {
    const current = realmCodexCurrent(0);
    expect(realmCodexPeakLine(current, 0), "此刻即最高,整行不出").toBeNull();
    expect(realmCodexPeakLine(current, 5)?.label).toContain("此身曾至");
    expect(realmCodexPeakLine(current, 5)?.def.name).toBe("炼虚");
  });

  it("界面与卷首读的是同一本账", () => {
    const view = readSource("src/views/RealmCodexView.vue");
    expect(view, "界域志要读历世足迹").toContain("peakMajor");
    expect(view, "要有稳定落点供真浏览器复核").toContain("data-realm-peak");
    expect(view, "谱上那一行也要读它").toContain("realmCodexRealmEntries(row, player.major");
  });
});

describe("历世足迹 · 不进门槛", () => {
  it("模块不 import 结算 / 门槛 / 掉落 / 突破 —— 它只是一行记账", () => {
    const src = readSource("src/core/peakRealm.ts");
    for (const banned of ["statsCalc", "powerRating", "breakthroughInfo", "engineWorld", "loot"]) {
      expect(src, `历世足迹不该认得 ${banned}`).not.toContain(banned);
    }
    expect(src, "它只该认得境界表的上界").toContain("MAX_MAJOR");
  });
});
