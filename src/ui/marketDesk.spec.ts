import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { qualityDef } from "@/data/qualities";
import { qualityTextColor } from "@/ui/qualityTier";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("坊市案 · 市桥图先立意，三册再落到摊签", () => {
  it("常见两档品名在品阶晕染上仍有正文可读性，其余品阶不改字色", () => {
    expect(qualityTextColor("mortal")).toBe("var(--color-ink-soft)");
    expect(qualityTextColor("fine")).toBe(
      `color-mix(in srgb, ${qualityDef("fine").color} 85%, var(--color-ink) 15%)`,
    );
    expect(qualityTextColor("excellent")).toBe(qualityDef("excellent").color);
  });

  it("卷首市桥图读三册真值，整图不重复进入读屏", () => {
    const view = source("src/views/MarketView.vue");
    const arcade = source("src/components/market/MarketArcade.vue");

    expect(view, "坊市卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,220}\bfeatured\b/,
    );
    expect(view, "市桥图要进独立主视觉槽").toMatch(/<template #visual>[\s\S]{0,180}<MarketArcade/);
    expect(view, "货架真值从市况汇总读").toContain(':goods="marketPulse.availableGoods"');
    expect(view, "悬赏真值从市况汇总读").toContain(':bounties="marketPulse.claimableBounties"');
    expect(view, "寄卖真值从市况汇总读").toContain(':consign="marketPulse.consignCount"');
    expect(view, "寄卖总格数不手写").toContain(':consign-slots="MARKET_CONSIGN_SLOTS"');
    expect(arcade, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
    expect(arcade, "市桥图按当前册点亮摊位").toContain(
      ":class=\"{ 'is-active': active === 'shelf' }\"",
    );
    expect(arcade, "可交悬赏要有独立印面").toContain('v-if="bounties > 0"');
  });

  it("今日行市把可买、可交、寄卖与最近归账收成一张总账", () => {
    const view = source("src/views/MarketView.vue");
    const markers = view.match(/data-market-pulse(?![-\\w])/g) ?? [];
    const pulse = view.slice(view.indexOf("data-market-pulse"), view.indexOf("</FolioPageHeader>"));

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/marketOverview 唯一一份").toContain("marketOverview(");
    expect(view, "总账货架总数读同一份汇总").toContain("marketPulse.value.goodsTotal");
    expect(view, "总账悬赏总数读同一份汇总").toContain("marketPulse.value.openBounties");
    expect(view, "总账寄卖总数读机制常量").toContain("total: MARKET_CONSIGN_SLOTS");
    expect(view, "总账三册可一键落位").toContain('v-for="row in marketLedgerRows"');
    expect(view, "最近归账只报最近一件").toContain("nextConsign.value.text");
    expect(pulse, "总账带可买运行时落点").toContain(":data-market-pulse-goods=");
    expect(pulse, "总账带可交运行时落点").toContain(":data-market-pulse-bounties=");
    expect(pulse, "总账带寄卖运行时落点").toContain(":data-market-pulse-consign=");
    expect(pulse, "今日行市必须给出一条先手").toContain("marketLead.title");
    expect(view, "先手仍读同一份市况").toContain("p.claimableBounties > 0");
  });

  it("货架摊签先报物件与价格，买不起或行囊满都置灰并列因", () => {
    const view = source("src/views/MarketView.vue");

    expect(view, "货架逐格渲染真实货架").toContain('v-for="slot in market.stock"');
    expect(view, "兵刃预览仍读确定性实例").toContain("marketEquipInstance(s, market.stockedAt)");
    expect(view, "买不起要列尚差").toContain("尚差 ${formatGN(stoneShort(slot.price))} 石");
    expect(view, "行囊满要置灰").toContain("slot.kind === 'equipment' && inventory.bagFull");
    expect(view, "行囊满要就地改口").toContain('"行囊已满"');
    expect(view, "售料不足也要列差").toContain("尚差 ${herbSellShort} 灵草");
    expect(view, "售铁不足也要列差").toContain("尚差 ${oreSellShort} 玄铁");
  });

  it("售罄与已领只换底和划记，不用整行透明度把文字压到读不清", () => {
    const css = source("src/styles/pages/market.css");

    expect(css, "售罄行不可整行降透明度").not.toMatch(
      /\.market-good\.is-sold\s*\{[\s\S]{0,80}?opacity:/,
    );
    expect(css, "已领赏单不可整行降透明度").not.toMatch(
      /\.market-bounty\.is-claimed\s*\{[\s\S]{0,80}?opacity:/,
    );
    expect(css, "售罄仍要保留可读的划记线索").toContain(".market-good.is-sold .market-good__name");
    expect(css, "已领仍要保留可读的划记线索").toContain(
      ".market-bounty.is-claimed .market-bounty__name",
    );
  });

  it("悬赏逐单把所需、缺口、酬劳与交货动作放在同一张赏单上", () => {
    const view = source("src/views/MarketView.vue");

    expect(view, "逐单状态与卷首共用 bountyStatus").toContain(
      "bountyStatus(o, bountyHoldings.value)",
    );
    expect(view, "赏单要有真实运行时落点").toContain(
      ":data-bounty-equip=\"o.kind === 'equip' ? o.idx : undefined\"",
    );
    expect(view, "贡器价随品质现算").toContain("equipBountyReward(o.tier, 0)");
    expect(view, "一键领取仍只收现成非贡器单").toContain("autoClaimable.length");
    expect(view, "缺货时要就地列短差").toContain("bountyShort(o)");
  });

  it("寄卖架报在架、进度与最近入账，续开和回翻仍走同一窗口", () => {
    const view = source("src/views/MarketView.vue");

    expect(view, "寄卖进度按同一时长常数现算").toContain("MARKET_CONSIGN_SECONDS * 1000");
    expect(view, "寄卖逐件有进度轨道").toContain(
      ':style="{ width: `${consignProgress(p.finishAt)}%` }"',
    );
    expect(view, "寄卖候选仍遍历渲染窗口").toContain('v-for="it in consignPage.visible"');
    expect(view, "续开仍走完整背包").toContain(
      "nextInventoryLimit(shownBefore, inventory.bagItems.length)",
    );
    expect(view, "回翻仍走同一窗口函数").toContain("previousInventoryLimit");
    expect(view, "寄卖总数与起始位保留").toContain(
      ':data-market-consign-start="consignPage.start"',
    );
    expect(view, "余件显式续开").toContain("consignPage.hidden > 0");
    expect(view, "售丹仍明确现持").toContain("(现持 ");
    expect(view, "售丹每颗有回执").toContain("已售 1 颗");
  });

  it("手机总账三栏，620 起货架与赏单并读，220 以下摊签退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".market-pulse {");
    const end = css.indexOf("/*\n   * 门庭案", start);
    const marketCss = css.slice(start, end);

    expect(start, "坊市样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "坊市样式段要有明确结尾").toBeGreaterThan(start);
    expect(marketCss).toMatch(
      /\.market-pulse__tallies\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(marketCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.market-goods\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(marketCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.market-sell-grid\s*\{[\s\S]{0,120}minmax\(0, 1\.08fr\)/,
    );
    expect(marketCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,700}\.market-pulse__tallies\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(marketCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.market-good\s*\{[\s\S]{0,100}grid-template-columns:\s*1\.82rem minmax\(0, 1fr\)/,
    );
  });
});
