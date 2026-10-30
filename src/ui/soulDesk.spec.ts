import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("器魂案 · 三席先立意,此刻再落到先手", () => {
  it("卷首阵图读三席、闲置与可凝真值,整图不重复进入读屏", () => {
    const view = source("src/views/SoulsView.vue");
    const map = source("src/components/celestial/SoulForgeMap.vue");

    expect(view, "器魂卷首要走 featured 开卷版式").toMatch(
      /<FolioPageHeader[\s\S]{0,260}\bfeatured\b/,
    );
    expect(view, "器魂阵图要进独立主视觉槽").toMatch(
      /<template v-if="unlocked" #visual>[\s\S]{0,180}<SoulForgeMap/,
    );
    expect(view, "三席从唯一 soulAt 出口取").toContain("const soulSeats = computed");
    expect(view, "阵图闲置数读卷首总账").toContain(':idle-count="soulPulse.idleSouls.length"');
    expect(view, "阵图可凝数读卷首总账").toContain(':refinable-count="soulPulse.refinableCount"');
    expect(view, "阵图可支付数读卷首总账").toContain(
      ':affordable-refines="soulPulse.affordableRefines"',
    );
    expect(map, "纯视觉摘要不重复读屏正文").toContain('aria-hidden="true"');
    expect(map, "阵图收在 390 卷首的一屏内").toMatch(/width:\s*154px;[\s\S]{0,60}height:\s*128px;/);
  });

  it("此刻器魂只落一张总账,下一步按装配、取舍、开炉与回行囊带路", () => {
    const view = source("src/views/SoulsView.vue");
    const markers = view.match(/data-soul-pulse(?![-\\w])/g) ?? [];
    const pulse = view.slice(view.indexOf("data-soul-pulse"), view.indexOf("</FolioPageHeader>"));
    const lead = view.slice(
      view.indexOf("const soulLead = computed"),
      view.indexOf("const SOUL_STEPS"),
    );

    expect(markers, "总账运行时落点只能有一个").toHaveLength(1);
    expect(view, "汇总仍走 core/soulOverview 唯一一份").toContain("soulOverview({");
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

  it("三席仍由 soulAt 唯一判断,极窄档保持两列而非挤成竖排", () => {
    const view = source("src/views/SoulsView.vue");
    const grid = /<div class="(mt-2 grid[^"]*)">/.exec(view)?.[1];

    expect(view, "有无器魂只留一处出口").toContain(
      "function soulAt(i: number): SoulInstance | null",
    );
    expect(view, "阵图与正文共用 soulAt").toContain("const soul = soulAt(index + 1);");
    expect(view, "正文三席仍从 SOUL_SLOTS 生成").toContain('v-for="i in SOUL_SLOTS"');
    expect(grid, "三席网格要能定位到").toBeTruthy();
    expect(grid, "常态三列").toContain("grid-cols-3");
    expect(grid, "极窄档两列").toContain("tinylens:grid-cols-2");
  });

  it("两处门径与器魂章法仍完整保留,章法退到页尾且数字读机制常量", () => {
    const view = source("src/views/SoulsView.vue");

    expect(view, "两处门径有独立运行时落点").toContain("data-soul-gateways");
    expect(view, "闲置形意仍开同一扇门").toContain('data-soul-gateway="idle"');
    expect(view, "凝炼台仍开同一扇门").toContain('data-soul-gateway="forge"');
    expect(view, "章法保留不可逆代价").toContain("原器即毁");
    expect(view, "章法炉费读机制常量").toContain("SOUL_REFINE_COST");
    expect(view, "章法席数读机制常量").toContain("SOUL_SLOTS");
    expect(view, "章法仍可展开细读").toContain("soulIntroOpen");
  });

  it("手机总账三栏,960 起两处门径并读,220 以下退单列", () => {
    const css = source("src/style.css");
    const start = css.indexOf(".soul-pulse {");
    const end = css.indexOf("/*\n * 开关", start);
    const soulCss = css.slice(start, end);

    expect(start, "器魂样式段要能定位到").toBeGreaterThan(-1);
    expect(end, "器魂样式段要有明确结尾").toBeGreaterThan(start);
    expect(soulCss).toMatch(
      /\.soul-pulse__tallies\s*\{[\s\S]{0,120}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
    );
    expect(soulCss).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,160}\.soul-gateway-grid\s*\{[\s\S]{0,100}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(soulCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,900}\.soul-pulse__tallies\s*\{[\s\S]{0,100}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(soulCss).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.soul-gateway__arrow\s*\{[\s\S]{0,80}display:\s*none/,
    );
  });
});
