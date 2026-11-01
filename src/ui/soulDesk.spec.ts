import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("器魂案 · 题签只报道源,三席阵账紧随卷首", () => {
  it("卷首收起同义阵图与重复开炉键,只留题签和道源", () => {
    const view = source("src/views/SoulsView.vue");
    const action = view.slice(view.indexOf("#action"), view.indexOf("<LedgerPulse"));

    expect(view, "器魂卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,260}\bfeatured\b/,
    );
    expect(view, "卷首不再铺与三席账同义的阵图").not.toContain("SoulForgeMap");
    expect(view, "运行时也不该留下旧阵图").not.toContain("data-soul-forge-map");
    expect(action, "道源读数要有独立落点").toContain("data-soul-reserve");
    expect(action, "道源仍读同一份 endgame 数据").toContain("formatNum(endgame.daoSource)");
    expect(action, "炉费仍读机制常量").toContain("SOUL_REFINE_COST");
    expect(action, "卷首不重复承接开炉动作").not.toContain("<button");
    expect(view, "三席阵账要作为器魂续卷的第一章").toMatch(
      /<\/FolioPageHeader>\s*<template v-if="unlocked">[\s\S]{0,900}<article class="soul-register folio-span-all" data-soul-register>[\s\S]{0,500}<LedgerPulse/,
    );
    expect(view, "阵账有独立运行时落点").toContain("data-soul-array");
    expect(view, "器魂章序收在同一张续卷上").toContain('data-soul-chapter="array"');
  });

  it("三席收进此刻总账,下一步按装配、取舍、开炉与回行囊带路", () => {
    const view = source("src/views/SoulsView.vue");
    const markers = view.match(/data-soul-pulse(?![-\\w])/g) ?? [];
    const pulse = view.slice(view.indexOf("data-soul-pulse"), view.indexOf("</LedgerPulse>"));
    const lead = view.slice(
      view.indexOf("const soulLead = computed"),
      view.indexOf("const SOUL_STEPS"),
    );

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/soulOverview 唯一一份").toContain("soulOverview({");
    expect(view, "此刻器魂接共享此刻账").toContain("<LedgerPulse");
    expect(pulse, "先手动作读共享动作键").toContain("folio-ledger-pulse__action");
    expect(pulse, "三席账格由同一份行数据生成").toContain('v-for="row in soulLedgerRows"');
    expect(pulse, "账格由共享组件承担").toContain("<LedgerTally");
    expect(pulse, "器魂账格交三列").toContain(':tally-columns="3"');
    expect(pulse, "精确三席与总账同处一张纸").toContain("data-soul-slots");
    expect(pulse, "三席由同一份 SOUL_SLOTS 生成").toContain('v-for="i in SOUL_SLOTS"');
    expect(pulse, "席位由唯一 soulAt 出口取").toContain("soulAt(i)");
    expect(pulse, "总账带三席运行时落点").toContain("data-soul-pulse-active");
    expect(pulse, "总账带闲置运行时落点").toContain("data-soul-pulse-idle");
    expect(pulse, "总账带可凝运行时落点").toContain("data-soul-pulse-refine");
    expect(pulse, "此刻器魂必须给出一条先手").toContain("soulLead.title");
    expect(lead, "闲置先装配").toContain('case "wear"');
    expect(lead, "三席满先取舍").toContain('case "choose"');
    expect(lead, "有可凝件先开炉").toContain('case "refine"');
    expect(lead, "付不起仍带去看凝炼台").toContain('case "short"');
    expect(lead, "无可凝才回行囊").toContain('case "inventory"');
    expect(view, "先手动作接到真实入口").toMatch(
      /function runSoulLead\(\): void \{[\s\S]{0,220}idleOpen\.value = true[\s\S]{0,220}forgeOpen\.value = true[\s\S]{0,220}router\.push\("\/inventory"\)/,
    );
  });

  it("三席仍由 soulAt 唯一判断,常态三列、195 宽退成一列账行", () => {
    const view = source("src/views/SoulsView.vue");
    const grid = /class="(soul-array__seats[^"]*)"/.exec(view)?.[1];
    const css = source("src/styles/pages/souls.css");

    expect(view, "有无器魂只留一处出口").toContain(
      "function soulAt(i: number): SoulInstance | null",
    );
    expect(view, "空席不再另造一套占位数据").not.toContain("SOUL_SEAT_POSITIONS");
    expect(grid, "三席网格要能定位到").toBeTruthy();
    expect(grid, "列数只由页面样式表决定").not.toMatch(/grid-cols-/);
    expect(css).toMatch(
      /\.soul-array__seats\s*\{[\s\S]{0,260}position:\s*relative;[\s\S]{0,260}grid-template-columns:\s*repeat\(3/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.soul-array__seats\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("两处门径与器魂章法仍完整保留,章法退到卷尾且数字读机制常量", () => {
    const view = source("src/views/SoulsView.vue");

    expect(view, "两处门径是续卷第二章").toContain('data-soul-chapter="gateways"');
    expect(view, "器魂章法是续卷第三章").toContain('data-soul-chapter="principle"');
    expect(view, "两处门径有独立运行时落点").toContain("data-soul-gateways");
    expect(view, "闲置形意仍开同一扇门").toContain('data-soul-gateway="idle"');
    expect(view, "凝炼台仍开同一扇门").toContain('data-soul-gateway="forge"');
    expect(view, "章法保留不可逆代价").toContain("原器即毁");
    expect(view, "章法炉费读机制常量").toContain("SOUL_REFINE_COST");
    expect(view, "章法席数读机制常量").toContain("SOUL_SLOTS");
    expect(view, "章法仍可展开细读").toContain("soulIntroOpen");
  });

  it("手机三章续排,620 起门径并读,960 起门径与章法并读,220 以下退单列", () => {
    const soulCss = source("src/styles/pages/souls.css");

    expect(soulCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,400}\.soul-gateway-grid\s*\{[\s\S]{0,100}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(soulCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,700}\.soul-register\s*\{[\s\S]{0,220}grid-template-areas:\s*"array array"\s*"gateways principle"/,
    );
    expect(soulCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.soul-gateway__arrow\s*\{[\s\S]{0,80}display:\s*none/,
    );
  });

  it("三席、门径与章法同住一张开口续卷,不再逐段套卡", () => {
    const view = source("src/views/SoulsView.vue");
    const css = source("src/styles/pages/souls.css");
    const chapterHead = source("src/components/soul/SoulChapterHead.vue");
    const layout = source("scripts/layout-check.mjs");
    const folio = view.slice(
      view.indexOf('<template v-if="unlocked">'),
      view.indexOf("<!-- 未至真仙"),
    );

    expect(folio, "正文阵谱不再借通用卡片皮").not.toContain("card-ink");
    expect(folio, "整册不再另起自动编号章节头").not.toContain("<SectionTitle");
    expect(folio, "后两章共用同一枚器魂章首").toContain("<SoulChapterHead");
    expect(chapterHead, "章首要能定位到").toContain("data-soul-chapter-head");
    expect(chapterHead, "章首报章号").toContain("{{ index }}");
    expect(chapterHead, "章首报章名").toContain("{{ title }}");
    expect(chapterHead, "章首报章内读法").toContain("{{ hint }}");
    expect(chapterHead, "章首报章内读数").toContain("{{ fact }}");
    expect(layout, "真浏览器门要定位整册").toContain(
      'document.querySelector("[data-soul-register]")',
    );
    expect(layout, "真浏览器门要逐章核对").toContain('querySelectorAll("[data-soul-chapter]")');
    expect(folio, "器魂行要有独立的详情副本层").toContain("soul-seat__copy");
    expect(folio, "空席的读法与动作共用同一行").toContain("soul-seat__empty-copy");
    expect(css, "整册只留上下账线").toMatch(
      /\.soul-register\s*\{[\s\S]{0,420}border-top:\s*1px solid[\s\S]{0,180}border-bottom:\s*1px solid/,
    );
    expect(css, "三章全部退成透明分段").toMatch(
      /\.soul-register__chapter\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,420}background:\s*transparent;[\s\S]{0,420}box-shadow:\s*none;/,
    );
    expect(css, "三席只用上下账线围合").toMatch(
      /\.soul-array__seats\s*\{[\s\S]{0,260}border-block:\s*1px solid/,
    );
    expect(css, "席列不再画第二层卡框").toMatch(
      /\.soul-seat\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,420}border-radius:\s*0;[\s\S]{0,420}box-shadow:\s*none;/,
    );
    expect(css, "三席之间只留账线").toMatch(
      /\.soul-seat \+ \.soul-seat\s*\{[\s\S]{0,120}border-left:\s*1px solid/,
    );
    expect(css, "两处门径是账行而不是两张按钮卡").toMatch(
      /\.soul-gateway\s*\{[\s\S]{0,420}border:\s*0;[\s\S]{0,420}background:\s*transparent;/,
    );
    expect(css, "章法不再另起第二层纸框").toMatch(
      /\.soul-principle__sheet\s*\{[\s\S]{0,320}border:\s*0;[\s\S]{0,320}background:\s*transparent;[\s\S]{0,320}box-shadow:\s*none;/,
    );
    expect(css, "195 宽三席退成一列账行").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.soul-array__seats\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("散置形意与凝炼台浮层只沿卷身续账,不再各套一张纸卡", () => {
    const view = source("src/views/SoulsView.vue");
    const layout = source("scripts/layout-check.mjs");
    const idleStart = view.indexOf("<!-- 散置形意 -->");
    const forgeStart = view.indexOf("<!-- 凝炼台 -->");
    const idle = view.slice(idleStart, forgeStart);
    const forge = view.slice(forgeStart, view.indexOf("</BaseModal>", forgeStart));

    expect(idleStart, "散置形意浮层要能定位到").toBeGreaterThan(-1);
    expect(forgeStart, "凝炼台浮层要能定位到").toBeGreaterThan(idleStart);
    expect(idle, "闲置形意要有稳定运行时落点").toContain("data-soul-idle-ledger");
    expect(forge, "凝炼台要有稳定运行时落点").toContain("data-soul-forge-ledger");
    for (const [name, block] of [
      ["散置形意", idle],
      ["凝炼台", forge],
    ] as const) {
      expect(block, `${name}沿卷身上下账线续排`).toContain("border-y border-ink/10");
      expect(block, `${name}行间只留分段线`).toContain("divide-y divide-ink/10");
      expect(block, `${name}不再借通用纸卡`).not.toContain("card-ink");
    }
    expect(layout, "真浏览器要核器魂两册浮层没有内层卡壳").toContain("data-soul-${key}-ledger");
  });
});
