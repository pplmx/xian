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
 * 除逐页界面图外,还产出:宽幅题图 banner.webp(场景画当底 + 游戏自己的楷体重排标题)
 * 与配色卡 palette.webp(直读 style.css 的 --color-*-rgb,给 design.md 用)。
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
async function shot(page, name, opts = {}) {
  const png = await page.screenshot(opts);
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

// ---- 四、配色卡:把 style.css 的色票画成一张图,给 docs/design.md 用 ----
/*
 * 色值不在这里重写一遍 —— 页面直接读运行时的 --color-*-rgb。
 * 「两本账」是文档最会锈的地方:改了 style.css 而配色卡忘改,读者先信哪一份?
 * 读同一份变量就没有这个问题。
 */
async function palette() {
  const css = readdirSync(join(ROOT, "dist/assets")).find((f) => /^index-.*\.css$/.test(f));
  if (!css) throw new Error("dist/assets 里找不到产物 CSS,先 bun run build");
  const tmp = join(ROOT, "dist/_palette.html");
  writeFileSync(
    tmp,
    [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<link rel="stylesheet" href="assets/' + css + '">',
      "<style>",
      "*{box-sizing:border-box}html,body{margin:0;background:#f3efe4}",
      ".page{padding:46px 54px}",
      "h1{font-family:var(--font-kai);font-size:42px;letter-spacing:.22em;color:#2b2723;margin:0 0 8px}",
      ".sub{font-size:15px;color:#6f664f;letter-spacing:.05em;margin:0 0 32px}",
      ".theme{margin:0 0 34px}",
      ".theme h2{font-family:var(--font-kai);font-size:22px;letter-spacing:.2em;color:#4a463d;margin:0 0 16px;padding-left:12px;border-left:4px solid #a83f39}",
      ".group{margin:0 0 12px}",
      ".glabel{font-size:13px;letter-spacing:.24em;color:#8a8270;margin:0 0 8px}",
      ".row{display:flex;flex-wrap:wrap;gap:10px}",
      ".chip{width:132px;height:92px;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 4px rgba(41,39,34,.14)}",
      ".chip .n{font-size:13px;letter-spacing:.04em}.chip .x{font-size:12px;opacity:.82;font-variant-numeric:tabular-nums}",
      '</style></head><body><div class="page">',
      "<h1>丹青 · 配色</h1>",
      '<p class="sub">色值直读 src/style.css 的 --color-*-rgb —— 界面用哪一份,这里就是哪一份。</p>',
      '<div id="root"></div></div></body></html>',
    ].join("\n"),
  );
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`file://${tmp}`, { waitUntil: "load" });
  // 等样式表应用与楷体落定,再读变量 —— 否则读到的全是空串
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    (GROUPS) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      const root = document.getElementById("root");
      for (const th of [
        ["日间", "light"],
        ["夜间", "dark"],
      ]) {
        document.documentElement.dataset.theme = th[1];
        const cs = getComputedStyle(document.documentElement);
        const sec = document.createElement("section");
        sec.className = "theme";
        const h = document.createElement("h2");
        h.textContent = th[0];
        sec.appendChild(h);
        for (const grp of GROUPS) {
          const wrap = document.createElement("div");
          wrap.className = "group";
          const gl = document.createElement("div");
          gl.className = "glabel";
          gl.textContent = grp.title;
          wrap.appendChild(gl);
          const row = document.createElement("div");
          row.className = "row";
          for (const key of grp.keys) {
            const raw = cs
              .getPropertyValue("--color-" + key + "-rgb")
              .trim()
              .split(/\s+/)
              .map(Number);
            if (raw.length < 3 || raw.some((v) => Number.isNaN(v))) continue;
            const chip = document.createElement("div");
            chip.className = "chip";
            chip.style.background = "rgb(" + raw.join(",") + ")";
            chip.style.color = lum(raw) > 0.42 ? "#2b2723" : "#f6f1e5";
            const n = document.createElement("div");
            n.className = "n";
            n.textContent = key;
            const x = document.createElement("div");
            x.className = "x";
            x.textContent = "#" + raw.map((v) => v.toString(16).padStart(2, "0")).join("");
            chip.appendChild(n);
            chip.appendChild(x);
            row.appendChild(chip);
          }
          wrap.appendChild(row);
          sec.appendChild(wrap);
        }
        root.appendChild(sec);
      }
      document.documentElement.dataset.theme = "light";
    },
    [
      { title: "底", keys: ["paper", "paper-deep", "paper-dark", "paper-lifted"] },
      { title: "墨(正文)", keys: ["ink", "ink-soft", "ink-faint"] },
      { title: "主色 · 朱砂", keys: ["cinnabar", "cinnabar-deep"] },
      { title: "次色 · 石青", keys: ["qing", "cangqing", "tianqing"] },
      {
        title: "诸色",
        keys: [
          "jade",
          "gold-ink",
          "amber-ink",
          "violet-ink",
          "indigo-ink",
          "zheshi",
          "tenghuang",
          "bise",
          "he",
        ],
      },
    ],
  );
  await page.waitForTimeout(400);
  await shot(page, "palette", { fullPage: true });
  await ctx.close();
  rmSync(tmp, { force: true });
}
await palette();

await canvasCtx.close();
await browser.close();
console.log(`\n出图完成 → ${OUT}(主题 ${THEME} / 设备 ${DEVICE})`);
