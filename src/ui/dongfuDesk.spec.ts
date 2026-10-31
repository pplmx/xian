import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

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

  it("七作按基业、修行、丹器、生计分组,七座一座不少也不重复", () => {
    const view = source("src/views/DongfuView.vue");
    const groups = view.match(/const GROUP_SPECS = \[[\s\S]*?\] satisfies/)?.[0] ?? "";

    expect(groups, "四组定义要能定位到").toContain('title: "基业"');
    expect(groups, "四组定义要能定位到").toContain('title: "修行"');
    expect(groups, "四组定义要能定位到").toContain('title: "丹器"');
    expect(groups, "四组定义要能定位到").toContain('title: "生计"');
    for (const id of ["mansion", "array", "library", "alchemy", "forge", "field", "beast"]) {
      expect(groups, `${id} 必须恰好编入一组`).toContain(`"${id}"`);
    }
    expect((view.match(/<BuildingCard /g) ?? []).length, "只保留一组建筑卡循环").toBe(1);
    expect(view, "建筑卡仍遍历分组内容").toContain('v-for="def in group.defs"');
  });

  it("手机总账单列,220 以下建筑与快捷键都退成单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".dongfu-ledger {");
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
      /\.dongfu-workshop__grid\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(dongfuCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.dongfu-workshop__grid\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(dongfuCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.dongfu-ledger__quick\s*\{[\s\S]{0,100}flex-direction:\s*column/,
    );
  });
});
