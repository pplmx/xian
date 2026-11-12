/**
 * 每页可见场景审计 —— 真浏览器量一次,写进 scripts/sceneAudit.json。
 *
 * 为什么要这一步:源码里 `<InkScene` 的处数、`#backdrop` 槽在不在,
 * 都不等于**玩家看得见画**。洞府页就是个例子:它有自绘 `DongfuAtlas`、
 * 有 `#visual` 槽,单看源码很像「已经有画」,而实测那一屏一场景都量不到。
 * 故这一支用一个真浏览器把每个主页面走一遍,数可见的 `[data-scene-terrain]`。
 *
 * 产出喂给 `src/ui/mastheadScene.spec.ts` 的最后一条判据 —— 与 shots / layout-check
 * 同一套口径:生成一次、比一次,而不是每次跑测试都开浏览器。
 *
 *   bun scripts/audit-scenes.mjs      # 重写 sceneAudit.json
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seedSave, lateSlices } from "./lib/saveFixture.mjs";
import { blockExternal } from "./lib/pageErrors.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = `file://${join(ROOT, "dist/index.html")}`;
const OUT = join(ROOT, "scripts/sceneAudit.json");

/** 主页面清单 —— 与 mastheadScene.spec 的「该有画的页」对齐,只多不少 */
const ROUTES = [
  "/",
  "/cultivation",
  "/world",
  "/adventure",
  "/character",
  "/inventory?tab=equip",
  "/collection?tab=collection",
  "/celestial",
  "/titles",
  "/dongfu",
  "/legacy",
  "/market",
  "/apprentice",
];

const browser = await chromium.launch({
  args: ["--allow-file-access-from-files", "--disable-web-security"],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await blockExternal(ctx);
  const slices = lateSlices("light");
  slices.player.major = 20;
  slices.player.exp = { m: 0, e: 0 };
  await seedSave(ctx, slices, "__sceneaudit");
  const page = await ctx.newPage();
  const rows = [];
  for (const route of ROUTES) {
    await page.goto(INDEX + "#" + route, { waitUntil: "load" });
    await page.waitForTimeout(2300);
    /* 开局与成就弹窗会盖住整屏,先收干净 */
    for (let i = 0; i < 5; i += 1) {
      if (!(await page.locator(".modal-panel").count())) break;
      const ack = page.getByRole("button", { name: /知道了|收下|舍此机缘|继续问道/ }).first();
      if (await ack.count()) await ack.click({ timeout: 800 }).catch(() => {});
      else await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(150);
    }
    const m = await page.evaluate(() => {
      const scenes = [...document.querySelectorAll("[data-scene-terrain]")].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      });
      return {
        scenes: scenes.length,
        terrains: Array.from(new Set(scenes.map((s) => s.getAttribute("data-scene-terrain")))).sort(
          (a, b) => (a ?? "").localeCompare(b ?? ""),
        ),
      };
    });
    rows.push({ route, ...m });
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n", "utf8");
  for (const r of rows)
    console.log(`${r.route}  scenes=${r.scenes}  ${r.terrains.join(",") || "-"}`);
  console.log(`\n→ ${OUT}`);
} finally {
  await browser.close();
}
