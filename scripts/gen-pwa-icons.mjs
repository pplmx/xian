/**
 * PWA 图标生成 —— 从矢量源 public/icon[-maskable].svg 光栅化出各平台的 PNG。
 *
 * 用法: bun scripts/gen-pwa-icons.mjs   (或 node scripts/gen-pwa-icons.mjs)
 * 产物:
 *   public/icons/icon-192.png          web app manifest(常规)
 *   public/icons/icon-512.png          web app manifest(常规)
 *   public/icons/icon-maskable-512.png web app manifest(maskable,全出血+安全区)
 *   public/apple-touch-icon.png        iOS「添加到主屏幕」(180×180,无透明)
 *
 * ## 为什么走浏览器
 *
 * 本脚本早先 `import sharp`,而 sharp 从未写进 package.json / bun.lock —— 本机
 * 因残留的全局安装能跑通,干净 clone 上这条命令直接 Cannot find package,而文档
 * (docs/deployment.md)还把它写成「改图标的正确姿势」,等于指向一条走不通的路。
 * 现改用仓里已有的 Playwright/Chromium:SVG 走 data URL 解码 + canvas 高质量缩放,
 * PNG 由它编码 —— 与 scripts/favicon.mjs 出 .ico 是同一套办法,不为图标另引图像库。
 * (守卫见 src/core/scriptDepsAudit.spec.ts:脚本里的第三方依赖必须声明。)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "../public");
const iconsDir = resolve(pub, "icons");

await mkdir(iconsDir, { recursive: true });

/** maskable 出图先铺底色:apple-touch-icon 必须不透明(iOS 会把透明处合成黑色) */
const PAPER = "#F3EFE4";

const jobs = [
  { src: "icon.svg", out: resolve(iconsDir, "icon-192.png"), size: 192 },
  { src: "icon.svg", out: resolve(iconsDir, "icon-512.png"), size: 512 },
  { src: "icon-maskable.svg", out: resolve(iconsDir, "icon-maskable-512.png"), size: 512 },
  {
    src: "icon-maskable.svg",
    out: resolve(pub, "apple-touch-icon.png"),
    size: 180,
    background: PAPER,
  },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const job of jobs) {
    const svg = await readFile(resolve(pub, job.src), "utf8");
    // SVG 走 data URL 进浏览器:纯矢量几何(无字体依赖),Chromium 的栅格化稳定可复现
    const b64 = Buffer.from(svg, "utf8").toString("base64");
    const png = await page.evaluate(
      async ({ dataUrl, size, background }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, size, size);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, size, size);
        const url = canvas.toDataURL("image/png");
        return url.slice(url.indexOf(",") + 1);
      },
      { dataUrl: `data:image/svg+xml;base64,${b64}`, size: job.size, background: job.background },
    );
    await writeFile(job.out, Buffer.from(png, "base64"));
    console.log(`  ${job.out.replace(here + "/", "")}  (${job.size}×${job.size})`);
  }
} finally {
  await browser.close();
}
console.log("PWA icons generated.");
