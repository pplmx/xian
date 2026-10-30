import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function source(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("开卷版式 · 全站十七册共用一条书页基线", () => {
  it("主五册与人间也接共同卷首，不再各留一套旧页头", () => {
    const pages = [
      "HomeView",
      "CultivationView",
      "CharacterView",
      "AdventureView",
      "InventoryView",
      "MortalWorldView",
    ];

    for (const page of pages) {
      const src = source(`src/views/${page}.vue`);
      expect(src, `${page} 还没接入全站卷首`).toContain("<FolioPageHeader");
      expect(src, `${page} 没导入卷首组件`).toContain(
        'import FolioPageHeader from "@/components/common/FolioPageHeader.vue"',
      );
      expect(src, `${page} 的主册卷首要走开卷版式`).toContain("featured");
    }
  });

  it("主册页面不再自己另写一枚 h1 —— 一页只能有一个主标题", () => {
    const pages = [
      "HomeView",
      "CultivationView",
      "CharacterView",
      "AdventureView",
      "InventoryView",
      "MortalWorldView",
    ];

    for (const page of pages) {
      expect(source(`src/views/${page}.vue`), `${page} 仍在模板里手写 h1`).not.toContain("<h1");
    }
  });

  it("开卷版式给图景、读数与正文留独立位置，极窄档仍把动作落整行", () => {
    const masthead = source("src/components/common/FolioPageHeader.vue");
    const css = source("src/style.css");

    expect(masthead, "卷首要支持主册开卷版式").toContain("featured?: boolean");
    expect(masthead, "主册要能放主视觉").toContain('<slot name="visual"');
    expect(masthead, "主册要能在题下继续铺开卷正文").toContain("<slot");
    expect(masthead, "开卷版式要落在运行时契约上").toContain("data-folio-featured");
    expect(css, "开卷版式需要独立样式").toContain(".folio-masthead--featured");
    expect(masthead, "极窄档动作仍独占整行").toContain("tinylens:w-full");
  });

  it("首页法球按组件实尺寸留位，不裁掉旋转外环", () => {
    const home = source("src/views/HomeView.vue");
    const orb = source("src/components/common/CultivationOrb.vue");

    expect(orb, "法球根节点仍是 140×140").toMatch(/\.orb-root \{[\s\S]{0,200}width: 140px;/);
    expect(home, "首页主视觉槽位要和法球同宽高").toContain('<div class="relative h-35 w-35">');
  });

  it("同页栏目不再重复页面主标题", () => {
    const adventure = source("src/views/AdventureView.vue");
    const inventory = source("src/views/InventoryView.vue");
    const character = source("src/views/CharacterView.vue");

    expect(adventure).not.toContain('<SectionTitle title="历练"');
    expect(inventory).not.toContain(">行 囊</span>");
    expect(character).not.toContain('<SectionTitle title="道躯"');
  });
});
