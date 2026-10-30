import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("此刻账 · 同一张纸边、同一枚动作键", () => {
  it("共享此刻账收住账首、正文槽与动作槽", () => {
    const pulse = source("src/components/common/LedgerPulse.vue");

    expect(pulse).toContain("data-folio-ledger-pulse");
    expect(pulse).toContain("<LedgerHeader");
    expect(pulse).toContain(':title="title"');
    expect(pulse).toContain(':description="description"');
    expect(pulse).toContain('<slot name="actions"');
    expect(pulse).toContain('class="folio-ledger-pulse__body"');
    expect(pulse).toContain("<slot />");
  });

  it("坊市、器魂与天界只交账格和强调色，不再各写纸边与动作键", () => {
    const cases = [
      "src/views/MarketView.vue",
      "src/views/SoulsView.vue",
      "src/views/CelestialView.vue",
    ];

    for (const file of cases) {
      const view = source(file);
      expect(view, `${file} 没接共享此刻账`).toContain(
        'import LedgerPulse from "@/components/common/LedgerPulse.vue"',
      );
      expect(view, `${file} 的共享此刻账数量不对`).toMatch(/<LedgerPulse\b/g);
      expect(view.match(/<LedgerPulse\b/g), `${file} 的共享此刻账数量不对`).toHaveLength(1);
      expect(view, `${file} 不该再直接搭账首`).not.toContain(
        'import LedgerHeader from "@/components/common/LedgerHeader.vue"',
      );
      expect(view, `${file} 的动作键要读共享纸边强调色`).toContain(
        'class="folio-ledger-pulse__action"',
      );
    }

    const css = source("src/style.css");
    expect(css).toMatch(
      /\.folio-ledger-pulse\s*\{[\s\S]{0,360}--folio-ledger-pulse-accent:\s*var\(--ledger-accent/,
    );
    expect(css).toMatch(
      /\.folio-ledger-pulse__action\s*\{[\s\S]{0,360}color:\s*var\(--folio-ledger-pulse-accent\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1800}\.folio-ledger-pulse__action\s*\{[\s\S]{0,100}width:\s*100%/,
    );

    for (const file of [
      "src/styles/pages/market.css",
      "src/styles/pages/souls.css",
      "src/styles/pages/celestial.css",
    ]) {
      const page = source(file);
      expect(page, `${file} 不该再复制纸边`).not.toMatch(/::before\s*\{[\s\S]{0,160}inset:\s*4px/);
      expect(page, `${file} 不该再复制动作键`).not.toMatch(/__jump\s*\{/);
    }
  });

  it("强调色仍只由三页容器各交一枚，朱砂与石青不另起第三色", () => {
    expect(source("src/styles/pages/market.css")).toMatch(
      /\.market-pulse\s*\{[\s\S]{0,120}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(source("src/styles/pages/souls.css")).toMatch(
      /\.soul-pulse\s*\{[\s\S]{0,120}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(source("src/styles/pages/celestial.css")).toMatch(
      /\.celestial-pulse\s*\{[\s\S]{0,120}--ledger-accent:\s*var\(--color-qing\)/,
    );
  });
});
