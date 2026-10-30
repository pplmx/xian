import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("深页案头 · 同一枚印、同一条身份栏与总账席", () => {
  it("共享案头收住印、眉题、标题、说明、总账与动作席", () => {
    const header = source("src/components/common/LedgerHeader.vue");

    expect(header).toContain("data-folio-ledger-head");
    expect(header).toContain(':data-variant="variant"');
    expect(header).toContain("scoreLabel");
    expect(header).toContain("scoreValue");
    expect(header).toContain('<slot name="meta"');
    expect(header).toContain('<slot name="actions"');
    expect(header).toContain('<slot name="eyebrow"');
    expect(header).toContain('<slot name="title"');
    expect(header).toContain('<slot name="description"');
    expect(header).toContain("v-if=\"seal && variant !== 'index'\"");
  });

  it("深页与流派未成卷全部改读共享案头,不再各手搓一套章首", () => {
    const cases = [
      { file: "src/views/BuildView.vue", count: 4 },
      { file: "src/views/LegacyView.vue", count: 6 },
      { file: "src/views/TitlesView.vue", count: 4 },
      { file: "src/components/build/BuildDiscovery.vue", count: 1 },
      { file: "src/views/MortalWorldView.vue", count: 2 },
      { file: "src/views/RealmCodexView.vue", count: 1 },
      { file: "src/views/CollectionView.vue", count: 2 },
      { file: "src/views/SettingsView.vue", count: 3 },
    ];

    for (const { file, count } of cases) {
      const view = source(file);
      expect(view, `${file} 没导入共享案头`).toContain(
        'import LedgerHeader from "@/components/common/LedgerHeader.vue"',
      );
      expect(view.match(/<LedgerHeader\b/g), `${file} 的共享案头数量不对`).toHaveLength(count);
    }

    for (const file of [
      "src/views/BuildView.vue",
      "src/views/LegacyView.vue",
      "src/views/TitlesView.vue",
      "src/components/build/BuildDiscovery.vue",
      "src/views/MortalWorldView.vue",
      "src/views/RealmCodexView.vue",
      "src/views/CollectionView.vue",
      "src/views/SettingsView.vue",
    ]) {
      const view = source(file);
      expect(view).not.toMatch(
        /<(?:header)[^>]*class="[^"]*(?:build-ledger__head|legacy-ledger__head|name-beast-ledger__head|name-ledger__head|build-discovery__head|world-ledger__head|realm-now__head|achievement-briefing__head|collection-briefing__head|settings-console__head|settings-archive__head|settings-trail__head)/,
      );
    }
  });

  it("案头在常规宽度三席并读,195px 档把总账退到身份栏下方", () => {
    const css = source("src/style.css");

    expect(css).toMatch(
      /\.folio-ledger-head\s*\{[\s\S]{0,700}grid-template-areas:\s*"seal identity aside"/,
    );
    expect(css).toMatch(
      /\.folio-ledger-head\[data-variant="index"\]\s*\{[\s\S]{0,240}grid-template-areas:\s*"identity aside"/,
    );
    expect(css).toMatch(
      /@media \(max-width: 220px\)\s*\{[\s\S]{0,1200}\.folio-ledger-head\s*\{[\s\S]{0,320}grid-template-areas:\s*"seal identity"\s*"\. aside"/,
    );
  });

  it("容器只交出自己的强调色,案头本体不再复制颜色与字号", () => {
    const build = source("src/styles/pages/build.css");
    const legacy = source("src/styles/pages/legacy.css");
    const titles = source("src/styles/pages/titles.css");
    const world = source("src/styles/pages/world.css");
    const realm = source("src/styles/pages/realm-codex.css");
    const collection = source("src/styles/pages/collection.css");
    const settings = source("src/styles/pages/settings.css");

    expect(build).toMatch(
      /\.build-ledger\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--build-accent\)/,
    );
    expect(legacy).toMatch(
      /\.legacy-ledger\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--legacy-accent\)/,
    );
    expect(titles).toMatch(
      /\.name-beast-ledger\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--name-beast-accent\)/,
    );
    expect(world).toMatch(
      /\.world-ledger\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--world-accent\)/,
    );
    expect(realm).toMatch(/\.realm-now\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--realm-accent\)/);
    expect(collection).toMatch(
      /\.achievement-briefing,\s*\.collection-briefing\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-gold-ink\)/,
    );
    expect(settings).toMatch(
      /\.settings-console,\s*\.settings-archive,\s*\.settings-trail\s*\{[\s\S]{0,300}--ledger-accent:\s*var\(--settings-accent\)/,
    );
  });
});
