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
    expect(pulse).toContain(':data-columns="tallyColumns"');
    expect(pulse).toContain(':data-wide-columns="tallyWideColumns"');
    expect(pulse).toContain('<slot name="tallies"');
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

  it("账格只留一套读数骨架,选中态直接报给读屏", () => {
    const tally = source("src/components/common/LedgerTally.vue");

    expect(tally).toContain('class="folio-ledger-tally"');
    expect(tally).toContain(":class=\"{ 'is-active': active }\"");
    expect(tally).toContain(":aria-current=\"active ? 'page' : undefined\"");
    expect(tally).toContain('class="folio-ledger-tally__mark"');
    expect(tally).toContain('class="folio-ledger-tally__label"');
    expect(tally).toContain('class="folio-ledger-tally__value"');
    expect(tally).toContain('class="folio-ledger-tally__total"');
    expect(tally).toContain('class="folio-ledger-tally__unit"');
    expect(tally).toContain('class="folio-ledger-tally__detail"');
    expect(tally).toContain("@click=\"emit('select')\"");
  });

  it("三页共用同一套账格,页面只交行列与选中项", () => {
    const cases = [
      { file: "src/views/MarketView.vue", row: "marketLedgerRows", columns: "3" },
      { file: "src/views/SoulsView.vue", row: "soulLedgerRows", columns: "3" },
      { file: "src/views/CelestialView.vue", row: "celestialLedgerRows", columns: "2" },
    ];

    for (const { file, row, columns } of cases) {
      const view = source(file);
      expect(view, `${file} 没接共享账格`).toContain(
        'import LedgerTally from "@/components/common/LedgerTally.vue"',
      );
      expect(view, `${file} 的账格仍应从同一份行数据生成`).toContain(`v-for="row in ${row}"`);
      expect(view, `${file} 要把行列数交给此刻账`).toContain(`:tally-columns="${columns}"`);
      expect(view, `${file} 不该再手搓账格`).not.toMatch(
        /class="(?:market|soul|celestial)-pulse__(?:tallies|tally|mark|label|value|total|unit|detail)"/,
      );
    }

    expect(source("src/views/CelestialView.vue")).toContain(':tally-wide-columns="4"');
  });

  it("账格纸线、强调色与 960 / 220 两档退行只由此刻账维护", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.folio-ledger-pulse__tallies\s*\{[\s\S]{0,220}grid-template-columns:\s*repeat\(var\(--folio-tally-columns\)/,
    );
    expect(css).toMatch(/\[data-columns="2"\]\s*\{[\s\S]{0,80}--folio-tally-columns:\s*2/);
    expect(css).toMatch(
      /@media \(min-width: 960px\)\s*\{[\s\S]{0,260}\[data-wide-columns="4"\]\s*\{[\s\S]{0,80}--folio-tally-columns:\s*4/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,500}\.folio-ledger-pulse__tallies\s*\{[\s\S]{0,80}--folio-tally-columns:\s*1/,
    );
    expect(css).toMatch(
      /\.folio-ledger-tally\.is-active\s*\{[\s\S]{0,260}rgb\(var\(--color-cinnabar-rgb\)/,
    );

    for (const file of [
      "src/styles/pages/market.css",
      "src/styles/pages/souls.css",
      "src/styles/pages/celestial.css",
    ]) {
      const page = source(file);
      expect(page, `${file} 不该再留账格骨架`).not.toMatch(
        /\.(?:market|soul|celestial)-pulse__(?:tallies|tally|mark|label|value|total|unit|detail)\s*\{/,
      );
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
