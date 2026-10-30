import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("修炼案 · 主读数先行,破境与闭关收成下一步", () => {
  it("卷首用周天盘承接境界与修为进度,不再留一块空主视觉", () => {
    const view = source("src/views/CultivationView.vue");
    const dial = source("src/components/cultivation/CultivationDial.vue");

    expect(view, "修炼卷首要有稳定的周天盘落点").toMatch(
      /<template #visual>[\s\S]{0,160}<CultivationDial\s*\/>/,
    );
    expect(view, "周天盘必须真的接进修炼页").toContain(
      'import CultivationDial from "@/components/cultivation/CultivationDial.vue"',
    );
    expect(dial, "周天盘刻度与界域志共用 realmLadderPoints").toContain("realmLadderPoints");
    expect(dial, "内圈进度必须读真实修为进度").toContain("player.expProgress");
    expect(dial, "境数由刻度现算,不许手写 21").toContain("points.length");
    expect(dial, "正进度不许被一位小数抹成 0%").toContain('"<0.1%"');
    expect(dial, "周天盘按 140px 实尺寸留位").toMatch(
      /\.cultivation-dial\s*\{[\s\S]{0,120}width:\s*140px;[\s\S]{0,80}height:\s*140px;/,
    );
    expect(dial, "纯视觉不重复读屏正文").toContain('aria-hidden="true"');
  });

  it("修行读数收成一张有主次的行功账,主值、余程与灵气不再同权重排队", () => {
    const view = source("src/views/CultivationView.vue");

    expect(view, "修行账要有独立运行时指纹").toContain("data-cultivation-ledger");
    expect(view, "修行账改用全站唯一的章节头").toContain("<SectionTitle");
    expect(view, "章首保留此刻功课的眉题").toContain('eyebrow="此刻功课"');
    expect(view, "章首标题仍是修行").toContain('title="修 行"');
    expect(view, "境界位置收进章首右侧动作席").toMatch(
      /<template #actions>[\s\S]{0,120}<p class="cultivation-ledger__position tabular">/,
    );
    expect(view, "旧的自绘印章章首不再保留").not.toContain("cultivation-ledger__seal");
    expect(view, "修为主值要有独立落点").toContain("data-cultivation-primary");
    expect(view, "灵气与速度要有次读数区").toContain("data-cultivation-meters");
    expect(view, "进度条仍读同一条修为进度").toContain(':value="player.expProgress"');
    expect(view, "修为主值仍点开同一份详情").toContain(':rows="expDetailRows"');
    expect(view, "灵气仍点开同一份详情").toContain(':rows="qiDetailRows"');
  });

  it("破境与闭关收进同一条下一步,不再作为两张无标题的并列大卡", () => {
    const view = source("src/views/CultivationView.vue");
    const next = view.match(/<section[^>]*data-cultivation-next[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(next, "下一步要有独立章节").toContain('title="下一步"');
    expect(next, "破境卡仍留在下一步章节").toContain("<BreakthroughCard />");
    expect(next, "闭关卡仍留在下一步章节").toContain("<RetreatCard />");
    expect(next, "两张卡共用同一条响应式栅格").toContain("cultivation-next__grid");
    expect(view, "下一步与行功账在桌面双页并读").toContain(
      '<section class="cultivation-next" data-cultivation-next>',
    );
    expect(view, "下一步不再横跨双页把右页留空").not.toContain(
      '<section class="folio-span-all cultivation-next"',
    );
    expect(view, "状态与速服在辅册内同排").toContain(
      '<div class="cultivation-support folio-span-all">',
    );
    expect(view, "功法整区落在双页下方").toContain('<GongfaSection class="folio-span-all" />');
  });

  it("下一步始终单列承接两张行动卡,极窄档不横向溢出", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.cultivation-next__grid\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(/@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.cultivation-next__grid/);
  });
});
