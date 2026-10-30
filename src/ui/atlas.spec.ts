import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";
import { atlasJumpIndex, atlasSectionIdForRoute } from "./atlas";

const ROOT = resolve(__dirname, "../..");

describe("玄枢图 · 五卷快引", () => {
  it("按当前路由落卷，未入册时回修行卷", () => {
    expect(atlasSectionIdForRoute("home")).toBe("practice");
    expect(atlasSectionIdForRoute("souls")).toBe("belongings");
    expect(atlasSectionIdForRoute("settings")).toBe("fate");
    expect(atlasSectionIdForRoute("not-a-route")).toBe("practice");
    expect(atlasSectionIdForRoute(undefined)).toBe("practice");
  });

  it("左右键循环、Home/End 落到两端，其他键不动游标", () => {
    expect(atlasJumpIndex(0, "ArrowLeft", 5)).toBe(4);
    expect(atlasJumpIndex(4, "ArrowRight", 5)).toBe(0);
    expect(atlasJumpIndex(3, "Home", 5)).toBe(0);
    expect(atlasJumpIndex(1, "End", 5)).toBe(4);
    expect(atlasJumpIndex(2, "Enter", 5)).toBe(2);
    expect(atlasJumpIndex(2, "ArrowRight", 0)).toBe(-1);
  });

  it("组件接上五卷快引、卷宗分册与极窄档规则", () => {
    const atlas = readFileSync(resolve(ROOT, "src/components/common/NavigationAtlas.vue"), "utf8");
    const css = readStyleCss();
    const modal = readFileSync(resolve(ROOT, "src/components/common/BaseModal.vue"), "utf8");

    expect(atlas, "顶栏的玄枢图要有五卷快引").toContain("data-atlas-compass");
    expect(atlas, "每一卷要有可点击的快引").toContain("data-atlas-volume");
    expect(atlas, "快引要有明确的目标关系").toContain(":aria-controls");
    expect(atlas, "每卷仍要完整铺出册目").toContain("data-atlas-section");
    expect(atlas, "当前卷要留可见落点").toContain("data-atlas-section-current");
    expect(atlas, "五卷快引要支持键盘游标").toContain("atlasJumpIndex");
    expect(atlas, "桌面总图要能比普通弹窗更宽").toContain('size="max"');
    expect(modal, "弹窗原语要支持总图宽度").toContain('props.size === "max"');
    expect(css, "五卷快引要有独立样式").toContain(".atlas-compass");
    expect(css, "桌面总图要铺成两列卷宗").toMatch(
      /@media \(min-width: 720px\)[\s\S]*?\.atlas-index[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(css, "195px 档五卷快引改两列，末卷跨满整行").toMatch(
      /@media \(max-width: 220px\)[\s\S]*?\.atlas-compass\s*\{[\s\S]{0,180}?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]{0,900}?\.atlas-volume:last-child\s*\{[\s\S]{0,100}?grid-column:\s*1\s*\/\s*-1;/,
    );
    expect(css, "195px 档要收住五卷快引字距").toContain(".atlas-volume__label");
  });
});
