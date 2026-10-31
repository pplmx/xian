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

  it("择师谱先横读四脉,再以两步定契摊开永久代价", () => {
    const dialog = source("src/components/character/MentorDialog.vue");

    expect(dialog, "四脉共用一张择师谱").toContain("data-mentor-ledger");
    expect(dialog, "永久代价在择签前就要出现").toContain("data-mentor-permanent");
    expect(dialog, "四位师尊仍从同一份候选表展开").toContain('v-for="(m, index) in choices"');
    expect(dialog, "每脉都要有可定位的签位").toContain("data-mentor-choice");
    expect(dialog, "点签只武装待确认项").toContain('@click="armMentor(m.id)"');
    expect(dialog, "点签不得直接写存档").not.toContain('@click="player.adoptMentor');
    expect(dialog, "卷尾确认才有落定动作").toContain('@click="confirmMentor"');
    expect(dialog.match(/player\.adoptMentor\(/g)?.length, "全组件只有确认动作写存档").toBe(1);
    expect(dialog, "取消词沿用全库口径").toContain("再想想");
    expect(dialog, "永久不可改投要在确认前说穿").toContain("不可改投");
    expect(dialog, "词条仍只走 modsPills 同一口径").toContain("modsPills(m.mods)");
  });

  it("择师谱 390 单列横读,195 把签身与印面动作上下收住", () => {
    const dialog = source("src/components/character/MentorDialog.vue");

    expect(dialog, "择师谱要占满浮层可用宽").toContain('size="wide"');
    expect(dialog, "四项签身共用一条比较列").toMatch(
      /\.mentor-choice\s*\{[\s\S]{0,220}grid-template-columns:\s*2\.25rem minmax\(0, 1fr\) auto/,
    );
    expect(dialog, "195 档要有独立收口").toContain("@media (max-width: 220px)");
    expect(dialog, "195 档签身改上下两段").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1200}\.mentor-choice\s*\{[\s\S]{0,120}grid-template-columns:\s*1\.8rem minmax\(0, 1fr\)/,
    );
    expect(dialog, "195 档确认动作竖排").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,2000}\.mentor-oath__actions\s*\{[\s\S]{0,120}flex-direction:\s*column/,
    );
  });

  it("同行帖先摊此刻要答的事,再把关系缺口与历世同行收成一张账", () => {
    const dialog = source("src/components/character/BondDialog.vue");

    expect(dialog, "道侣正文要有一张可定位的同行帖").toContain("data-bond-view");
    expect(dialog, "她自己的提议要逐项预演").toContain("data-bond-intent-choice");
    expect(dialog, "共同事件选项要逐个标出关系代价").toContain("data-bond-event-choice");
    expect(dialog, "事件预览与结算共用同一个纯函数").toContain("previewBondChoice(");
    expect(dialog, "提议预览与结算共用同一张后果表").toContain("respondTo(");
    expect(dialog, "下一阶缺口要摊到界面").toContain("data-bond-next-gate");
    expect(dialog, "缺口数字必须来自 nextGateHint").toContain("gateHint.shortfall");
    expect(dialog, "危险选项要事先说穿永久后果").toContain("preview.perishes");
    expect(dialog, "会离开的选项不能等按下去才说").toContain("preview.leaves");
  });

  it("同行帖 390 单列,195 把选项正文、关系账与回看动作上下收住", () => {
    const dialog = source("src/components/character/BondDialog.vue");

    expect(dialog, "同行帖要占满浮层可用宽").toContain('size="wide"');
    expect(dialog, "620 起人物与三衡并读").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,800}\.bond-detail-grid\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    );
    expect(dialog, "195 档要有独立收口").toContain("@media (max-width: 220px)");
    expect(dialog, "195 档选项动作与读数上下分栏").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1800}\.bond-choice__read\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("往生帖先报门槛与去留,整本账只读轮回结算的同一份继承表", () => {
    const dialog = source("src/components/character/RebirthDialog.vue");

    expect(dialog, "兵解要先落一张可定位的往生帖").toContain("data-rebirth-folio");
    expect(dialog, "门槛与当前差境要在落子前可见").toContain("data-rebirth-gate");
    expect(dialog, "卷首要先摊开此刻要决定的事").toContain("data-rebirth-now");
    expect(dialog, "留、折、散三项要各有真实计数").toContain("data-rebirth-summary");
    expect(dialog, "主要损失不能藏在折叠里").toContain("data-rebirth-critical");
    expect(dialog, "全账仍可展开").toContain("data-rebirth-heritage-toggle");
    expect(dialog, "去留分组只读 core/samsaraAudit").toContain("heritageGroups()");
    expect(dialog, "界面不另抄一份 HERITAGE").not.toContain("HERITAGE.map(");
    expect(dialog, "组名直接使用继承表的中文口径").toContain("group.title");
    expect(dialog, "每条都带结算来源的明细").toContain("row.detail");
    expect(dialog, "不可逆前仍要说清兵解不是直接清档").toContain("兵解不是清档");
    expect(dialog, "门槛缺口由境差现算").toContain("尚差 ${gateGap}");
    expect(dialog, "未达门槛时按钮置灰").toContain(':disabled="!canRebirth"');
    expect(dialog, "置灰动作仍报出金丹门槛").toContain("境方可自行兵解");
    expect(dialog, "功法损失要明说").toContain("功法回一层");
    expect(dialog, "法宝损失要明说").toContain("法宝归尘");
  });

  it("往生帖 390 单列,620 起道果与天赋并读,260 以下门槛与动作上下收住", () => {
    const dialog = source("src/components/character/RebirthDialog.vue");

    expect(dialog, "往生帖要占满浮层可用宽").toContain('size="wide"');
    expect(dialog, "全账仍用独立滚动区").toContain("max-h-64 overflow-y-auto");
    expect(dialog, "全账滚动区仍有底边淡出").toContain("scroll-fade");
    expect(dialog, "620 起道果与天赋并读").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,500}\.rebirth-detail-grid\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1\.06fr\) minmax\(0, 0\.94fr\)/,
    );
    expect(dialog, "260 以下门槛另起一行").toMatch(
      /@media \(max-width: 260px\)[\s\S]{0,500}\.rebirth-head__gate\s*\{[\s\S]{0,100}grid-column:\s*2/,
    );
    expect(dialog, "260 以下留折散退单列").toMatch(
      /@media \(max-width: 260px\)[\s\S]{0,1000}\.rebirth-balance\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "260 以下动作退整行").toMatch(
      /@media \(max-width: 260px\)[\s\S]{0,1500}\.rebirth-actions\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "260 以下去留行把状态移到名称下一行").toMatch(
      /@media \(max-width: 260px\)[\s\S]{0,1600}\.rebirth-ledger-row\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\) 1rem/,
    );
  });
});
