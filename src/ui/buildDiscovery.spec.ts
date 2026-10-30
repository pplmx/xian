import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("道途未成 · 六路发现页", () => {
  it("空态不再是占位句：流派页交给发现页，六路逐条读实时契合", () => {
    const view = source("src/views/BuildView.vue");
    const discovery = source("src/components/build/BuildDiscovery.vue");

    expect(view, "流派页空态要挂发现页").toContain('<BuildDiscovery v-else :rows="buildPaths"');
    expect(view, "六路读数与识别同源").toContain("buildAffinityRows(player.finalStats.mods)");
    expect(view, "旧占位句不再留在页里").not.toContain("道途尚未成路。凑齐同一路数");
    expect(discovery, "发现页根节点要能被真浏览器定位").toContain("data-build-discovery");
    expect(discovery, "每一路要能逐条核").toContain(':data-build-path="row.style.id"');
    expect(discovery, "流派名从事实源逐条渲染").toContain("{{ row.style.name }}");
    expect(discovery, "发现页不许手抄流派名").not.toMatch(
      /背水流|罡盾流|反震流|连击流|沐泽流|锋芒流/,
    );
  });

  it("缺口、进度与识别线同源：25% 雏形不是视图里另写的一枚数", () => {
    const discovery = source("src/components/build/BuildDiscovery.vue");

    expect(discovery, "雏形门限读 core 常数").toContain("STYLE_EMERGENCE_AFFINITY");
    expect(discovery, "成形与大成也读同一组判定线").toContain("STYLE_MATURE_AFFINITY");
    expect(discovery, "大成线同样读 core").toContain("STYLE_MASTER_AFFINITY");
    expect(discovery, "单路缺口由门限减当前契合").toContain(
      "Math.max(0, STYLE_EMERGENCE_AFFINITY - row.affinity)",
    );
    expect(discovery, "进度条也按同一门限归一").toContain(
      "row.affinity / STYLE_EMERGENCE_AFFINITY",
    );
    expect(discovery, "进度条要有读屏数值").toContain(":aria-valuetext=");
    expect(discovery, "词条名读统一词条表").toContain("STAT_NAMES[term.key]");
    expect(discovery, "参考值来自各流派定义").toContain("formatPercent(term.reference, 0)");
  });

  it("六路数量、去处与可访问性都真实：不手抄六，也不放假控件", () => {
    const discovery = source("src/components/build/BuildDiscovery.vue");
    const layout = source("scripts/layout-check.mjs");

    expect(discovery, "路数从 rows.length 数出来").toContain("cnNumber(rows.length)");
    expect(discovery, "不许把六路写死").not.toContain("六路");
    expect(discovery, "去修行是真实入口").toContain('to="/cultivation"');
    expect(discovery, "看行囊是真实入口").toContain('to="/inventory"');
    expect(discovery, "装饰轮盘不参与读屏").toContain(
      'class="build-discovery__wheel" aria-hidden="true"',
    );
    expect(discovery, "发现页不摆假可点控件").not.toContain("<button");
    expect(layout, "真浏览器要核发现页真的渲染出来").toContain("道途发现页没有渲染出来");
    expect(layout, "真浏览器要逐路数齐").toContain('querySelectorAll("[data-build-path]")');
    expect(layout, "真浏览器发现页要独立空词条场景").toContain('"__buildDiscoveryFixture"');
    expect(layout, "独立场景要注册进并发任务表").toContain(
      '["道途未成的逐路发现账", taskBuildDiscovery]',
    );
  });
});
