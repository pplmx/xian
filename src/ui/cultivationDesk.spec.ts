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
    expect(view, "下一步跨过桌面双页中缝").toContain(
      '<section class="folio-span-all cultivation-next" data-cultivation-next>',
    );
  });

  it("下一步在手机单列、桌面并读,极窄档不横向溢出", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.cultivation-next__grid\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,300}\.cultivation-next__grid\s*\{[\s\S]{0,120}repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(/@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.cultivation-next__grid/);
  });
});
