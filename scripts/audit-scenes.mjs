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

/**
 * 主页面清单 —— 与 mastheadScene.spec 的「该有画的页」对齐,只多不少。
 *
 * `stable` 说的是**这条路由的地形是不是每次都一样**,不是「这页有没有画」:
 *
 *   · 大多数页的取景来自固定身份(世界的底子、页签、某一处地界的定义),
 *     同一份存档每次跑都是同一片地;
 *   · `/world` 与 `/adventure` 的取景读 `adventure.currentRegion?.icon` ——
 *     会话没定下来时退回「本世第一个地界」,而那一处由世界生成决定。
 *     实测连跑三次得 peaks / forest / ruin 三种 —— 故标 false。
 *
 * 标这一栏的理由很实际:这份 JSON 是要提交进仓库当判据输入的。
 * 若不区分,提交的就是一个随机快照,下一个人重跑总会看到不一样的 diff,
 * 而没人能说清哪份对。
 */
const ROUTES = [
  { path: "/", stable: true },
  { path: "/cultivation", stable: true },
  { path: "/world", stable: false },
  { path: "/adventure", stable: false },
  { path: "/character", stable: true },
  { path: "/inventory?tab=equip", stable: true },
  { path: "/collection?tab=collection", stable: true },
  { path: "/celestial", stable: true },
  { path: "/titles", stable: true },
  { path: "/dongfu", stable: true },
  { path: "/legacy", stable: true },
  { path: "/codex", stable: true },
  { path: "/market", stable: true },
  { path: "/apprentice", stable: true },
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
  for (const { path: route, stable } of ROUTES) {
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
      /*
       * 除了「有没有」,还记「多大」。
       *
       * 判据只看场数时,一处画被压成 20px 的窄条也算「有画」——那和没有差不多。
       * 记下最小可见高度,下一轮要收紧时就有依据,而不是凭印象说「这一处太薄」。
       */
      const heights = scenes.map((e) => Math.round(e.getBoundingClientRect().height));
      return {
        scenes: scenes.length,
        terrains: Array.from(new Set(scenes.map((s) => s.getAttribute("data-scene-terrain")))).sort(
          (a, b) => (a ?? "").localeCompare(b ?? ""),
        ),
        minH: heights.length ? Math.min(...heights) : 0,
      };
    });
    rows.push({ route, ...m, stable });
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n", "utf8");
  for (const r of rows)
    console.log(
      `${r.route}  scenes=${r.scenes}  minH=${r.minH}  ${r.stable ? "稳定" : "随生成"}  ${r.terrains.join(",") || "-"}`,
    );
  console.log(`\n→ ${OUT}`);
} finally {
  await browser.close();
}
