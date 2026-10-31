import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("限时机缘卷 · 顿悟与巡游共用一纸", () => {
  it("两扇引擎浮层走同一张机缘卷，不再各铺一套普通按钮列表", () => {
    const sheet = source("src/components/earlygame/OpportunityScroll.vue");
    const enlighten = source("src/components/cultivation/EnlightenmentModal.vue");
    const cave = source("src/components/dongfu/CaveEventModal.vue");

    expect(sheet, "机缘卷要有稳定的运行时契约").toContain("data-opportunity-scroll");
    expect(sheet, "标题要被真浏览器与读屏共同定位").toContain("data-opportunity-title");
    expect(sheet, "背板、Esc 与关闭键不得静默舍签").toContain(':closable="false"');
    expect(sheet, "舍弃只能是显式动作").toContain("data-opportunity-leave");
    expect(enlighten, "顿悟要接共享机缘卷").toContain("<OpportunityScroll");
    expect(cave, "洞府巡游要接共享机缘卷").toContain("<OpportunityScroll");
    expect(enlighten, "顿悟以「悟」印开卷").toContain('seal="悟"');
    expect(cave, "巡游以「巡」印开卷").toContain('seal="巡"');
  });

  it("倒计时读事件真实起止；临散阈值只由共享机缘卷持有", () => {
    const sheet = source("src/components/earlygame/OpportunityScroll.vue");
    const enlighten = source("src/components/cultivation/EnlightenmentModal.vue");
    const cave = source("src/components/dongfu/CaveEventModal.vue");

    expect(sheet, "临散转朱砂读单源阈值").toContain("URGENT_COUNTDOWN_SEC");
    expect(sheet, "倒计时要有可定位的读数").toContain("data-opportunity-timer");
    expect(sheet, "剩余时长要落成真实进度").toContain("remainingPercent");
    expect(enlighten, "顿悟总时长从事件窗口现算").toContain(
      "event.value.expiresAt - event.value.triggeredAt",
    );
    expect(cave, "巡游总时长从事件窗口现算").toContain(
      "event.value.expiresAt - event.value.triggeredAt",
    );
    expect(enlighten, "顿悟不再手抄倒计时阈值").not.toContain("URGENT_COUNTDOWN_SEC");
    expect(cave, "巡游不再手抄倒计时阈值").not.toContain("URGENT_COUNTDOWN_SEC");
  });

  it("每签同时摊开签文、风味与真实得失，有代价的签要明说", () => {
    const sheet = source("src/components/earlygame/OpportunityScroll.vue");
    const enlighten = source("src/components/cultivation/EnlightenmentModal.vue");
    const cave = source("src/components/dongfu/CaveEventModal.vue");

    expect(sheet, "每一签都要有可定位落点").toContain("data-opportunity-choice");
    expect(sheet, "真实得失要有独立读数行").toContain("data-opportunity-effect");
    expect(sheet, "有代价的签要露印").toContain("有代价");
    expect(enlighten, "顿悟数值仍从 buff/reward 现算").toContain("enlightenmentEffectText");
    expect(cave, "巡游得失仍从 reward/penalty 现算").toContain("caveOptionEffectText");
    expect(cave, "巡游惩罚签要让机缘卷标明有代价").toContain("risk: Boolean(opt.penalty)");
  });

  it("舍弃后果写在按钮外；巡游仍是今日一次，顿悟只舍本次", () => {
    const enlighten = source("src/components/cultivation/EnlightenmentModal.vue");
    const cave = source("src/components/dongfu/CaveEventModal.vue");

    expect(enlighten, "顿悟要说明只舍本次灵光").toContain("合卷即散");
    expect(enlighten, "顿悟舍弃词不再混用关闭").toContain("舍此机缘");
    expect(cave, "巡游要说明离开占掉今日一次").toContain("离开后,今日不再巡游");
    expect(cave, "巡游按钮只留短动作").toContain('leave-label="离 开"');
  });

  it("390 三列读签，195 收成签文与动作上下两段", () => {
    const sheet = source("src/components/earlygame/OpportunityScroll.vue");

    expect(sheet, "常态签身按序印 / 签文 / 择印三列").toMatch(
      /\.opportunity-choice\s*\{[\s\S]{0,180}grid-template-columns:\s*1\.55rem minmax\(0, 1fr\) auto/,
    );
    expect(sheet, "极窄档把择印落到签文下方").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1000}\.opportunity-choice__action\s*\{[\s\S]{0,120}grid-column:\s*2/,
    );
    expect(sheet, "极窄档标题与时机上下排").toMatch(
      /@media \(max-width: 220px\)[\s\S]{0,1000}\.opportunity-scroll__clock\s*\{[\s\S]{0,120}grid-column:\s*2/,
    );
  });
});
