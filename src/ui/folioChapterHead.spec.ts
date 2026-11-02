import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function walk(rel: string): string[] {
  return readdirSync(resolve(ROOT, rel), { withFileTypes: true }).flatMap((entry) => {
    const next = `${rel}/${entry.name}`;
    return entry.isDirectory() ? walk(next) : [next];
  });
}

describe("续卷章首 · 全站只留一枚可独立成形的共享组件", () => {
  it("十二页旧章首退场，页面统一接 FolioChapterHead", () => {
    const perPageHeads = walk("src/components").filter(
      (file) =>
        file.endsWith("ChapterHead.vue") && file !== "src/components/common/FolioChapterHead.vue",
    );
    const consumers = [
      "src/views/ApprenticeView.vue",
      "src/views/BuildView.vue",
      "src/views/CelestialView.vue",
      "src/views/CharacterView.vue",
      "src/views/CollectionView.vue",
      "src/views/CreateView.vue",
      "src/views/CultivationView.vue",
      "src/views/DongfuView.vue",
      "src/views/InventoryView.vue",
      "src/views/RealmCodexView.vue",
      "src/views/SoulsView.vue",
      "src/views/TitlesView.vue",
      "src/views/WelcomeView.vue",
      "src/components/celestial/CelestialReportLedger.vue",
      "src/components/celestial/ExpeditionPanel.vue",
      "src/components/celestial/MarksPanel.vue",
      "src/components/celestial/TrialPanel.vue",
      "src/components/character/IdentityDialog.vue",
      "src/components/character/RebirthDialog.vue",
      "src/components/character/ReincarnationDialog.vue",
      "src/components/cultivation/GongfaSection.vue",
    ];

    expect(perPageHeads, "每页各造一枚章首会再次长出版式分叉").toEqual([]);
    for (const file of consumers) {
      expect(source(file), `${file} 应接共享章首`).toContain(
        'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
      );
      expect(source(file), `${file} 还应真正渲染共享章首`).toContain("<FolioChapterHead");
    }
  });

  it("章号、眉题、题名、读法、真值与动作尾槽各归其位", () => {
    const head = source("src/components/common/FolioChapterHead.vue");

    expect(head).toContain("data-folio-chapter-head");
    expect(head).toContain('aria-hidden="true"');
    expect(head).toContain("folio-chapter-head__eyebrow");
    expect(head).toContain("folio-chapter-head__title");
    expect(head).toContain("folio-chapter-head__hint");
    expect(head).toContain("folio-chapter-head__fact");
    expect(head).toContain('<slot name="actions"');
    expect(head).toContain("eyebrow?: string");
    expect(head).toContain('size?: "section" | "heading"');
  });

  it("组件自带 scoped 版式，异步浮层不依赖人物页样式先加载", () => {
    const head = source("src/components/common/FolioChapterHead.vue");

    expect(head).toContain("<style scoped>");
    expect(head).toMatch(
      /\.folio-chapter-head\s*\{[\s\S]{0,260}display:\s*grid;[\s\S]{0,260}grid-template-columns:\s*1\.45rem minmax\(0, 1fr\) minmax\(6\.5rem, auto\)/,
    );
    expect(head).toMatch(
      /@media \(max-width: 520px\)[\s\S]{0,500}\.folio-chapter-head\s*\{[\s\S]{0,160}grid-template-columns:\s*1\.35rem minmax\(0, 1fr\)/,
    );
    expect(head).toMatch(
      /@media \(max-width: 520px\)[\s\S]{0,900}\.folio-chapter-head__tail\s*\{[\s\S]{0,160}grid-column:\s*2/,
    );
    expect(head).toContain("var(--folio-chapter-accent, var(--color-cinnabar))");
    expect(head).toContain("var(--folio-chapter-accent-rgb, var(--color-cinnabar-rgb))");
  });
});
