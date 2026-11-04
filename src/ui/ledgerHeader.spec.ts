import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

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
    // 数量按「这一页有几个分册案头」钉住:新增分册要一并改这个数,顺手确认
    // 它是用共享案头写的,而不是又手搓了一层。LegacyView 6 → 7 是加「行年」那一册。
    const cases = [
      { file: "src/views/LegacyView.vue", count: 7 },
      { file: "src/components/build/BuildDiscovery.vue", count: 1 },
      { file: "src/views/MortalWorldView.vue", count: 2 },
      { file: "src/views/RealmCodexView.vue", count: 1 },
      { file: "src/views/CharacterView.vue", count: 1 },
    ];

    for (const { file, count } of cases) {
      const view = source(file);
      expect(view, `${file} 没导入共享案头`).toContain(
        'import LedgerHeader from "@/components/common/LedgerHeader.vue"',
      );
      expect(view.match(/<LedgerHeader\b/g), `${file} 的共享案头数量不对`).toHaveLength(count);
    }

    const titles = source("src/views/TitlesView.vue");
    expect(titles, "名兽两册改读专用章首").toContain(
      'import FolioChapterHead from "@/components/common/FolioChapterHead.vue"',
    );
    expect(titles.match(/<FolioChapterHead\b/g), "名兽两册应各两章").toHaveLength(4);

    for (const file of [
      "src/views/BuildView.vue",
      "src/views/LegacyView.vue",
      "src/views/TitlesView.vue",
      "src/components/build/BuildDiscovery.vue",
      "src/views/MortalWorldView.vue",
      "src/views/RealmCodexView.vue",
      "src/views/CollectionView.vue",
      "src/views/SettingsView.vue",
      "src/views/DongfuView.vue",
      "src/views/CharacterView.vue",
      "src/views/ApprenticeView.vue",
      "src/views/MarketView.vue",
      "src/views/SoulsView.vue",
      "src/views/CelestialView.vue",
    ]) {
      const view = source(file);
      expect(view).not.toMatch(
        /<(?:header|div)[^>]*class="[^"]*(?:build-ledger__head|legacy-ledger__head|name-beast-ledger__head|name-ledger__head|build-discovery__head|world-ledger__head|realm-now__head|achievement-briefing__head|collection-briefing__head|settings-console__head|settings-archive__head|settings-trail__head|dongfu-ledger__head|character-dossier__head|apprentice-pulse__head|market-pulse__lead|soul-pulse__lead|celestial-pulse__lead)/,
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
    const dongfu = source("src/styles/pages/dongfu.css");
    const character = source("src/styles/pages/character.css");
    const apprentice = source("src/styles/pages/apprentice.css");
    const market = source("src/styles/pages/market.css");
    const souls = source("src/styles/pages/souls.css");
    const celestial = source("src/styles/pages/celestial.css");

    expect(build).toMatch(
      /\.build-register\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--build-accent\)/,
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
    expect(collection, "藏珍两章不再借共享案头").not.toContain(
      ".achievement-briefing > .folio-ledger-head",
    );
    expect(dongfu).toMatch(
      /\.dongfu-ledger\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--world-bar\)/,
    );
    expect(character).toMatch(
      /\.character-dossier\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(apprentice).toMatch(
      /\.apprentice-pulse\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(market).toMatch(
      /\.market-pulse\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(souls).toMatch(
      /\.soul-pulse\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-cinnabar\)/,
    );
    expect(celestial).toMatch(
      /\.celestial-pulse\s*\{[\s\S]{0,260}--ledger-accent:\s*var\(--color-qing\)/,
    );
  });
});
