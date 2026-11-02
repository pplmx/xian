import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

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
    const desk = source("src/ui/characterDesk.ts");

    expect(view, "加成账要有稳定落点").toContain("data-character-modifiers");
    expect(view, "行藏四组仍读 finalStats.mods 与 breakdown").toContain(
      "characterModifierDesk(stats.value.mods, stats.value.breakdown)",
    );
    expect(desk, "逐项加成仍读 finalStats.mods").toContain("modOf(mods, key)");
    expect(desk, "软上限仍读统一判定").toContain("isSoftCapped(mods, key)");
    expect(view, "来源明细仍逐项展开").toContain('@select="toggleBreakdown"');
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

    expect(view, "卷末目录只起一章").toContain('data-character-chapter="catalog"');
    expect(view, "卷末章首读同一份三章装配").toContain(':title="catalogChapter.title"');
    expect(view, "目录要收进同一张跨栏纸面").toContain("data-character-afterword");
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

  it("手机总案与目录单列,720 起总案与行藏并读,桌面上三组目录并排", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".character-dossier {");
    const end = css.indexOf("/*\n * 分段选择(.ink-choice)", start);
    const characterCss = css.slice(start, end);

    expect(start, "道躯样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "道躯样式段要有明确结尾").toBeGreaterThan(start);
    expect(characterCss).toMatch(
      /\.character-dossier__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(characterCss).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]{0,1200}\.character-dossier__grid\s*\{[\s\S]{0,120}minmax\(0, 1\.08fr\) minmax\(0, 0\.92fr\)/,
    );
    expect(characterCss).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]{0,240}\.character-modifier-groups\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
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

  it("修行画像收成一册两章小传,根因、机缘、灵兽与行迹三数全部现读", () => {
    const dialog = source("src/components/character/IdentityDialog.vue");

    expect(dialog, "画像要占满浮层可用宽").toContain('size="wide"');
    expect(dialog, "画像正文要有稳定落点").toContain("data-identity-folio");
    expect(dialog, "两章共用人物册章首").toContain(
      'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
    );
    expect(dialog.match(/<FolioChapterHead/g)?.length, "根因与行迹各成一章").toBe(2);
    expect(dialog, "根因章要有稳定落点").toContain('data-identity-chapter="roots"');
    expect(dialog, "行迹章要有稳定落点").toContain('data-identity-chapter="traits"');
    expect(dialog, "四项目录由同一份行数据生成").toContain('v-for="row in identityRoots"');
    expect(dialog, "机缘名与来由都读 core 的同一份根因").toContain(
      'v-for="(fortune, index) in identity.roots.fortunes"',
    );
    expect(dialog, "机缘要摊开事件原文").toContain("{{ fortune.line }}");
    expect(dialog, "相伴灵兽不再只写随行").toContain("data-identity-pet");
    expect(dialog, "灵兽名读 core").toContain("identity.roots.pet.name");
    expect(dialog, "灵兽性格读 core").toContain("identity.roots.pet.personalityName");
    expect(dialog, "行迹三数各读同一份 counters").toContain(
      "const counters = identity.value?.traits.counters",
    );
    expect(dialog).toContain("formatNum(counters?.kills");
    expect(dialog).toContain("formatNum(counters?.explores");
    expect(dialog).toContain("formatNum(counters?.breakthroughs");
    expect(dialog, "风险判词读同一份 riskBias").toContain(
      "const risk = identity.value?.traits.riskBias",
    );
    expect(dialog, "画像只作描述,要把无加成说穿").toContain("不提供数值加成");
    expect(dialog, "画像里不再另手抄机缘名").not.toContain("剑痕悟道");
    expect(dialog, "画像里不再叠内层纸卡").not.toContain("card-ink");
  });

  it("修行画像 390 单列,220 以下根因值、灵兽与三数都退成上下段", () => {
    const dialog = source("src/components/character/IdentityDialog.vue");

    expect(dialog, "根因账默认单列").toMatch(
      /\.identity-roots\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "行迹默认三数并读").toMatch(
      /\.identity-traits\s*\{[\s\S]{0,140}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(dialog, "220 以下行迹退单列").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,900}\.identity-traits\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "220 以下根因值落到标签下一行").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1200}\.identity-root\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "220 以下灵兽身份上下收住").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1600}\.identity-pet__head\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "章与章之间只留续卷账线").toMatch(
      /\.identity-chapter \+ \.identity-chapter\s*\{[\s\S]{0,100}border-top:\s*1px solid/,
    );
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

  it("往生帖四章续在同一账线,不在浮层里再叠内层纸卡", () => {
    const dialog = source("src/components/character/RebirthDialog.vue");

    expect(dialog, "往生帖四章共用人物册的同一枚章首").toContain("<FolioChapterHead");
    expect(
      dialog.match(/<FolioChapterHead/g)?.length ?? 0,
      "此刻、随魂、交割与最后一笔各成一章",
    ).toBeGreaterThanOrEqual(4);
    expect(dialog, "四章由同一条账线分段").toContain('class="rebirth-chapter');
    expect(dialog, "内层面板不再画四边框").not.toContain("border: 1px solid var(--rebirth-line)");
    expect(dialog, "内层面板不再铺第二张纸底").not.toContain("background: var(--rebirth-paper)");
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

  it("往生三程先辞世再回照,末程才摊落子与不可撤回", () => {
    const dialog = source("src/components/character/ReincarnationDialog.vue");
    const rail = source("src/components/character/ReincarnationStageRail.vue");

    expect(dialog, "三扇窗共用同一枚往生三程路签").toContain("<ReincarnationStageRail");
    expect(rail, "三程路签要有稳定落点").toContain("data-reincarnation-stage-rail");
    expect(dialog, "三程要各有稳定落点").toContain('data-reincarnation-stage="death"');
    expect(dialog).toContain('data-reincarnation-stage="review"');
    expect(dialog).toContain('data-reincarnation-stage="choice"');
    expect(rail, "三程名与状态只读同一份装配").toContain("REINCARNATION_STAGES");
    expect(rail, "每程当前态也要有可量测的稳定标记").toContain("data-reincarnation-stage-state");
    expect(dialog, "辞世屏要说明尚未落子").toContain("尚未写入轮回");
    expect(dialog, "回照屏去留账只读同一份继承表").toContain("samsaraLedger(");
    expect(dialog, "回照屏仍可展开 36 项全账").toContain("data-reincarnation-heritage-toggle");
    expect(dialog, "全账展开态要报给读屏").toContain(':aria-expanded="heritageOpen"');
    expect(dialog, "择生屏先把不可撤回写在落子旁").toContain("不可撤回");
    expect(dialog, "留白道号要按核心契约沿用旧号").toContain("留白不填，便沿用旧号");
    expect(dialog, "不许把留白写成核心并未实现的无名散修").not.toContain("便以「无名散修」入卷");
    expect(dialog, "先天之姿未择时主按钮置灰").toContain(':disabled="confirmGate.disabled"');
    expect(dialog, "置灰原因要直接来自同一份 confirmGate").toContain("confirmGate.short");
    expect(dialog, "踏入轮回仍是唯一最终落子动作").toContain("data-reincarnation-confirm");
  });

  it("往生录三程续在同一册章首,内层不再叠纸卡", () => {
    const dialog = source("src/components/character/ReincarnationDialog.vue");
    const rail = source("src/components/character/ReincarnationStageRail.vue");

    expect(dialog, "三程正文共用人物册章首").toContain(
      'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
    );
    expect(
      dialog.match(/<FolioChapterHead/g)?.length ?? 0,
      "辞世一叙、回照三叙与择生诸章都要各成章",
    ).toBeGreaterThanOrEqual(9);
    expect(dialog, "每章沿同一条开口账线续排").toContain('class="reincarnation-chapter');
    expect(dialog, "旧内层纸卡退场").not.toContain('class="reincarnation-sheet');
    expect(dialog, "不再另存一份纸底变量").not.toContain("--reincarnation-paper");
    expect(dialog, "择姿与立题改成可选账行").toMatch(
      /\.reincarnation-talent-choice,[\s\S]{0,220}border:\s*0;/,
    );
    expect(rail, "三程路签只留上下账线").toMatch(
      /\.reincarnation-stages\s*\{[\s\S]{0,220}border-block:/,
    );
  });

  it("人物册章首自带版式,转世浮层不靠人物页异步样式才成栅格", () => {
    const head = source("src/components/common/FolioChapterHead.vue");

    expect(head, "章首组件要自带样式").toContain("<style scoped>");
    expect(head, "章首要自己声明三栏栅格").toMatch(
      /\.folio-chapter-head\s*\{[\s\S]{0,260}display:\s*grid;[\s\S]{0,260}grid-template-columns:\s*1\.45rem minmax\(0, 1fr\) minmax\(6\.5rem, auto\)/,
    );
    expect(head, "200% 缩放档仍由组件自己收口").toMatch(
      /@media \(max-width: 520px\)[\s\S]{0,500}\.folio-chapter-head\s*\{[\s\S]{0,120}grid-template-columns:\s*1\.35rem minmax\(0, 1fr\)/,
    );
    expect(head, "未注入主题变量时章号仍落朱砂").toContain(
      "var(--folio-chapter-accent, var(--color-cinnabar))",
    );
    expect(source("src/components/character/ReincarnationDialog.vue")).toContain(
      "--folio-chapter-accent: var(--character-accent)",
    );
  });

  it("往生三程手机单列,620 起回照两账并读,220 以下路签与动作收成上下段", () => {
    const dialog = source("src/components/character/ReincarnationDialog.vue");
    const rail = source("src/components/character/ReincarnationStageRail.vue");

    expect(dialog, "往生三程要占满浮层可用宽").toContain('size="wide"');
    expect(dialog, "620 起回照两账并读").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,700}\.reincarnation-review__grid\s*\{[\s\S]{0,140}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(dialog, "620 起双账里的章首先保题名宽度,真值落到下一行").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,900}\.reincarnation-review__grid > \.reincarnation-chapter > \.folio-chapter-head\s*\{[\s\S]{0,160}grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    );
    expect(rail, "220 以下路签收成竖排").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1600}\.reincarnation-stages\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "220 以下末程动作上下收住").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,2200}\.reincarnation-actions\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "手机页脚默认就收成一列").toMatch(
      /\.reincarnation-actions\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dialog, "620 起页脚才让说明与动作并读").toMatch(
      /@media \(min-width: 620px\)[\s\S]{0,220}\.reincarnation-actions\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\) auto/,
    );
    expect(dialog, "主按钮里的动作名与说明上下分栏").toMatch(
      /\.reincarnation-actions__button\s*\{[\s\S]{0,140}display:\s*grid/,
    );
  });
});
