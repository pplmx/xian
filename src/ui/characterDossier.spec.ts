import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("道躯案 · 命盘先立意象,总案再摊开战力与灵根", () => {
  it("卷首命盘读同一份三围占比与灵根,不把视觉摘要重复进读屏", () => {
    const view = source("src/views/CharacterView.vue");
    const sigil = source("src/components/character/CharacterSigil.vue");

    expect(view, "道躯卷首要挂命盘").toMatch(/<template #visual>[\s\S]{0,180}<CharacterSigil/);
    expect(view, "命盘分段必须读战力同一份现算结果").toContain(':segments="powerSegments"');
    expect(view, "命盘灵根必须读存档里的真实根骨").toContain(
      ':roots="player.linggen?.roots ?? []"',
    );
    expect(view, "命盘倍率与页面灵根同源").toContain(
      ':growth-mult="player.linggen?.growthMult ?? 1"',
    );
    expect(sigil, "命盘外圈按三项占比分段").toContain(':stroke-dasharray="`${arc.length}');
    expect(sigil, "命盘最多画五系灵根").toContain("ROOT_ANGLES.length");
    expect(sigil, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
  });

  it("战力、三围原值、引擎权重与占比收在同一行账,不再另起重复三围卡", () => {
    const view = source("src/views/CharacterView.vue");
    const dossier =
      view.match(
        /<div class="character-dossier"[\s\S]*?data-character-roots[\s\S]*?<\/section>/,
      )?.[0] ?? "";

    expect(view, "总案要有稳定落点").toContain("data-character-dossier");
    expect(dossier, "战力主值仍由最终属性现算").toContain(
      '<TapNumber :value="stats.power" title="战力" :rows="powerDetailRows"',
    );
    expect(dossier, "三围原值逐项保留").toContain(':value="row.value"');
    expect(dossier, "权重直接印在行内").toContain("×{{ row.weightText }}");
    expect(dossier, "占战力比直接印在行内").toContain("formatPercent(row.share, 0)");
    expect(dossier, "灵根名号、资质与倍率留在同一案").toContain("player.linggen?.gradeName");
    expect(view, "旧的根本属性三格主位已撤").not.toContain('<SectionTitle title="根本属性"');
    expect(view, "旧的三枚裸读数按钮已撤").not.toContain('title="攻击"');
  });

  it("行藏加成继续读引擎合并结果,点开来源、软上限与边界仍可解释", () => {
    const view = source("src/views/CharacterView.vue");

    expect(view, "加成账要有稳定落点").toContain("data-character-modifiers");
    expect(view, "逐项加成仍读 finalStats.mods").toContain("modOf(stats.value.mods, k)");
    expect(view, "软上限仍读统一判定").toContain("isSoftCapped(stats.value.mods, k)");
    expect(view, "来源明细仍逐项展开").toContain('@click="toggleBreakdown(row.key)"');
    expect(view, "明细仍读 finalStats.breakdown").toContain("stats.value.breakdown");
    expect(view, "递减说明仍读常数表").toContain("DIMINISH_WEIGHTS");
    expect(view, "进阶成功率边界仍保留").toContain("进阶成功率只作用于小进阶");
    expect(view, "护盾上限边界仍保留").toContain("SHIELD_CAP_RATIO");
  });

  it("九处去向收成一页卷末目录,三组同席而非三张长卡", () => {
    const view = source("src/views/CharacterView.vue");
    const wayAt = view.indexOf('data-character-index="way"');
    const bondAt = view.indexOf('data-character-index="bond"');
    const recordAt = view.indexOf('data-character-index="record"');

    expect(view, "卷末目录只起一章").toContain(
      '<SectionTitle title="卷末目录" hint="道途、缘法、行迹,九处去向一页可寻" />',
    );
    expect(view, "目录要收进同一张跨栏纸面").toContain(
      '<section class="character-afterword folio-span-all" data-character-afterword>',
    );
    expect(view, "三组共用一个目录网格").toContain(
      '<div class="character-catalog" data-character-catalog>',
    );
    expect((view.match(/data-character-index=/g) ?? []).length, "卷末仍只分三组").toBe(3);
    expect((view.match(/<CharacterIndexRow/g) ?? []).length, "九行册目一项不少").toBe(9);
    expect(wayAt, "道途组要有稳定落点").toBeGreaterThan(-1);
    expect(bondAt, "缘法组要排在道途之后").toBeGreaterThan(wayAt);
    expect(recordAt, "行迹组要排在缘法之后").toBeGreaterThan(bondAt);
    expect(view, "旧的三段章节头不再各起一页").not.toContain('<SectionTitle title="道途"');
    expect(view, "旧的三段章节头不再各起一页").not.toContain('<SectionTitle title="缘法"');
    expect(view, "旧的三段章节头不再各起一页").not.toContain('<SectionTitle title="行迹"');
    expect(view, "册目读取同一份流派识别").toContain("build?.displayName");
    expect(view, "画像仍开原弹窗").toContain('@click="identityOpen = true"');
    expect(view, "师承仍开原弹窗").toContain('@click="mentorDialog = true"');
    expect(view, "道侣仍保留有话说提醒").toContain(":badge=\"hasBondWord ? '有话说' : ''\"");
    expect(view, "卦在身提醒仍在界域志行").toContain(":badge=\"divinationOn ? '卦在身' : ''\"");
    expect(view, "轮回仍开原弹窗").toContain('@click="rebirthOpen = true"');
    expect(view, "旧同形入口卡不再参与道躯页").not.toContain("<NavCard");
  });

  it("手机总案与目录单列,720 起总案并读,桌面上三组目录并排", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".character-dossier {");
    const end = css.indexOf("/*\n * 开关(.toggle-ink)", start);
    const characterCss = css.slice(start, end);

    expect(start, "道躯样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "道躯样式段要有明确结尾").toBeGreaterThan(start);
    expect(characterCss).toMatch(
      /\.character-dossier__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(characterCss).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]{0,180}\.character-dossier__grid\s*\{[\s\S]{0,120}minmax\(0, 1\.08fr\) minmax\(0, 0\.92fr\)/,
    );
    expect(characterCss).toMatch(
      /\.character-catalog\s*\{[\s\S]{0,220}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(characterCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,220}\.character-catalog\s*\{[\s\S]{0,120}repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(characterCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,2200}\.character-index__head\s*\{[\s\S]{0,120}flex-direction:\s*column/,
    );
  });
});
