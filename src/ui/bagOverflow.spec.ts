/**
 * 「整趟约 814 件」是半句话 —— 剩下那一截去哪了?
 *
 * 行囊 120 格(`BAG_CAPACITY`),而装备进门还要过收纳裁决
 * (`core/loot` 的 `EQUIP_INTAKE`:自动回收 / 腾位 / 满包折算)。
 * 玩家在出行模式窗看到「整趟约 装备 814 件」,会以为包里真会多出 814 件;
 * 实际绝大多数当场折成器灵尘进了资源账 —— 而这件事此前只活在 core/loot 的注释里。
 *
 * 本仓纪律:「让看不见的机制可见 —— 该露的都要露进界面,不许只活在注释或 README 里」。
 */
import { describe, expect, it } from "vite-plus/test";
import { BAG_CAPACITY } from "@/data/constants";
import { exploreTripPlan } from "@/core/explorationPlan";
import { bagOverflowText, exploreModeRow, type ExploreModeRow } from "@/ui/exploreModeText";
import { readSource } from "@/test/readSource";

const row = (over: Partial<Parameters<typeof exploreModeRow>[0]> = {}): ExploreModeRow =>
  exploreModeRow({
    plan: exploreTripPlan({ mode: "risky", petId: null, mods: {}, eventChance: 0.2 }),
    materialsPerBattle: 1.9,
    equipBattlesPerPiece: 3.2,
    pillBattlesPerPiece: 12.5,
    risk: "大凶",
    bagFree: BAG_CAPACITY,
    ...over,
  });

describe("行囊装不下那一截要说出来", () => {
  it("差额 = 整趟装备期望 − 余位,且不报负数", () => {
    const r = row();
    // risky 是 529 场、3.2 场一件 —— 期望 165 件,余位 120
    expect(r.equipOverflow).toBe(Math.round(r.battles / 3.2) - BAG_CAPACITY);
    expect(r.equipOverflow).toBeGreaterThan(0);

    // 余位足够时不该出现负差额
    const roomy = row({ bagFree: 100000 });
    expect(roomy.equipOverflow, "装得下时差额必须是 0,不许是负数").toBe(0);
  });

  it("装得下就不报 —— 短档加一句只是噪音", () => {
    expect(bagOverflowText(row({ bagFree: 100000 }))).toBeNull();
  });

  it("差一两件也不报:那是挪一下的事,不是这一档的账", () => {
    // 造一个「刚好差 1 件」的:余位 = 期望 − 1
    const probe = row();
    const expected = Math.round(probe.battles / 3.2);
    expect(bagOverflowText(row({ bagFree: expected - 1 }))).toBeNull();
    expect(bagOverflowText(row({ bagFree: expected - 3 }))).toBeNull();
  });

  it("差得多就报,并报出确定的差额", () => {
    const text = bagOverflowText(row());
    expect(text, "大凶档装不下却说没事").not.toBeNull();
    expect(text).toContain(String(row().equipOverflow));
    // 说的是「折作器灵尘」—— 与 core/loot 的处置同源,不是另编一个去向
    expect(text).toContain("器灵尘");

    /*
     * 不报「会折多少尘」:折尘按品质 1~256 分档,那是估计值。
     * 报出来就是假精度,而本仓纪律不许手写会被常数改动的数。
     */
    expect(text, "不该编一个折尘总数").not.toMatch(/\d+\s*尘/);
  });

  it("四档的差额随档位单调递增 —— 走得越久越是装不下", () => {
    const over = (["normal", "deep", "risky", "prolonged"] as const).map(
      (mode) =>
        exploreModeRow({
          plan: exploreTripPlan({ mode, petId: null, mods: {}, eventChance: 0.2 }),
          materialsPerBattle: 1.9,
          equipBattlesPerPiece: 3.2,
          pillBattlesPerPiece: 12.5,
          risk: "安稳",
          bagFree: BAG_CAPACITY,
        }).equipOverflow,
    );
    for (let i = 1; i < over.length; i += 1) {
      expect(over[i]!, `${over[i - 1]} → ${over[i]}`).toBeGreaterThanOrEqual(over[i - 1]!);
    }
  });
});

describe("接线:差额得从行囊真实余位来", () => {
  it("模式窗按 BAG_CAPACITY 减包内件数算余位,不用写死的数", () => {
    const view = readSource("src/views/AdventureView.vue");
    expect(view, "余位要现算").toMatch(
      /bagFree:\s*Math\.max\(\s*0,\s*BAG_CAPACITY\s*-\s*inventory\.bagItems\.length\s*\)/,
    );
  });

  it("模板只在有话可说时才渲染那一行", () => {
    const view = readSource("src/views/AdventureView.vue");
    expect(view, "没差额时不该占一行").toContain('v-if="bagOverflowText(m)"');
  });
});
