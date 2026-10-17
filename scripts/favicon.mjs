/* oxlint-disable no-console -- 生成脚本的产出就是给人看的报告 */
/**
 * favicon 生成 —— 从 128 母图缩出 16/32/48 三个条目,装成一枚 .ico
 *
 * ## 为什么要这个脚本
 *
 * `public/favicon.ico` 曾经是**单条 256×256 的 PNG**,130 KB。而浏览器标签页
 * 只会用 16(以及高分屏的 32)那一档 —— 256 那张从来没被画出来过,却要跟着
 * 每一次冷启动走一遍网络。ICO 里塞 256 是「图标包里放了一张原图」,
 * 不是「favicon 需要 256」。
 *
 * ## 母图就是安装图标那一枚
 *
 * 标签页图标此前是一幅**写意山水**(山涧、瀑布、崖上的人),与 PWA 安装图标
 * (`public/icons/icon-512.png` 的平涂山月)、`apple-touch-icon.png` 都不是同一张画 ——
 * 浏览器里一枚、装到桌面是另一枚。而且那幅画在 16px 下糊成一团暖色的雾,
 * 标签页里根本读不出画的是什么。
 *
 * 现在统一从 `icon-512.png` 派生:标签页、桌面快捷方式、安装图标是同一枚。
 * 判据见 src/ui/favicon.spec.ts —— 连「生成器读的是不是这一张」与「两者主色是否
 * 同一个东西」都核。
 *
 * ## 用法
 *
 *   bun run build:favicon        # 读 public/icons/icon-512.png
 *
 * 换画就换那张母图再重跑,别手工改 .ico —— 判据见 src/ui/favicon.spec.ts:
 * 条目只许 16/32/48,体积不许超预算。
 *
 * ## 为什么走浏览器
 *
 * 仓里没有 sharp / jimp / PIL,也不想为一个图标引一个图像库。Chromium 本来就在
 * (Playwright,截图与排版自检都在用),它的 canvas 缩图带高质量的重采样;
 * PNG 编码也由它出。这与 scripts/shots.mjs 编 webp 是同一套办法。
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "public/icons/icon-512.png");
const OUT = join(ROOT, "public/favicon.ico");
/** 标签页 16、高分屏 32、桌面「大图标」48 —— 再大就没有调用方了 */
const SIZES = [16, 32, 48];

/**
 * 装 ICO 容器。
 *
 * 布局是微软那套:6 字节目录头 + 每张 16 字节目录项 + 各自的数据块。
 * 宽高字段 1 字节,`0` 代表 256(这里用不到,但写清楚免得以后加 256 时踩坑)。
 * 数据块直接用 PNG —— Vista 之后的浏览器都认,不必写老式 BMP + AND 掩码。
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // 调色板色数:0 = 真彩
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const source = readFileSync(SOURCE).toString("base64");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const images = await page.evaluate(
    async ({ src, sizes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const out = [];
      for (const size of sizes) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/png");
        out.push({ size, b64: dataUrl.slice(dataUrl.indexOf(",") + 1) });
      }
      return out;
    },
    { src: source, sizes: SIZES },
  );
  const ico = buildIco(images.map((i) => ({ size: i.size, png: Buffer.from(i.b64, "base64") })));
  writeFileSync(OUT, ico);
  for (const i of images) {
    console.log(`  ${i.size}×${i.size}  ${Buffer.from(i.b64, "base64").length} B`);
  }
  console.log(`✓ favicon.ico  ${ico.length} B  ← ${SIZES.join(" / ")}`);
} finally {
  await browser.close();
}
