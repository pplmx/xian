import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("门庭案 · 先落一令,再核四门存底与值日簿", () => {
  it("卷首门庭图读真实候差与在途位置,整图不重复进入读屏", () => {
    const view = source("src/views/ApprenticeView.vue");
    const court = source("src/components/apprentice/ApprenticeCourt.vue");

    expect(view, "门庭卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,180}\bfeatured\b/,
    );
    expect(view, "门庭图要进独立主视觉槽").toMatch(
      /<template #visual>[\s\S]{0,180}<ApprenticeCourt/,
    );
    expect(view, "图上门位从值日簿同一份顺序现算").toContain("roster.value.map");
    expect(view, "在途门位的进度读差事纯函数").toContain(
      "apprenticeTaskProgress(a.task, now.value) * 100",
    );
    expect(court, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
    expect(court, "空席只按真实槽位补齐").toContain(
      "SLOT_POSITIONS.slice(props.nodes.length, props.slots)",
    );
  });

  it("今日门庭先发案头调拨令,再铺候差、在途与最近归期", () => {
    const view = source("src/views/ApprenticeView.vue");
    const markers = view.match(/data-apprentice-pulse(?![-\\w])/g) ?? [];
    const pulseStart = view.indexOf("data-apprentice-pulse");
    const pulse = view.slice(
      pulseStart,
      view.indexOf('data-apprentice-chapter="roster"', pulseStart),
    );
    const orderStart = pulse.indexOf("data-apprentice-order");
    const depotStart = pulse.indexOf("data-apprentice-depot");

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "门庭总账接共享此刻账").toContain(
      'import LedgerPulse from "@/components/common/LedgerPulse.vue"',
    );
    expect(view, "门庭读数接共享账格").toContain(
      'import LedgerTally from "@/components/common/LedgerTally.vue"',
    );
    expect(view, "首章章首由门庭专用组件接管").toContain(
      'import ApprenticeChapterHead from "@/components/apprentice/ApprenticeChapterHead.vue"',
    );
    expect(view, "共享此刻账只留正文账格").toMatch(/<LedgerPulse\b[\s\S]{0,100}\bheadless\b/);
    expect(view, "门庭不再手搭账首").not.toContain(
      'import LedgerHeader from "@/components/common/LedgerHeader.vue"',
    );
    expect(pulse, "三格都由同一份行数据生成").toContain('v-for="row in apprenticeLedgerRows"');
    expect(pulse, "静态读数不落成按钮").toContain(':interactive="false"');
    expect(view, "汇总走 service 唯一一份").toContain("apprenticeOverview(appr.apprentices)");
    expect(view, "总账带总数").toContain(':data-apprentice-total="pulse.total"');
    expect(view, "总账带候差数").toContain(':data-apprentice-idle="pulse.idle"');
    expect(view, "总账带在途数").toContain(':data-apprentice-away="pulse.away"');
    expect(view, "最近归期读同一条汇总").toContain("pulse.value.nextReturnAt");
    expect(view, "最近归期文案必须带真实差事名").toContain("taskDef(spec).name");
    expect(view, "一键派发仍读汇总里的候差数").toContain("pulse.value.idle");
    expect(pulse.match(/<button/g), "总账里的第一枚按钮必须是一键派发").toHaveLength(1);
    expect(orderStart, "案头调拨令必须落在总账里").toBeGreaterThan(-1);
    expect(orderStart, "调拨令要排在四门存底之前,先给行动再给依据").toBeLessThan(depotStart);
    expect(pulse, "派发动作要有独立的案头令位").toContain("apprentice-order__issue");
    expect(pulse, "案头令先报会派走几人、去哪个门").toContain("dispatchOrderTitle");
    expect(pulse, "案头令的择门依据仍从同一份计划行现算").toContain("dispatchOrderNote");
    expect(pulse, "极窄档保留短标题,完整语义交给 aria-label").toContain("dispatchOrderShortTitle");
    expect(view, "短标题仍由同一枚派发文案压缩").toContain("dispatchShortLabel");
    expect(pulse, "无人在家时读屏动作换口").toContain(':aria-label="hasIdle ? dispatchLabel');
    expect(view, "无人在家时可见标题与动作都换口").toContain(
      'return hasIdle.value ? dispatchLabel.value : "弟子都在路上";',
    );
    expect(pulse, "旧版全宽朱砂横条退场").not.toContain("apprentice-pulse__dispatch");
    expect(pulse, "门庭总账不再手搓账格骨架").not.toContain('class="apprentice-pulse__tallies"');
  });

  it("今日门庭、值日簿与门规同住一张开口续卷", () => {
    const view = source("src/views/ApprenticeView.vue");
    const start = view.indexOf('<article class="apprentice-register folio-span-all"');
    const register = view.slice(start, view.lastIndexOf("</article>") + "</article>".length);

    expect(start, "门庭正文要收进同一册").toBeGreaterThan(-1);
    expect(register, "今日门庭是续卷第一章,先落一令再摊账格").toMatch(
      /data-apprentice-chapter="pulse"[\s\S]{0,620}<ApprenticeChapterHead[\s\S]{0,700}data-apprentice-order[\s\S]{0,1500}<LedgerPulse/,
    );
    expect(register, "值日簿紧随总账续排").toMatch(
      /data-apprentice-chapter="roster"[\s\S]{0,320}<ApprenticeChapterHead[\s\S]{0,220}title="值日簿"/,
    );
    expect(register, "门规是同一册的末章").toMatch(
      /data-apprentice-chapter="rules"[\s\S]{0,320}<ApprenticeChapterHead[\s\S]{0,220}title="门规"/,
    );
    expect(register.match(/data-apprentice-chapter=/g), "续卷只列三章").toHaveLength(3);
  });

  it("门庭三章共用专用章首,章号、读法与章内真值各归其位", () => {
    const view = source("src/views/ApprenticeView.vue");
    const head = source("src/components/apprentice/ApprenticeChapterHead.vue");
    const apprenticeCss = source("src/styles/pages/apprentice.css");

    expect(view, "旧通用节题退场").not.toContain("<SectionTitle");
    expect(view.match(/<ApprenticeChapterHead\b/g), "三章各用一枚门庭章首").toHaveLength(3);
    expect(view).toContain('index="壹"');
    expect(view).toContain('index="贰"');
    expect(view).toContain('index="叁"');
    expect(view).toContain('eyebrow="今日门庭"');
    expect(view, "值日簿真值仍读同一份 roster").toContain(':fact="`${roster.length} 名弟子`"');
    expect(view, "门规真值仍读机制常量").toContain(
      ':fact="`${slots} 席 · ${APPRENTICE_MAX_LEVEL} 级封顶`"',
    );
    expect(head).toContain("data-apprentice-chapter-head");
    expect(head).toContain("apprentice-chapter-head__index");
    expect(head).toContain("apprentice-chapter-head__eyebrow");
    expect(head).toContain("apprentice-chapter-head__hint");
    expect(head).toContain("apprentice-chapter-head__fact");
    expect(apprenticeCss).toMatch(
      /\.apprentice-chapter-head\s*\{[\s\S]{0,260}grid-template-columns:\s*1\.45rem minmax\(0, 1fr\) auto/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.apprentice-chapter-head\s*\{[\s\S]{0,100}grid-template-columns:\s*1\.35rem minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.apprentice-chapter-head__fact\s*\{[\s\S]{0,160}grid-column:\s*2/,
    );
  });

  it("四门存底摊开调度依据,目标与同分都从 core 同一份方案来", () => {
    const view = source("src/views/ApprenticeView.vue");
    const pulseStart = view.indexOf("data-apprentice-pulse");
    const pulse = view.slice(
      pulseStart,
      view.indexOf('data-apprentice-chapter="roster"', pulseStart),
    );

    expect(view, "调度案只走 core 的唯一一份计划").toContain(
      "apprenticeDispatchPlan(dispatchStock.value)",
    );
    expect(view, "页面不另算目标门").not.toContain("needTargetDoor(");
    expect(view, "四门读数由计划行现算").toContain('v-for="row in dispatchNeedRows"');
    expect(pulse, "四门存底落在总账内").toContain("data-apprentice-depot");
    expect(pulse, "每门都有稳定运行时落点").toContain(':data-apprentice-need="row.spec"');
    expect(pulse, "唯一目标与并列态分开报").toContain(
      ":data-dispatch-target=\"dispatchPlan.target === row.spec ? '' : undefined\"",
    );
    expect(pulse, "同分门也要可见").toContain(":data-dispatch-tied=\"row.tied ? '' : undefined\"");
    expect(pulse, "数值直接读计划行").toContain("{{ row.stock }}");
    expect(pulse, "水位直接读计划行").toContain("{{ row.waterline }}");
    expect(pulse, "灵石兜底不伪装成器尘库存").toContain("row.resource === null");
    expect(pulse, "寻机缘为何不参与自动调拨要说清").toContain("寻机缘不参与自动调拨");
  });

  it("案头令把目标原因、库存水位与无人在途两种状态都摊开", () => {
    const view = source("src/views/ApprenticeView.vue");
    const css = source("src/styles/pages/apprentice.css");

    expect(view, "单门胜出时,令面要报该门真实库存与水位").toMatch(
      /const dispatchOrderNote = computed\([\s\S]{0,1200}?row\.stock[\s\S]{0,300}?row\.waterline/,
    );
    expect(view, "灵石兜底门不许伪装成有库存的仓门").toContain(
      'row.resource === null ? "灵石兜底"',
    );
    expect(view, "兜底门的令面文案从资源类型分支现算").toMatch(
      /if \(row\.resource === null\) \{[\s\S]{0,120}?走灵石兜底/,
    );
    expect(view, "全员在途时改报最近归期,不硬凑派发计划").toMatch(
      /if \(!hasIdle\.value\) return `最近归来[\s\S]{0,120}?nextReturnText\.value/,
    );
    expect(view, "一键派发仍只问 store 的 dispatchAllToNeed").toContain("appr.dispatchAllToNeed");
    expect(css, "案头令自身是一条横向命令,不是红色大卡").toMatch(
      /\.apprentice-order\s*\{[\s\S]{0,500}?grid-template-columns:\s*1\.8rem minmax\(0, 1fr\) auto/,
    );
    expect(css, "动作签按内容收窄,桌面不许拉满整页").toMatch(
      /\.apprentice-order__issue\s*\{[\s\S]{0,320}?(?:width:\s*auto|min-width:)[\s\S]{0,120}?min-height:\s*44px/,
    );
    expect(source("scripts/layout-check.mjs"), "真浏览器门要量首屏可见与先令后底").toContain(
      "actionInFold",
    );
    expect(source("scripts/layout-check.mjs"), "桌面动作签要按案宽限权").toContain(
      "wide.actionRect.width > wide.registerWidth * 0.3",
    );
  });

  it("四门存底沿续卷账线摊开,不再在总账里另套一张四边表", () => {
    const css = source("src/styles/pages/apprentice.css");
    const layout = source("scripts/layout-check.mjs");
    const rows = css.match(/\.apprentice-depot__rows\s*\{[\s\S]*?\}/)?.[0] ?? "";
    const row = css.match(/\.apprentice-depot__row\s*\{[\s\S]*?\}/)?.[0] ?? "";
    const target = css.match(/\.apprentice-depot__row\.is-target\s*\{[\s\S]*?\}/)?.[0] ?? "";

    expect(rows, "四门只留上下账线").toMatch(/border:\s*0;/);
    expect(rows, "四门仍由上下账线收束").toMatch(/border-block:\s*1px solid/);
    expect(rows, "四门不另铺实底").toContain("background: transparent;");
    expect(row, "每门退回透明账行").toContain("border: 0;");
    expect(row, "每门不另铺纸底").toContain("background: transparent;");
    expect(target, "目标门只留朱砂左笔").toMatch(/inset 2px 0 0/);
    expect(target, "目标门不再补第二道四边内框").not.toContain("inset 0 0 0 1px");
    expect(layout, "真浏览器要核四门存底不是四边表").toMatch(/depot:\s*chrome\(depot\)/);
  });

  it("值日簿候差在前、在途按归期续列,身份与羁绊都从数据源现读", () => {
    const view = source("src/views/ApprenticeView.vue");

    expect(view, "值日簿顺序只在 service 排一次").toContain("apprenticeRoster(appr.apprentices)");
    expect(view, "候差组接同一份顺序").toContain("rows: idleRows.value");
    expect(view, "在途组接同一份顺序").toContain("rows: awayRows.value");
    expect(view, "组头分别报候差与在途").toContain('title: "候差"');
    expect(view, "组头分别报候差与在途").toContain('title: "在途"');
    expect(view, "身份行有稳定运行时落点").toContain(':data-apprentice-row="a.uid"');
    expect(view, "行状态由同一份 away 判据给出").toContain(
      ":data-apprentice-status=\"away ? 'away' : 'idle'\"",
    );
    expect(view, "品阶只给文字名").toContain("qualityText(a)");
    expect(view, "品阶不再另取强色").not.toContain("qualityDef(q).color");
    expect(view, "本命门类从弟子数据读取").toContain("function talentOf(");
    expect(view, "羁绊称谓读同一条梯").toContain("bondTitle(a.bond)");
    expect(view, "距下一档仍读同一条阈值").toContain("bondNext(a.bond)");
    expect(view, "羁绊进度有独立读数,不抢任务进度条语义").toContain(
      ':data-apprentice-bond-progress="bondProgress(a)"',
    );
    expect(view, "羁绊轨道只是视觉").toContain(
      'class="apprentice-roster__bond-track" aria-hidden="true"',
    );
  });

  it("在途行只报一条真实任务进度,候差行先选签再确认遣往", () => {
    const view = source("src/views/ApprenticeView.vue");

    expect(view, "任务进度只挂在在途行").toContain(
      ':data-apprentice-task-progress="away ? taskProgress(a) : undefined"',
    );
    expect(view, "在途内容先确认真有任务").toContain('v-if="away && a.task"');
    expect(view, "任务进度走纯函数").toContain("taskProgress(a)");
    expect(view, "任务进度条保留读屏语义").toContain('role="progressbar"');
    expect(view, "归来预览按出发时境界结算").toContain(
      "taskYield(a, a.task.spec, a.task.rewardMajor ?? player.major)",
    );
    expect(view, "差事签先选中,不第一下就锁人").toContain('@click="selectTask(a.uid, t.spec)"');
    expect(view, "展开态报给读屏").toContain(':aria-expanded="isTaskOpen(a.uid, t.spec)"');
    expect(view, "选中态要指向详情案").toContain(
      ':aria-controls="`apprentice-task-ticket-${a.uid}`"',
    );
    expect(view, "确认动作单独落成一枚按钮").toContain('@click="dispatchSelected(a)"');
    expect(view, "确认前不暗派").toMatch(/function selectTask\([\s\S]{0,260}taskTap\.value =/);
    expect(view, "任务详情直出说明").toContain("selectedTask.def.desc");
    expect(view, "任务详情直出真实所得").toContain("taskYield(a, selectedTask.spec)");
    expect(view, "锁定时长也现身").toContain("apprenticeTaskSeconds(pick.spec)");
    expect(view, "票面时长由同一枚差事常数换算").toContain("selectedTask.minutes");
  });

  it("门规只读机制常量,收徒价与天赋、等级、真传门槛不另写一遍", () => {
    const view = source("src/views/ApprenticeView.vue");

    expect(view, "收徒价仍走 service 唯一实现").toContain("apprenticeRecruitCost");
    expect(view, "天赋倍率读常量").toContain("APPRENTICE_TALENT_BONUS");
    expect(view, "等级封顶读常量").toContain("APPRENTICE_MAX_LEVEL");
    expect(view, "真传门槛读常量").toContain("BOND_TRUECODE_MIN");
    expect(view, "真传跨世收益在达成前也要露").toContain("抵达「真传」");
    expect(view, "不许手抄天赋倍率").not.toContain("×1.25");
  });

  it("手机两格并读、最近归来跨行,960 把值日簿与门规摊成两页,220 以下退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".apprentice-register {");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const apprenticeCss = css.slice(start, end);

    expect(start, "门庭样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "门庭样式段要有明确结尾").toBeGreaterThan(start);
    expect(apprenticeCss, "续卷只留上下账线").toMatch(
      /\.apprentice-register\s*\{[\s\S]{0,300}border-top: 1px solid[\s\S]{0,180}border-bottom: 1px solid/,
    );
    expect(apprenticeCss, "续卷不套四边卡与投影").toMatch(
      /\.apprentice-register\s*\{[\s\S]{0,420}background: transparent;[\s\S]{0,100}box-shadow: none;/,
    );
    expect(apprenticeCss, "三章由同一组章间线续排").toMatch(
      /\.apprentice-register__chapter \+ \.apprentice-register__chapter\s*\{[\s\S]{0,100}border-top: 1px solid/,
    );
    expect(apprenticeCss, "值日簿撤掉独立卡壳").toMatch(
      /\.apprentice-roster\s*\{[\s\S]{0,260}border: 0;[\s\S]{0,100}background: transparent;[\s\S]{0,100}box-shadow: none;/,
    );
    const rulesRule = apprenticeCss.match(/\.apprentice-rules\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(rulesRule, "门规撤掉独立卡壳").toContain("border: 0;");
    expect(rulesRule, "门规章线只由续卷承担").not.toMatch(/border-(?:top|right|bottom|left):/);
    expect(rulesRule, "门规不另铺纸底或投影").toMatch(
      /background: transparent;[\s\S]{0,100}box-shadow: none;/,
    );
    expect(apprenticeCss, "差事签只剩行线与选中短笔").toMatch(
      /\.apprentice-task-choice\s*\{[\s\S]{0,340}border: 0;[\s\S]{0,260}border-top: 1px solid/,
    );
    expect(apprenticeCss).toMatch(
      /\.apprentice-task-choice\[data-apprentice-selected\]\s*\{[\s\S]{0,180}box-shadow: inset 2px 0 0/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,500}\.apprentice-pulse \.folio-ledger-pulse__tallies\s*\{[\s\S]{0,120}--folio-tally-columns:\s*3/,
    );
    expect(apprenticeCss, "手机最近归来独占整行，长读数不挤成竖排").toMatch(
      /\.apprentice-pulse \.folio-ledger-pulse__tallies > \*:nth-child\(3\)\s*\{[\s\S]{0,80}grid-column:\s*1 \/ -1/,
    );
    expect(apprenticeCss, "620 起三格各归其位").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,500}\.apprentice-pulse \.folio-ledger-pulse__tallies > \*:nth-child\(3\)\s*\{[\s\S]{0,80}grid-column:\s*auto/,
    );
    expect(apprenticeCss, "账格纸边与 220 退行交给共享层").not.toContain(
      ".apprentice-pulse__tally {",
    );
    expect(apprenticeCss).toMatch(
      /\.apprentice-rules\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,3000}\.apprentice-rules\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(apprenticeCss, "960 起正文与门规左右并读").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,900}\.apprentice-register\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1\.55fr\) minmax\(17rem, 0\.75fr\)/,
    );
    expect(apprenticeCss, "桌面只在正文与边注之间留一道中缝").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1200}\.apprentice-register__chapter--roster\s*\{[\s\S]{0,180}border-right:\s*1px solid/,
    );
    expect(apprenticeCss, "门规到边注后退回单列").toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,1600}\.apprentice-rules\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,3000}\.apprentice-rules__item\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss, "四门存底默认两列").toMatch(
      /\.apprentice-depot__rows\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(apprenticeCss, "620 起四门存底并成一排").toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,1400}\.apprentice-depot__rows\s*\{[\s\S]{0,120}repeat\(4, minmax\(0, 1fr\)\)/,
    );
    expect(apprenticeCss, "极窄档差事签退成单列").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,4000}\.apprentice-task-choice-grid\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss, "差事名不许被本命与时长挤成省略号").toMatch(
      /\.apprentice-task-choice__top\s*\{[\s\S]{0,160}flex-wrap:\s*wrap/,
    );
    expect(apprenticeCss, "极窄档案头令退成单列,动作签仍不横向溢出").toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,700}\.apprentice-order\s*\{[\s\S]{0,160}grid-template-columns:\s*1\.65rem minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss, "差事名要允许换行").toMatch(
      /\.apprentice-task-choice__name\s*\{[\s\S]{0,180}white-space:\s*normal/,
    );
    expect(apprenticeCss, "手机末枚差事签补齐整行").toMatch(
      /\.apprentice-task-choice:last-child:nth-child\(odd\)\s*\{[\s\S]{0,80}grid-column:\s*1 \/ -1/,
    );
  });
});
