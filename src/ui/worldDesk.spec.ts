describe("卷首命数:口径收成一注", () => {
  /*
   * 卷首那句「这条命数只参与成形时的难度校准,不改写历练里的战斗」是**口径说明**,
   * 不是读数 —— 此刻的命数由上面那行「此世命数:生机断绝的杂涌之世」报,
   * 所钟由「此地所钟 灵石收益 +15%」报。这一句只解释前者管到哪。
   *
   * 归 FolioNote:默认合着,点开一字不少。与门规、功名墙排序、道躯灵根同一归处。
   *
   * 换界那句「已走的本世路线会清零」**不动** —— 它写在按钮下方是刻意的:
   * setMortalWorld 会清零路线进度,只说价不说会清进度等于让人不知情丢路。
   */
  it("命数口径走共享注原语,换界代价仍留在按钮下", () => {
    const view = readSource("src/views/MortalWorldView.vue");
    expect(view, "口径说明要用共享注原语").toContain(
      'import FolioNote from "@/components/common/FolioNote.vue"',
    );
    expect(view, "命数口径收成一注").toContain('name="world-rule-scope"');
    expect(view, "口径原文保留").toMatch(/只参与成形时的难度校准[，,]/);
    expect(view, "换界代价不许收进注 —— 它必须在按钮下可见").toContain("已走的本世路线会清零");
  });
});

import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { mortalStageStatuses, type PlaceView } from "@/core/mortalWorldService";
import { worldDeskMeter } from "./worldDesk";

const source = readSource;

function places(count: number): PlaceView[] {
  return Array.from({ length: count }, (_, index) => ({
    nodeId: `node-${index}`,
    regionId: `region-${index}`,
    name: ["寒潭", "落霞", "古原", "云关"][index] ?? `地界${index}`,
    terrain: "山地",
    x: index * 20,
    y: 30,
    r: 4,
    eventLevel: 2,
    bossName: `镇守${index}`,
  }));
}

describe("本世山河案 · 卷首山图与路线账同读一份阶段结果", () => {
  it("未行时以首段作眼下，已行两段后报第三程，全通后收成全程已行", () => {
    const route = places(4);

    expect(worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], []))).toMatchObject({
      total: 4,
      cleared: 0,
      remaining: 4,
      ratio: 0,
      currentIndex: 0,
      currentName: "寒潭",
      currentOrdinal: "第 1 程",
      atlasMark: "寒",
    });

    expect(
      worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], ["0", "1"])),
    ).toMatchObject({
      cleared: 2,
      remaining: 2,
      ratio: 0.5,
      currentIndex: 2,
      currentName: "古原",
      currentOrdinal: "第 3 程",
      atlasMark: "古",
    });

    expect(
      worldDeskMeter(route, mortalStageStatuses(["0", "1", "2", "3"], ["0", "1", "2", "3"])),
    ).toMatchObject({
      cleared: 4,
      remaining: 0,
      ratio: 1,
      currentIndex: -1,
      currentName: "全程已行",
      currentOrdinal: "全程已行",
      atlasMark: "山",
    });
  });

  it("阶段结果缺项或空世界时不造负数，也不把空盘当已行", () => {
    const route = places(2);
    expect(worldDeskMeter([], [])).toMatchObject({
      total: 0,
      cleared: 0,
      remaining: 0,
      ratio: 0,
      currentIndex: -1,
      atlasMark: "山",
    });
    expect(worldDeskMeter(route, [{ state: "cleared" }])).toMatchObject({
      total: 2,
      cleared: 1,
      remaining: 1,
      currentIndex: -1,
    });
  });

  it("卷首与山河案头不报同一个「已行」—— 两处各答各的", () => {
    const view = source("src/views/MortalWorldView.vue");

    /*
     * 真浏览器实测(390×844、展品档):「已行」与「0 / 6」在首屏里出现两遍 ——
     *   132px 卷首 meta 的「已行 0 / 6」· 349px 山河行旅案头的总账席「已行 0 / 6」。
     * 两者相距 217px、都在首屏,说的是完完全全同一个读数。
     *
     * 卷首那一份留着:它答「我走到哪了」,是此刻读数(第一类)。
     * 案头改答「还剩多少」—— 站到这一章的正文前,玩家要问的是「还要走几程」,
     * 而不是再读一遍已经走过几程。
     */
    expect(view, "卷首 meta 仍报已行").toMatch(
      /<span>已行<\/span>\s*<strong[^>]*>\{\{ meter\.cleared \}\} \/ \{\{ meter\.total \}\}/,
    );
    expect(view, "案头改报余程,不再复述已行").toContain('score-label="余"');
    expect(view, "余程数量读同一个 meter").toMatch(
      /score-label="余"[\s\S]{0,120}:score-value="meter\.remaining"/,
    );
    expect(view, "案头不再把「已行」同时写进 label").not.toMatch(/score-label="已行"/);
  });

  it("卷首山图、全图、路线账与前尘册各有稳定落点", () => {
    const view = source("src/views/MortalWorldView.vue");
    const atlas = source("src/components/world/WorldAtlas.vue");
    const map = source("src/components/world/MortalRouteMap.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(view).toContain("worldDeskMeter(");
    expect(view).toContain("data-world-desk");
    expect(view).toContain("data-world-current");
    expect(view).toContain("<WorldAtlas");
    expect(view).toContain("<MortalRouteMap");
    expect(view).toContain("data-world-history");
    expect(view).toContain("worldHistoryRows(");
    expect(view).toContain('v-if="canDepart(p.regionId)"');
    expect(view).toMatch(
      /function canDepart\(regionId: string\): boolean \{\s*return canEnterRegion\(regionId\);/,
    );
    expect(atlas).toContain("data-world-atlas");
    expect(atlas).toContain('aria-hidden="true"');
    expect(map).toContain("world-route-map");
    expect(map).not.toContain("card-ink");
    expect(layout).toContain("taskWorldDesk");
    expect(layout).toContain('document.querySelector("[data-world-desk]")');
  });

  it("手机单列、桌面山河与路线并读，200% 缩放档把行尾读数退整行", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 本世山河案");
    const end = css.indexOf("/*\n   * 铸道案", start);
    const worldCss = css.slice(start, end);

    expect(start, "本世山河案样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "本世山河案样式段要有明确结尾").toBeGreaterThan(start);
    expect(worldCss).toMatch(
      /\.world-page \.folio-masthead__book\s*\{[\s\S]{0,80}color:\s*rgb\(var\(--color-ink-soft-rgb\)\)/,
    );
    expect(worldCss).toMatch(
      /\.world-ledger__body\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(worldCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,700}\.world-masthead__brief\s*\{[\s\S]{0,150}grid-template-columns:/,
    );
    expect(worldCss).toMatch(
      /@media \(min-width: 760px\)\s*\{[\s\S]{0,500}\.world-ledger__body\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 0\.88fr\) minmax\(0, 1\.12fr\)/,
    );
    expect(worldCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2600}\.world-history__row\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(worldCss).toMatch(
      /\.world-route-map__legend\s*\{[\s\S]{0,220}color:\s*var\(--color-ink-soft\)/,
    );
    expect(worldCss).toMatch(
      /\.world-masthead__reroll p\s*\{[\s\S]{0,120}color:\s*var\(--color-ink-soft\)/,
    );
    expect(worldCss).toMatch(/\.world-stage__depart\s*\{[\s\S]{0,120}min-width:\s*3rem/);
  });

  it("本世与前尘都收成开口账页，不再套四边卡与第二道内框", () => {
    const css = source("src/style.css");
    const start = css.indexOf("/*\n   * 本世山河案");
    const end = css.indexOf("/*\n   * 铸道案", start);
    const worldCss = css.slice(start, end);

    expect(worldCss).toMatch(
      /\.world-ledger\s*\{[\s\S]{0,520}border:\s*0;[\s\S]{0,420}border-block:\s*1px solid rgb\(var\(--color-ink-rgb\) \/ 0\.11\)/,
    );
    expect(worldCss).toMatch(/\.world-ledger\s*\{[\s\S]{0,680}border-top-color:\s*color-mix\(/);
    expect(worldCss).toMatch(/\.world-ledger\s*\{[\s\S]{0,880}border-radius:\s*0;/);
    expect(worldCss).toMatch(/\.world-ledger\s*\{[\s\S]{0,980}background:\s*transparent;/);
    expect(worldCss).toMatch(/\.world-ledger\s*\{[\s\S]{0,1080}box-shadow:\s*none;/);
    expect(worldCss).not.toContain(".world-ledger::before");
    expect(worldCss).not.toContain(".world-route-map::before");
  });
});
