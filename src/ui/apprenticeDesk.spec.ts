import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("门庭案 · 门庭图先立意,总账再落到值日簿", () => {
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

  it("今日门庭把候差、在途、最近归期与一令齐发收成一张总账", () => {
    const view = source("src/views/ApprenticeView.vue");
    const markers = view.match(/data-apprentice-pulse(?![-\\w])/g) ?? [];
    const pulse = view.slice(
      view.indexOf("data-apprentice-pulse"),
      view.indexOf("</FolioPageHeader>"),
    );

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总走 service 唯一一份").toContain("apprenticeOverview(appr.apprentices)");
    expect(view, "总账带总数").toContain(':data-apprentice-total="pulse.total"');
    expect(view, "总账带候差数").toContain(':data-apprentice-idle="pulse.idle"');
    expect(view, "总账带在途数").toContain(':data-apprentice-away="pulse.away"');
    expect(view, "最近归期读同一条汇总").toContain("pulse.value.nextReturnAt");
    expect(view, "最近归期文案必须带真实差事名").toContain("taskDef(spec).name");
    expect(view, "一键派发仍读汇总里的候差数").toContain("pulse.value.idle");
    expect(pulse.match(/<button/g), "总账里的第一枚按钮必须是一键派发").toHaveLength(1);
    expect(pulse, "一键派发要有独立动作位").toContain("apprentice-pulse__dispatch");
    expect(pulse, "无人在家时动作换口").toContain('"弟子都在路上"');
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

  it("在途行只报一条真实任务进度,候差行仍先展开说明再二次派出", () => {
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
    expect(view, "派活点按仍走两步").toContain('@click="tapTask(a.uid, t.spec)"');
    expect(view, "展开态报给读屏").toContain(':aria-expanded="isTaskOpen(a.uid, t.spec)"');
    expect(view, "第二下才真的派出").toContain("send(uid, spec)");
    expect(view, "任务说明点开后直出").toContain("taskDef(tappedTask.spec).desc");
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

  it("手机总账单列,620 起三栏并读,220 以下读数与门规退成单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".apprentice-pulse {");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const apprenticeCss = css.slice(start, end);

    expect(start, "门庭样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "门庭样式段要有明确结尾").toBeGreaterThan(start);
    expect(apprenticeCss).toMatch(
      /\.apprentice-pulse__tallies\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,500}\.apprentice-pulse__tallies\s*\{[\s\S]{0,160}minmax\(5rem, 0\.55fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.apprentice-pulse__tallies\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /\.apprentice-rules\s*\{[\s\S]{0,140}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(min-width: 620px\)\s*\{[\s\S]{0,900}\.apprentice-rules\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(apprenticeCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1400}\.apprentice-rules__item\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });
});
