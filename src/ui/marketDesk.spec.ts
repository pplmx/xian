import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { qualityDef } from "@/data/qualities";
import { qualityTextColor } from "@/ui/qualityTier";

const source = readSource;

describe("坊市的倒计时不许在首屏报三遍", () => {
  /*
   * 实测(390×844 展品档):「换货 01时59分」同一个读数在首屏出现**三次** ——
   *
   *   @181px  countdown-slot                «01时59分»        页头时钟
   *   @497px  folio-ledger-tally__detail    «换货 01时59分»    卷首总账
   *   @556px  folio-ledger-head__meta       «换货 01时59分»    货架章账首
   *
   * 后两处都读 `remainingSec`,文案一字不差,相距 59px。
   *
   * 三处职责其实不同,但**同一个数只能有一个出处**:
   *   - 页头时钟跟随当前册变化(切到悬赏就报换榜),是「随时可见的钟」,留;
   *   - 货架章账首是本册的核心读数,判据已钉着(「货架章首报真实换货时钟」),留;
   *   - 卷首总账那格是**导航摘要**,它的职责是「哪册有什么、点哪去」,
   *     不该把账首的时钟再抄一遍。
   *
   * 故这一格改报该摊独有的事实,不再复述倒计时。
   */
  it("卷首总账不再复述账首已经报过的倒计时", () => {
    const view = source("src/views/MarketView.vue");
    /* 账首那处留着(它是本册读数) */
    expect(view, "货架章首仍要报真实换货时钟").toContain(
      ':meta="`换货 ${formatCountdown(remainingSec)}`"',
    );
    /*
     * 按「从 id 起到下一个 id 或数组结束」切一格 —— 不能用 `}: {`,
     * 每格的结束是 `  },` 而不是 `}: {`(第一版就是这么写错的,判据空转成 "").
     */
    const rowOf = (id: string): string => {
      const start = view.indexOf(`id: "${id}" as const`);
      if (start < 0) return "";
      const next = view.indexOf(`id: "`, start + 10);
      return view.slice(start, next < 0 ? start + 900 : next);
    };
    const shelfRow = rowOf("shelf");
    expect(shelfRow, "找不到卷首总账的货架格(判据空转)").toBeTruthy();
    expect(
      shelfRow,
      "卷首总账的货架格又抄了一遍倒计时 —— 首屏会出现同一个「换货 01:59」三次",
    ).not.toContain("formatCountdown(remainingSec");
    const bountyRow = rowOf("bounty");
    expect(bountyRow, "找不到卷首总账的悬赏格(判据空转)").toBeTruthy();
    expect(bountyRow, "卷首总账的悬赏格抄了一遍换榜倒计时").not.toContain(
      "formatCountdown(bountyRemainingSec",
    );
  });
});

describe("坊市案 · 市桥图先立意，三册再落到摊签", () => {
  it("品名在各自的品阶晕染上都留足正文可读性", () => {
    expect(qualityTextColor("mortal")).toBe("var(--color-ink)");
    for (const quality of [
      "fine",
      "excellent",
      "spirit",
      "profound",
      "earth",
      "heaven",
      "immortal",
      "divine",
    ] as const) {
      expect(qualityTextColor(quality)).toBe(
        `color-mix(in srgb, ${qualityDef(quality).color} 80%, var(--color-ink) 20%)`,
      );
    }
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

  it("今日行市只留先手，三摊册口把可买、可交、寄卖与最近归账带进同一续卷", () => {
    const view = source("src/views/MarketView.vue");
    const rail = source("src/components/market/MarketChapterRail.vue");
    const markers = view.match(/data-market-pulse(?![-\\w])/g) ?? [];

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/marketOverview 唯一一份").toContain("marketOverview(");
    expect(view, "总账货架总数读同一份汇总").toContain("marketPulse.value.goodsTotal");
    expect(view, "总账悬赏总数读同一份汇总").toContain("marketPulse.value.openBounties");
    expect(view, "总账寄卖总数读机制常量").toContain("total: MARKET_CONSIGN_SLOTS");
    expect(view, "三册册口由同一份行数据生成").toContain(':tabs="marketLedgerRows"');
    expect(view, "账格由共享组件承担").toContain("<MarketChapterRail");
    expect(view, "最近归账只报最近一件").toContain("nextConsign.value.text");
    expect(view, "今日行市接共享此刻账").toContain("<LedgerPulse");
    expect(view, "先手动作读共享动作键").toContain("folio-ledger-pulse__action");
    expect(view, "今日行市必须给出一条先手").toContain("marketLead.title");
    expect(view, "先手仍读同一份市况").toContain("p.claimableBounties > 0");
    expect(view).toContain('<article class="market-register folio-span-all" data-market-register>');
    expect(view).toMatch(
      /<article class="market-register folio-span-all" data-market-register>[\s\S]{0,420}<LedgerPulse/,
    );
    expect(view).toMatch(
      /<\/LedgerPulse>[\s\S]{0,420}<MarketChapterRail[\s\S]{0,240}:tabs="marketLedgerRows"/,
    );
    expect(view, "独立页签退场，三摊册口本身承担切册").not.toContain("<InkTabs");

    expect(rail, "册口仍在吸顶书口里").toContain('class="tab-rail market-chapter-rail"');
    expect(rail).toContain('role="tablist"');
    expect(rail).toContain('aria-label="坊市分册"');
    expect(rail).toContain('@keydown="onKeydown"');
    expect(rail).toContain("<LedgerTally");
    expect(rail).toContain("tabbed");
    expect(rail).toContain(':id="`market-tab-${tab.id}`"');
    expect(rail).toContain(':aria-controls="`market-panel-${tab.id}`"');
    expect(rail).toContain("data-market-chapter-tab");
    expect(rail).toContain("data-market-chapter-fact");
    expect(rail).toContain("data-market-chapter-value");
    expect(rail).toContain("data-market-chapter-total");
    expect(rail, "可买运行时落点跟册口走").toContain(":data-market-pulse-goods=");
    expect(rail, "可交运行时落点跟册口走").toContain(":data-market-pulse-bounties=");
    expect(rail, "寄卖运行时落点跟册口走").toContain(":data-market-pulse-consign=");
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

  it("兵刃摊签可先验货：战力、当前对照、平铺、词条与固有都在买前摊开", () => {
    const view = source("src/views/MarketView.vue");
    const desk = source("src/ui/marketShelf.ts");
    const css = source("src/styles/pages/market.css");

    expect(desk, "验货与换装详情共用真实战力比较").toContain("equipPowerComparison(");
    expect(desk, "平铺与词条读同一份装备解析").toContain("resolveEquipStats(");
    expect(desk, "词条文案不在页面另拼").toContain("modsText(");
    expect(view, "货架预览装配走验货事实源").toContain("marketEquipView(");
    expect(view, "装备摊签可展开验货").toContain("data-market-equipment-toggle");
    expect(view, "展开态要有 aria-expanded").toContain(
      ':aria-expanded="inspectedSlot === slot.idx"',
    );
    expect(view, "验货帖有稳定运行时落点").toContain("data-market-equipment-preview");
    expect(view, "验货帖报本件战力").toContain("data-market-equipment-power");
    expect(view, "验货帖报当前对照").toContain("data-market-equipment-compare");
    expect(view, "验货帖展开后仍有当前对照落点").toContain("data-market-equipment-preview-compare");
    expect(view, "验货帖摊开平铺三围").toContain("previewFor(slot)!.flatRows");
    expect(view, "验货帖摊开词条全文").toContain("previewFor(slot)!.affixRows");
    expect(view, "验货帖摊开固有与共鸣").toContain("previewFor(slot)!.fixedModsText");
    expect(view, "验货三围有真浏览器落点").toContain("data-market-equipment-flats");
    expect(view, "验货词条有真浏览器落点").toContain("data-market-equipment-affixes");
    expect(view, "验货固有与共鸣有真浏览器落点").toContain("data-market-equipment-notes");
    expect(css, "验货仍沿同一账线，不再套一张卡").toContain(".market-good__inspection");
  });

  it("三册只挂当前一册，隐藏页不把整份货架与赏单留在 DOM", () => {
    const view = source("src/views/MarketView.vue");

    for (const tab of ["shelf", "bounty", "sell"]) {
      expect(view, `${tab} 册按需挂载`).toMatch(
        new RegExp(
          `v-if="marketTab === '${tab}'"[\\s\\S]{0,180}class="market-book"[\\s\\S]{0,220}data-market-book="${tab}"`,
        ),
      );
      expect(view, `${tab} 册要有 tabpanel 语义`).toContain(`id="market-panel-${tab}"`);
      expect(view, `${tab} 册要由当前册口命名`).toContain(`aria-labelledby="market-tab-${tab}"`);
    }
    expect(view.match(/role="tabpanel"/g), "当前只铺一个正文册").toHaveLength(3);
    expect(view, "不再用 v-show 常驻三册").not.toContain('v-show="marketTab ===');
  });

  it("三册正文共用坊市章首，章号、读法、真值与时钟各归其位", () => {
    const view = source("src/views/MarketView.vue");
    const heads = [...view.matchAll(/<LedgerHeader\b[\s\S]*?(?:\/>|<\/LedgerHeader>)/g)].map(
      (match) => match[0],
    );

    expect(view, "旧通用节题已从坊市退场").not.toContain("<SectionTitle");
    expect(view, "旧通用节题 import 也已撤掉").not.toContain(
      'import SectionTitle from "@/components/common/SectionTitle.vue"',
    );
    expect(view, "三册正文各有一枚共享章首").not.toContain("market-book__head");
    expect(heads, "货架、悬赏、售出三章依次续排").toHaveLength(3);
    expect(
      [...view.matchAll(/data-market-book-head="([^"]+)"/g)].map((match) => match[1]),
      "章首运行时落点必须按册序排列",
    ).toEqual(["shelf", "bounty", "sell"]);

    for (const [index, head] of heads.entries()) {
      expect(head, `第 ${index + 1} 章走长账内章首`).toContain('variant="index"');
      expect(head, `第 ${index + 1} 章真值有稳定运行时读数`).toContain(":data-market-book-value=");
      expect(head, `第 ${index + 1} 章总数有稳定运行时读数`).toContain(":data-market-book-total=");
    }

    expect(heads[0], "货架章首直读本架可买与总格").toMatch(
      /eyebrow="第壹册 · 换货"[\s\S]*title="本架货目"[\s\S]*:score-value="marketPulse\.availableGoods"[\s\S]*:score-suffix="`\/ \$\{marketPulse\.goodsTotal\} 件`"/,
    );
    expect(heads[0], "货架章首报真实换货时钟").toContain(
      ':meta="`换货 ${formatCountdown(remainingSec)}`"',
    );
    expect(heads[0], "货架章首与册口读同一份可买真值").toContain(
      ':data-market-book-value="marketPulse.availableGoods"',
    );
    expect(heads[0], "货架章首与册口读同一份总格").toContain(
      ':data-market-book-total="marketPulse.goodsTotal"',
    );

    expect(heads[1], "悬赏章首直读可交与开单").toMatch(
      /eyebrow="第贰册 · 收榜"[\s\S]*title="本期赏单"[\s\S]*:score-value="marketPulse\.claimableBounties"[\s\S]*:score-suffix="`\/ \$\{marketPulse\.openBounties\} 单`"/,
    );
    expect(heads[1], "悬赏章首报真实换榜时钟").toContain(
      "formatCountdown(bountyRemainingSec(bounty.bountyAt, now))",
    );
    expect(heads[1], "悬赏章首与册口读同一份可交真值").toContain(
      ':data-market-book-value="marketPulse.claimableBounties"',
    );
    expect(heads[1], "悬赏章首与册口读同一份开单总数").toContain(
      ':data-market-book-total="marketPulse.openBounties"',
    );
    expect(heads[1], "一键交货仍留在章首动作席").toContain("<template #actions>");

    expect(heads[2], "售出章首直读寄卖占用与机制总格").toMatch(
      /eyebrow="第叁册 · 归账"[\s\S]*title="寄卖与即时柜"[\s\S]*:score-value="marketPulse\.consignCount"[\s\S]*:score-suffix="`\/ \$\{MARKET_CONSIGN_SLOTS\} 格`"/,
    );
    expect(heads[2], "售出章首报最近一件真实归账").toContain(':meta="nextConsign.text"');
    expect(heads[2], "售出章首与册口读同一份寄卖真值").toContain(
      ':data-market-book-value="marketPulse.consignCount"',
    );
    expect(heads[2], "售出章首与册口读同一份机制总格").toContain(
      ':data-market-book-total="MARKET_CONSIGN_SLOTS"',
    );
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

  it("册口总在卷内：手机三摊并读，220 以下退单列；正文只剩账线", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".market-register {");
    const end = css.indexOf("/*\n   * 门庭案", start);
    const marketCss = css.slice(start, end);

    expect(start, "坊市样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "坊市样式段要有明确结尾").toBeGreaterThan(start);
    expect(marketCss).toMatch(
      /\.market-register\s*\{[\s\S]{0,260}border-top: 1px solid[\s\S]{0,180}border-bottom: 1px solid/,
    );
    expect(marketCss).toMatch(
      /\.market-register\s*\{[\s\S]{0,420}border-right: 0;[\s\S]{0,100}border-left: 0;[\s\S]{0,160}background: transparent;[\s\S]{0,100}box-shadow: none;/,
    );
    expect(marketCss).toMatch(
      /\.market-chapter-rail__tabs\s*\{[\s\S]{0,180}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(marketCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.market-goods\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(marketCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.market-sell-grid\s*\{[\s\S]{0,120}minmax\(0, 1\.08fr\)/,
    );
    expect(marketCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.market-good\s*\{[\s\S]{0,100}grid-template-columns:\s*1\.82rem minmax\(0, 1fr\)/,
    );
    expect(marketCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1600}\.market-chapter-rail__tabs\s*\{[\s\S]{0,100}grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(marketCss, "三册共享章首只留一条账线").toMatch(
      /\.market-book\s*>\s*\.folio-ledger-head\s*\{[\s\S]{0,360}padding:\s*0\.66rem 0 0\.52rem;[\s\S]{0,160}border-bottom:\s*1px solid/,
    );
    expect(marketCss, "章内真值仍归石青信息色").toMatch(
      /\.market-book\s*>\s*\.folio-ledger-head\s*\{[\s\S]{0,180}--ledger-accent:\s*var\(--color-qing\)/,
    );
    expect(marketCss, "极窄档章首不再留横向内边").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.market-book\s*>\s*\.folio-ledger-head\s*\{[\s\S]{0,80}padding-inline:\s*0;/,
    );
  });
});
