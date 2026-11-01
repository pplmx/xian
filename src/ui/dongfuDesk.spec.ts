import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { dongfuBuildingChapters } from "./dongfuDesk";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("洞府案 · 山门图先立意,总账再摊开七作", () => {
  it("卷首山门图读真实七作等级与上限,整图不重复进入读屏", () => {
    const view = source("src/views/DongfuView.vue");
    const atlas = source("src/components/dongfu/DongfuAtlas.vue");

    expect(view, "卷首要挂山门图").toMatch(/<template #visual>[\s\S]{0,180}<DongfuAtlas/);
    expect(view, "山门图节点读同一条建筑表").toContain("BUILDINGS.map((def) =>");
    expect(view, "节点等级读 dongfu store").toContain("dongfu.levels[def.id]");
    expect(view, "节点上限与真实可升等级同源").toContain("dongfu.buildingCap(def.id)");
    expect(view, "可动工标记走同一升级判定").toContain("canUpgrade: info.canUpgrade");
    expect(view, "已营座数不在视图另数一遍").toContain(':built-count="dongfu.builtCount"');
    expect(atlas, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
    expect(atlas, "节点进度按 level / cap 现算").toContain("(node.level / node.cap) * 100");
  });

  it("营造总账把合府加成、每时藏收、弟子与离线上限收在同一处", () => {
    const view = source("src/views/DongfuView.vue");
    const ledger =
      view.match(/<LedgerPulse[\s\S]*?data-dongfu-perfect[\s\S]*?<\/LedgerPulse>/)?.[0] ?? "";

    expect(view, "总账要有稳定落点").toContain("data-dongfu-ledger");
    expect(view, "营造总账接共享此刻账").toContain(
      'import LedgerPulse from "@/components/common/LedgerPulse.vue"',
    );
    expect(view, "首章章首由洞府专用组件接管").toContain(
      'import DongfuChapterHead from "@/components/dongfu/DongfuChapterHead.vue"',
    );
    expect(view, "共享此刻账只留总账正文").toMatch(/<LedgerPulse\b[\s\S]{0,100}\bheadless\b/);
    expect(view, "营造总账不再直接搭账首").not.toContain(
      'import LedgerHeader from "@/components/common/LedgerHeader.vue"',
    );
    expect(ledger, "共享此刻账要真的包住总账").toContain('class="dongfu-ledger"');
    expect(view, "已营座数读 store 唯一一份").toContain("dongfu.builtCount");
    expect(view, "合府加成走引擎合并结果").toContain("modsText(dongfu.buildingMods)");
    expect(view, "每时藏收走结算同一份产出").toContain("hourlyYieldText({ ...dongfu.levels })");
    expect(ledger, "三行家底都落在总账里").toContain("合府加成");
    expect(ledger, "三行家底都落在总账里").toContain("每时藏收");
    expect(ledger, "三行家底都落在总账里").toContain("门庭弟子");
    expect(ledger, "离线阶梯仍读常数表").toContain('v-for="(h, i) in OFFLINE_CAP_HOURS"');
    expect(ledger, "当前离线档仍要实底点亮").toContain("bg-cinnabar text-paper font-kai");
  });

  it("山门总账与续账收成一册两章,专用章首同报章号、读法与真值", () => {
    const view = source("src/views/DongfuView.vue");
    const head = source("src/components/dongfu/DongfuChapterHead.vue");
    const dongfuCss = source("src/styles/pages/dongfu.css");

    expect(view, "旧通用节题退场").not.toContain("<SectionTitle");
    expect(view).toContain(
      '<article class="dongfu-ledger-register folio-span-all" data-dongfu-ledger-register>',
    );
    expect(view, "总账是续卷第一章").toContain('data-dongfu-ledger-chapter="summary"');
    expect(view, "山门续账是同一册第二章").toContain('data-dongfu-ledger-chapter="register"');
    expect(view.match(/<DongfuChapterHead\b/g), "两章各用一枚洞府章首").toHaveLength(2);
    expect(view).toContain('index="壹"');
    expect(view).toContain('index="贰"');
    expect(view, "总账章内真值读同一条 store 汇总").toContain(
      ':fact="`已营 ${dongfu.builtCount}/${BUILDINGS.length}`"',
    );
    expect(view, "续账章内真值也读 store").toContain(
      ':fact="`${dongfu.builtCount}/${BUILDINGS.length} 已营 · ${offlineCapHours} 时离线`"',
    );
    expect(head).toContain("data-dongfu-chapter-head");
    expect(head).toContain("dongfu-chapter-head__index");
    expect(head).toContain("dongfu-chapter-head__eyebrow");
    expect(head).toContain("dongfu-chapter-head__hint");
    expect(head).toContain("dongfu-chapter-head__fact");
    expect(dongfuCss).toMatch(
      /\.dongfu-ledger-register\s*\{[\s\S]{0,260}border-top:\s*1px solid[\s\S]{0,160}border-bottom:\s*1px solid/,
    );
    expect(dongfuCss).toMatch(
      /\.dongfu-ledger-register__chapter \+ \.dongfu-ledger-register__chapter\s*\{[\s\S]{0,100}border-top:\s*1px solid/,
    );
    expect(dongfuCss, "内层续账不再重复上下账线").toMatch(
      /\.dongfu-ledger-register__chapter \.dongfu-register\s*\{[\s\S]{0,180}border:\s*0;/,
    );
  });

  it("眼前一锤同走 buildingService 的判定、造价与动作,不再另算一套", () => {
    const view = source("src/views/DongfuView.vue");

    expect(view, "总账快捷键要有运行时指纹").toContain("data-dongfu-quick-build");
    expect(view, "快捷键先找同一份可升级判定").toContain(
      "const info = buildingUpgradeInfo(def.id)",
    );
    expect(view, "快捷键报同一份石料与玄铁").toContain("formatGN(nextBuild.info.stone)");
    expect(view, "快捷键报同一份玄铁").toContain("nextBuild.info.ore");
    expect(view, "快捷键执行原升级服务").toContain("upgradeBuilding(row.def.id)");
    expect(view, "读屏名也把造价摊开").toMatch(/quickBuildLabel[\s\S]{0,300}formatGN/);
    expect(view, "无工可动时跳过已满建筑再报下一条真实阻因").toContain(
      "dongfu.buildingCap(def.id)) continue",
    );
    expect(view, "阻因带建筑名,不只报一句泛化提示").toContain(
      "${def.name} · ${buildingUpgradeInfo(def.id).reason",
    );
  });

  it("七作按基业、修行、丹器、生计续账,七座一座不少也不重复", () => {
    const chapters = dongfuBuildingChapters();
    expect(chapters.map((chapter) => chapter.title)).toEqual(["基业", "修行", "丹器", "生计"]);
    expect(chapters.flatMap((chapter) => chapter.defs.map((def) => def.id))).toEqual([
      "mansion",
      "array",
      "library",
      "alchemy",
      "forge",
      "field",
      "beast",
    ]);

    const view = source("src/views/DongfuView.vue");
    expect(view, "七作只走一趟循环").toContain('v-for="def in group.defs"');
    expect((view.match(/<BuildingLedgerRow /g) ?? []).length, "只保留一组账行循环").toBe(1);
    expect(view, "七作、家业与灵脉同住一条续账").toContain("data-dongfu-register");
    expect(view, "每章带稳定运行时指纹").toContain("data-dongfu-chapter");
    expect(view, "旧分组卡片网格不再出现").not.toContain("dongfu-workshop__grid");
  });

  it("建筑从独立卡收成可展开账行:现效、将至与主键先露,完整账再展开", () => {
    const row = source("src/components/dongfu/BuildingLedgerRow.vue");

    expect(row, "建筑要有稳定运行时指纹").toContain(':data-dongfu-building-row="props.def.id"');
    expect(row, "主升级键仍要能按运行时找到").toContain("data-building-action");
    expect(row, "默认只露当前首项").toContain("primaryCurrent");
    expect(row, "默认只露下一级首项").toContain("primaryPreview");
    expect(row, "详情展开态要报给读屏").toContain(':aria-expanded="detailsOpen"');
    expect(row, "详情开关要关联正文").toContain(':aria-controls="detailId"');
    expect(row, "详情正文默认收起").toMatch(/<div v-show="detailsOpen" :id="detailId"/);
    expect(row, "账行不再借通用卡片壳").not.toContain("card-ink");
  });

  it("账行只把真动作染朱砂 —— 主键短笔淡底,等级与进度归石青", () => {
    // 七作同时可升时,若整行与整宽按钮都铺朱砂,七条会叠成同一层重的行动带。
    // 可动的那一下只留在行内短笔按钮上;等级、进度与已营计数都属信息层。
    const css = source("src/style.css");
    const start = css.indexOf(".dongfu-register {");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const dongfuCss = css.slice(start, end);

    expect(start, "洞府续账样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "洞府续账样式段要有明确结尾").toBeGreaterThan(start);
    expect(dongfuCss, "已营等级走石青信息色").toMatch(
      /\.dongfu-building__level\s*\{[\s\S]{0,160}color:\s*rgb\(var\(--color-qing-rgb\)\)/,
    );
    expect(dongfuCss, "章内已营进度也走石青").toMatch(
      /\.dongfu-register__chapter-count\s*\{[\s\S]{0,180}color:\s*rgb\(var\(--color-qing-rgb\)\)/,
    );
    expect(dongfuCss, "建筑状态章不再整行铺朱砂底").not.toMatch(
      /\.dongfu-building\.is-ready\s*\{[^}]*background:[^}]*cinnabar/,
    );
    expect(dongfuCss, "可升状态不许把建筑章也染成朱砂").not.toMatch(
      /\.dongfu-building\.is-ready\s+\.dongfu-building__mark\s*\{[^}]*color:\s*rgb\(var\(--color-cinnabar-rgb\)\)/,
    );
    expect(dongfuCss, "主键不再拉满账行").toMatch(
      /\.dongfu-building__action\s*\{[\s\S]{0,220}width:\s*fit-content/,
    );
    expect(dongfuCss, "主键前只留一小笔朱砂").toMatch(
      /\.dongfu-building__action::before\s*\{[\s\S]{0,180}width:\s*0\.72rem[\s\S]{0,180}height:\s*2px[\s\S]{0,180}background:\s*currentColor/,
    );
    expect(dongfuCss, "淡底只铺短按钮自身").toMatch(
      /\.dongfu-building__action\s*\{[\s\S]{0,520}background:\s*rgb\(var\(--color-cinnabar-rgb\) \/ 0\.035\)/,
    );
  });

  it("手机总账单列,山门续账只留上下账线,220 以下账行也退成单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".dongfu-ledger-register {");
    const end = css.indexOf("/*\n   * 道躯案", start);
    const dongfuCss = css.slice(start, end);

    expect(start, "洞府样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "洞府样式段要有明确结尾").toBeGreaterThan(start);
    expect(dongfuCss, "纸边由此刻账统一维护").not.toMatch(
      /\.dongfu-ledger\s*\{[\s\S]{0,240}inset:\s*4px/,
    );
    expect(dongfuCss, "洞府只交一枚强调色").toMatch(
      /\.dongfu-ledger\s*\{[\s\S]{0,140}--ledger-accent:\s*var\(--world-bar\)/,
    );
    expect(dongfuCss).toMatch(
      /\.dongfu-ledger__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dongfuCss).toMatch(
      /\.dongfu-ledger-register\s*\{[\s\S]{0,180}border-top:\s*1px solid[\s\S]{0,180}border-bottom:\s*1px solid/,
    );
    expect(dongfuCss).toContain(".dongfu-register__chapter + .dongfu-register__chapter");
    expect(dongfuCss).toContain(".dongfu-building__body");
    expect(dongfuCss, "旧卡片网格已撤").not.toContain(".dongfu-workshop__grid");
    const tiny = dongfuCss.slice(dongfuCss.indexOf("@media (max-width: 220px)"));
    expect(tiny).toMatch(
      /\.dongfu-building__body\s*\{[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(tiny).toMatch(/\.dongfu-ledger__quick\s*\{[\s\S]{0,220}flex-direction:\s*column/);
  });
});
