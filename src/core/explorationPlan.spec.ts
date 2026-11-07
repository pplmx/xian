/**
 * 规模账 —— 「一趟是几场」这件事必须有人一直说得出来。
 *
 * ## 这条判据守的是什么
 *
 * 出行模式窗一度把**每场**的掉落期望当成**整趟**摆出来:
 *
 * ```text
 * 30分
 * 预计材料 ≈ 1.9 件
 * 装备 约 3.2 趟一件 · 丹药 约 12.5 趟一枚
 * ```
 *
 * 那三个数来自 `core/loot`,读的是 `afterWin` 那张每场掉落表。而一场「寻常游历」
 * 是 30 分钟 = 150 格遭遇 ≈ **126 场战斗** —— 整趟材料约 240 件、装备约 38 件、
 * 丹药约 10 枚。界面上那行小了三个数量级,而它恰好是「多花一倍时间值不值」的依据。
 *
 * 数字对不上只是症状。病根是没有人说过「一趟是几场」,于是「每场多少」与
 * 「整趟多少」之间没有可换算的距离,谁都能把两者混着说。这一份把它钉住。
 *
 * ## 判据分三层
 *
 * 1. `encountersIn` 与离线结算那道算式逐字等价(同源,不是巧合);
 * 2. 四个档位的场次严格递增、且量级落在「一两百场」这个区间 —— 若哪天有人
 *    把间隔改成 5 分钟,界面的「约 126 场」会跟着变,而不是继续撒谎;
 * 3. `ui/exploreModeText` 的整趟读数 = 每场 × 场次(乘出来的,不是另写一份)。
 */
import { describe, expect, it } from "vite-plus/test";
import { EXPLORE_BATTLE_INTERVAL, EXPLORE_EVENT_CHANCE, EXPLORE_MODES } from "@/data/constants";
import type { ExploreMode, StatMods } from "@/types";
import { petDef } from "@/data/pets";
import {
  encountersIn,
  eventsIn,
  exploreDurationSec,
  exploreTripPlan,
  explorationSpeedMult,
} from "./explorationPlan";
import { exploreModeRow, tripHaulText, tripScaleText } from "@/ui/exploreModeText";

const ORDER: ExploreMode[] = ["normal", "deep", "risky", "prolonged"];
const NO_MODS = {} as StatMods;

const plan = (mode: ExploreMode, mods: StatMods = NO_MODS, eventChance = EXPLORE_EVENT_CHANCE) =>
  exploreTripPlan({ mode, petId: null, mods, eventChance });

describe("规模账 · 一趟到底是几场", () => {
  /**
   * 同源判据:`core/offline` 结算整段历练时算的是
   * `Math.floor((simSec / EXPLORE_BATTLE_INTERVAL) * speed)`。
   * 界面要报「这一趟几场」,必须与那一句给出同一个数 —— 否则离线和窗里各说各话。
   */
  it("encountersIn 与离线那句逐字等价", () => {
    for (const durationSec of [1800, 3600, 7200, 14400]) {
      for (const speed of [1, 1.12, 1.5, 2]) {
        expect(encountersIn(durationSec, speed)).toBe(
          Math.floor((durationSec / EXPLORE_BATTLE_INTERVAL) * speed),
        );
      }
    }
  });

  it("坏输入一律给 0,不把 NaN 递进界面", () => {
    expect(encountersIn(Number.NaN, 1)).toBe(0);
    expect(encountersIn(1800, 0)).toBe(0);
    expect(encountersIn(-1, 1)).toBe(0);
    expect(eventsIn(Number.NaN, 0.16)).toBe(0);
    expect(eventsIn(100, Number.NaN)).toBe(0);
  });

  it("四个档位的场次严格递增 —— 时间真的换来了更多场", () => {
    const battles = ORDER.map((m) => plan(m).battles);
    for (let i = 1; i < battles.length; i += 1) {
      expect(battles[i]!, `${ORDER[i]} 的场次该多于 ${ORDER[i - 1]}`).toBeGreaterThan(
        battles[i - 1]!,
      );
    }
  });

  /**
   * 量级判据:这一条防的是「常量改了而界面文案没改」。
   * 界面上写着「约 N 场」时,N 由规模账现算,故这里只钉量级 ——
   * 一旦间隔被改成分钟级,这条会红,提示「界面的场次读数已经不在人能理解的量级」。
   */
  it("寻常游历是一两百场这个量级 —— 不是十几场,也不是上万场", () => {
    const normal = plan("normal");
    expect(normal.battles).toBeGreaterThan(100);
    expect(normal.battles).toBeLessThan(300);
    expect(normal.encounters).toBeGreaterThan(normal.battles);
  });

  it("场次 + 际遇 = 遭遇格数(非战即事,不凭空蒸发)", () => {
    for (const mode of ORDER) {
      const p = plan(mode);
      expect(p.battles + p.events, `${mode}:交战场次与际遇次数该正好合上遭遇格数`).toBe(
        p.encounters,
      );
    }
  });
});

describe("规模账 · 时长与间隔都只认一份实现", () => {
  it("实发时长会跟着灵兽性格走 —— 界面不许只报基础时长", () => {
    // 雪背小龟是「慢稳」×1.1,赤火雀 / 疾行那类 ×0.88(见 data/petTraits),
    // 用真实灵兽 id 而不是编一个 —— 编出来的 id 查不到,性格退回中性,判据会假绿。
    const steady = petDef("pet_xuegui");
    expect(steady?.personality, "判据取的那只灵兽该是「慢稳」").toBe("steady");
    expect(exploreDurationSec("normal", "pet_xuegui")).toBeGreaterThan(
      EXPLORE_MODES.normal.durationSec,
    );
    // 没有灵兽时就是基础时长本身
    expect(exploreDurationSec("normal", null)).toBe(EXPLORE_MODES.normal.durationSec);
    // 认不出的 id 也退回中性,不抛错
    expect(exploreDurationSec("normal", "pet_does_not_exist")).toBe(
      EXPLORE_MODES.normal.durationSec,
    );
  });

  it("历练速度词条改的是间隔,不是时长", () => {
    const base = plan("normal");
    const fast = plan("normal", { explorationSpeed: 1 } as StatMods);
    expect(fast.durationSec, "速度词条不该改动这一趟的墙钟时长").toBe(base.durationSec);
    expect(fast.cadenceSec).toBeLessThan(base.cadenceSec);
    expect(fast.battles, "更快的间隔换来更多场").toBeGreaterThan(base.battles);
  });

  it("explorationSpeedMult 就是「1 + 词条」,不另设上限", () => {
    expect(explorationSpeedMult({} as StatMods)).toBe(1);
    expect(explorationSpeedMult({ explorationSpeed: 0.5 } as StatMods)).toBe(1.5);
  });
});

describe("模式窗文案 · 整趟读数必须是乘出来的", () => {
  const row = (mode: ExploreMode) =>
    exploreModeRow({
      plan: plan(mode),
      materialsPerBattle: 1.9,
      equipBattlesPerPiece: 3.2,
      pillBattlesPerPiece: 12.5,
      risk: "安稳",
    });

  it("整趟材料 = 每场期望 × 场次 —— 不是把每场那个数原样搬上来", () => {
    const r = row("normal");
    const expected = Number(r.materialsPerBattle) * r.battles;
    // 三位数以上取整(见 countText):判据按 1% 宽容,而不是按小数位
    expect(Number(r.materialsPerTrip)).toBeGreaterThan(expected * 0.99);
    expect(Number(r.materialsPerTrip)).toBeLessThan(expected * 1.01);
    // 每场的读数还得在,但它的量级与整趟差了两个数量级 —— 这正是当初错的地方
    expect(Number(r.materialsPerTrip)).toBeGreaterThan(Number(r.materialsPerBattle) * 50);
  });

  it("大数取整、小数留一位 —— 「311.2 件」是假精度,「3.2 场一件」需要那一位", () => {
    const r = row("normal");
    expect(r.materialsPerTrip, "过百的件数不该带小数").toMatch(/^\d+$/);
    // 每场那个数在 1~2 之间,那一位有用
    expect(r.materialsPerBattle).toMatch(/^\d+(\.\d)?$/);
  });

  it("整趟装备件数 = 场次 ÷ 「几场一件」—— 于是「约 3.2 场一件」读得出整趟约 38 件", () => {
    const r = row("normal");
    expect(Number(r.equipPerTrip)).toBeCloseTo(r.battles / 3.2, 0);
  });

  it("命中率为 0 时给「—」,不编一个无穷大的数", () => {
    const r = exploreModeRow({
      plan: plan("normal"),
      materialsPerBattle: 1.9,
      equipBattlesPerPiece: null,
      pillBattlesPerPiece: 0,
      risk: "安稳",
    });
    expect(r.equipPerTrip).toBe("—");
    expect(r.pillPerTrip).toBe("—");
  });

  it("一行文案说全:「约 N 场 · 每 X 秒一场 · 途中约 K 次际遇」与整趟产出", () => {
    const r = row("normal");
    const scale = tripScaleText(r);
    expect(scale).toContain(`约 ${r.battles} 场`);
    expect(scale).toMatch(/约每 [\d.]+ 秒一场/);
    expect(scale, "际遇要单独报 —— 它不交战").toContain("次际遇");
    const haul = tripHaulText(r);
    expect(haul).toContain(`装备 ${r.equipPerTrip} 件`);
    expect(haul).toContain(`丹药 ${r.pillPerTrip} 枚`);
    expect(haul).toContain(`材料 ${r.materialsPerTrip} 件`);
  });

  it("界面上不许再出现「趟一件 / 趟一枚」这种把每场当整趟的措辞", () => {
    const r = row("normal");
    for (const text of [tripScaleText(r), tripHaulText(r)]) {
      expect(text, "「趟」只指整趟,不许拿来给每场读数当单位").not.toMatch(/趟一件|趟一枚/);
    }
  });
});
