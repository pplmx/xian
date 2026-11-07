/**
 * 设置的坏档防御 —— `settings.sanitize()` 此前**没有一条判据**。
 *
 * ## 缺口
 *
 * 实测核实:全部 spec 里没有任何一处调用 `useSettingsStore().sanitize()`
 * (`apprentice` / `bounty` 等 store 的 sanitize 都有判据,settings 这份没有)。
 * 而 `stores/settings.spec.ts` 开头写着「其余设置项的失效安全各自在 sanitize
 * 与消费方 spec」—— 消费方确实各有判据,但 **sanitize 本身没人验**。
 *
 * 它守的是「设置被写坏之后不会把玩法带进 NaN / 无效类名」:
 *   · 音量写成 1e999 或字符串 → 播放器拿到 NaN → 整个音频挂掉;
 *   · theme 写成 "sepia" → 主题类名失效,页面停在默认色;
 *   · battleSpeed 写成 3 → 战报按不存在的倍速播;
 *   · smartKeep 写成 null → 分解面板整块崩。
 *
 * 还有一条**一次性迁移**(`legacyJunk`):老档没有 `junkBelowLine` 字段时,
 * 拿「勾过一键分解档位」当迁移信号,给老玩家保持旧手感;落过盘之后完全听玩家的。
 * 这条只该生效一次 —— 迁错了会让老玩家莫名其妙丢装备(或相反,死死留着该分解的)。
 *
 * ## 判据守什么
 *
 * 坏值一律夹回安全区;一次性迁移只在字段缺失时触发一次。
 * 它不规定默认值取多少(那是产品口味),只管**坏输入不会漏进玩法**。
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "@/stores/settings";

const store = () => useSettingsStore();

describe("settings.sanitize:坏档防御", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("音量:NaN / 负数 / 越界 / 字符串都夹回 0~100", () => {
    const s = store();
    s.musicVol = Number.NaN;
    s.sfxVol = -50;
    s.sanitize();
    expect(s.musicVol, "音乐音量 NaN 没归位 —— 播放器会拿到 NaN").toBe(50);
    expect(s.sfxVol, "音效音量负数没夹回").toBe(0);

    s.musicVol = 1e9;
    s.sfxVol = "loud" as never;
    s.sanitize();
    expect(s.musicVol, "音乐音量越界没夹到 100").toBe(100);
    expect(s.sfxVol, "音效音量是字符串却没归位").toBe(70);
  });

  it("战报倍速只认 1/2/4,别的都归 1", () => {
    const s = store();
    for (const bad of [3, 0, -2, Number.NaN, "2" as never]) {
      s.battleSpeed = bad as never;
      s.sanitize();
      expect(s.battleSpeed, `战报倍速 ${String(bad)} 没归 1 —— 会按不存在的倍速播`).toBe(1);
    }
    /* 合法值不许被改动 */
    for (const good of [1, 2, 4]) {
      s.battleSpeed = good as never;
      s.sanitize();
      expect(s.battleSpeed).toBe(good);
    }
  });

  it("主题只认 auto/light/dark,别的归 auto", () => {
    const s = store();
    s.theme = "sepia" as never;
    s.sanitize();
    expect(s.theme, "主题写成未知值没归位 —— 主题类名会失效").toBe("auto");
    s.theme = "dark" as never;
    s.sanitize();
    expect(s.theme, "合法主题被改掉了").toBe("dark");
  });

  it("布尔项只认真布尔:字符串 / 数字一律归 false", () => {
    const s = store();
    s.installNoticeDismissed = "true" as never;
    s.dndEvents = 1 as never;
    s.sanitize();
    expect(s.installNoticeDismissed, "主屏提示的已关标记不是真布尔").toBe(false);
    expect(s.dndEvents, "遇事勿扰不是真布尔").toBe(false);
  });

  it("smartKeep:null / 非对象不会让分解面板崩", () => {
    const s = store();
    s.smartKeep = null as never;
    s.sanitize();
    expect(s.smartKeep, "smartKeep 没有归成对象 —— 分解面板会整块崩").toBeTruthy();
    expect(typeof s.smartKeep).toBe("object");
    /* 四个 keep* 缺省为 true(默认保留),不是 false */
    expect(s.smartKeep.keepCoreAffix).toBe(true);
    expect(s.smartKeep.keepSetPiece).toBe(true);
  });

  it("smartKeep 的品质/层级档位夹进 0~8 与 0~32", () => {
    const s = store();
    s.smartKeep = { enabled: true, minQuality: 99, minTier: -5 } as never;
    s.sanitize();
    expect(s.smartKeep.minQuality, "品质档位越界没夹到 8").toBe(8);
    expect(s.smartKeep.minTier, "层级下限负数没夹回 0").toBe(0);
  });

  it("一次性迁移:老档(无 junkBelowLine)勾过档位时才迁,且只迁一次", () => {
    /*
     * 老档:勾过一键分解档位,但没有 junkBelowLine 字段
     * → 该玩家原本就期望「线下之物无救」,迁移时给他 junkBelowLine = true
     */
    const s = store();
    s.decomposeRanks = [1, 2] as never;
    s.smartKeep = { enabled: true } as never;
    s.sanitize();
    expect(s.smartKeep.junkBelowLine, "老档没有迁移信号时没给它保持旧手感").toBe(true);

    /*
     * 落过盘之后完全听玩家的:明确写 false 就是 false。
     *
     * 这一步的**前提必须保留 `decomposeRanks` 非空** —— 否则 `legacyJunk`
     * 本身就是 false,两种实现给出同一个结果,判据区分不出来。
     *
     * 注入验证的记录(踩过两次才理清):「只迁一次」由**两处**共同保证 ——
     *   ① `legacyJunk` 里的 `sk.junkBelowLine === undefined` 守卫
     *   ② 赋值处的 `=== undefined ? legacyJunk : ...` 三元
     * 只破坏其中一处,行为不变、判据不红(那是**对的**:实现仍守住了契约)。
     * 两处同时去掉才会真的每次都覆盖,这条判据当场红 —— 已实测确认。
     */
    s.decomposeRanks = [1, 2] as never;
    s.smartKeep = { enabled: true, junkBelowLine: false } as never;
    s.sanitize();
    expect(
      s.smartKeep.junkBelowLine,
      "字段已经存在时不该再迁移 —— 那会把玩家明确选的「留」覆盖成「分解」",
    ).toBe(false);
  });

  it("新档(没有勾过档位)迁移后 junkBelowLine 是 false", () => {
    const s = store();
    s.decomposeRanks = [] as never;
    s.smartKeep = { enabled: true } as never;
    s.sanitize();
    expect(s.smartKeep.junkBelowLine, "新档没有迁移信号,却给了旧手感").toBe(false);
  });
});
