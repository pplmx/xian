/* oxlint-disable no-console -- 自检/出图脚本的产出就是给人看的报告 */
/**
 * 文档截图 —— 从当前构建里重新拍一套界面图,替换 README / docs 里的旧图。
 *
 * 用法:
 *   bun run build                     # 先有 dist
 *   bun scripts/shots.mjs             # 拍默认一套 → images/app/*.webp
 *   bun scripts/shots.mjs --theme dark
 *   bun scripts/shots.mjs --device desktop
 *   bun scripts/shots.mjs --out /tmp/shots
 *
 * 为什么单独一个脚本、而不是复用 layout-check 的 --shots:
 *   layout-check 的截图是**判据的副产品**(逐页巡页时顺手存),视角、主题、存档
 *   都由那条自检决定,拍出来的东西不为「给人看」服务;文档图要的是干净、有内容、
 *   构图一致的一套。两者目的不同,故各拍各的。
 *
 * 为何是 webp:同一张 780×1688 的界面图,PNG 约 0.5MB,webp 约 60KB —— README 一次
 * 挂十来张,差一个数量级。编码走浏览器自带的 canvas(Playwright 只出 png/jpeg,
 * 不想为此多引一个 ffmpeg 依赖),换机器照样能跑。
 *
 * 存档:默认用一份「展品档」夹具(真仙 · 成套装备 · 已营洞府 · 择定道途),
 * 见 lib/saveFixture.mjs —— 这样每张图里都有内容可看,而不是空档的 0/0。
 */
import { chromium } from "playwright";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { seedSave, showcaseSlices } from "./lib/saveFixture.mjs";
import { blockExternal } from "./lib/pageErrors.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = `file://${join(ROOT, "dist/index.html")}`;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const THEME = arg("theme", "light");
const DEVICE = arg("device", "phone");
const OUT = resolve(arg("out", join(ROOT, "images/app")));
const QUALITY = Number(arg("quality", "0.9"));

const DEVICES = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

/** 要拍的页面:路由 → 文件名。顺序即浏览顺序。 */
const SHOTS = [
  ["/", "home"],
  ["/cultivation", "cultivation"],
  ["/adventure", "adventure"],
  ["/inventory", "inventory"],
  ["/character", "character"],
  ["/codex", "codex"],
  ["/dongfu", "dongfu"],
  ["/world", "world"],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--allow-file-access-from-files", "--disable-web-security"],
});

/** 一张「画布页」:把截下来的 PNG 重新编码成 webp(Chromium 自带编码器) */
const canvasCtx = await browser.newContext();
const canvasPage = await canvasCtx.newPage();
await canvasPage.setContent('<canvas id="c"></canvas>');
async function toWebp(png, quality) {
  const b64 = await canvasPage.evaluate(
    async ({ data, q }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = "data:image/png;base64," + data;
      });
      const c = document.getElementById("c");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/webp", q).split(",")[1];
    },
    { data: png.toString("base64"), q: quality },
  );
  return Buffer.from(b64, "base64");
}

/** 拍一张并写成 webp,回报落盘后的字节数 */
async function shot(page, name) {
  const png = await page.screenshot();
  const webp = await toWebp(png, QUALITY);
  writeFileSync(join(OUT, `${name}.webp`), webp);
  console.log(`✓ ${name}.webp  ${(webp.length / 1024).toFixed(0)}KB`);
}

/** 干净取景:收掉提示条、钉死随机事件(引擎每秒掷一次,弹窗会入镜)、等动画与字体落定 */
async function clean(page) {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
    Math.random = () => 1;
  });
  for (let i = 0; i < 3; i += 1) {
    if ((await page.locator(".modal-panel").count()) > 0) await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const runs = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity);
    await Promise.all(runs.map((a) => a.finished.catch(() => {})));
  });
}

// ---- 一、欢迎页与建号页(不注入存档,走真实开局) ----
{
  const ctx = await browser.newContext(DEVICES[DEVICE]);
  await blockExternal(ctx);
  const page = await ctx.newPage();
  await page.goto(INDEX, { waitUntil: "load" });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, THEME);
  await page.waitForTimeout(1200);
  await clean(page);
  await shot(page, "welcome");

  await page
    .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
    .first()
    .click();
  await page.locator("input[type=checkbox]").first().check();
  await page
    .getByRole("button", { name: /同意并开始/ })
    .first()
    .click();
  await page.waitForTimeout(3400);
  await clean(page);
  await shot(page, "create");
  await ctx.close();
}

// ---- 二、注入展品档,逐页拍 ----
{
  const ctx = await browser.newContext(DEVICES[DEVICE]);
  await blockExternal(ctx);
  await seedSave(ctx, showcaseSlices(THEME));
  const page = await ctx.newPage();
  await page.goto(INDEX, { waitUntil: "load" });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, THEME);
  await page.waitForTimeout(1800);
  for (const [route, name] of SHOTS) {
    await page.goto(`${INDEX}#${route}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    await clean(page);
    await shot(page, name);
  }
  await ctx.close();
}

// ---- 三、宽幅题图:把场景画当底,用游戏自己的楷体重排标题 ----
/*
 * README 顶上那张横幅此前是外包画的、标题还停在旧名(云隐修仙录)。画本身留用,
 * 但标题必须由**游戏自己的字体与文案**画出来 —— 换名之后谁也不许再拿旧字当门面。
 * 做法:在 dist 里放一张临时页,链上产物 CSS(拿到 --font-kai 与字体子集,相对
 * 路径才对),底图指回仓库里的场景画,截完即删。
 */
async function banner() {
  const css = readdirSync(join(ROOT, "dist/assets")).find((f) => /^index-.*\.css$/.test(f));
  const kai = readdirSync(join(ROOT, "dist/assets")).find((f) => f.startsWith("lxgw-wenkai"));
  if (!css || !kai) throw new Error("dist/assets 里找不到产物 CSS 或楷体子集,先 bun run build");
  const art = join(ROOT, "images/app/scenery.webp");
  const tmp = join(ROOT, "dist/_banner.html");
  writeFileSync(
    tmp,
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="assets/${css}">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#f3efe4}
  .b{position:fixed;inset:0;background:url("file://${art}") center 38%/cover no-repeat}
  .b::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(243,239,228,.86),rgba(243,239,228,.42) 55%,rgba(243,239,228,.72))}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .t{font-family:var(--font-kai);font-size:180px;line-height:1;letter-spacing:.16em;color:#2b2723;text-indent:.16em;text-shadow:0 3px 30px rgba(243,239,228,.9)}
  .s{font-family:var(--font-kai);font-size:30px;letter-spacing:.55em;text-indent:.55em;color:#6f664f}
</style></head>
<body><div class="b"></div><div class="wrap"><div class="t">玄枢录</div><div class="s">玄之又玄 · 众妙之门</div></div></body></html>`,
  );
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 520 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`file://${tmp}`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await shot(page, "banner");
  await ctx.close();
  rmSync(tmp, { force: true });
}
await banner();

await canvasCtx.close();
await browser.close();
console.log(`\n出图完成 → ${OUT}(主题 ${THEME} / 设备 ${DEVICE})`);
