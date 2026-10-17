/**
 * 标签页图标判据
 *
 * favicon 是**每次冷启动都要走一遍网络**的那一枚,而它的调用方只有一处:
 * 浏览器标签页 —— 16px,高分屏 32px。桌面快捷方式的 48px 是最后一档。
 * 再往上是安装图标的事,归 manifest 的 `icons` 管(192 / 512 / maskable),两条线。
 *
 * 这条边界原先没守住:`public/favicon.ico` 里塞的是**单条 256×256 的 PNG**,
 * 130 KB。256 那张从来没被画出来过 —— 它既不在标签页的取用范围内,
 * 也不在安装图标的清单里,纯粹是「图标包里放了一张原图」。
 *
 * 判据盯四件事:
 *   一 尺寸集合:只许 16/32/48。多出来的条目不是"更周全",是白搭的字节。
 *   二 体积预算:超了就说明有人又把大图塞回来了。
 *   三 目录自洽:每条声明的字节数与偏移都落在文件里(手工改 .ico 最容易坏在这)。
 *   四 引用不悬空:index.html 与 manifest 点名的图标都真的存在 ——
 *      改文件名而忘了改引用,浏览器只会在控制台留一行 404,界面看不出问题。
 */
import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const ICO = readFileSync(resolve(ROOT, "public/favicon.ico"));
const INDEX_HTML = readFileSync(resolve(ROOT, "index.html"), "utf-8");
const MANIFEST = JSON.parse(
  readFileSync(resolve(ROOT, "public/manifest.webmanifest"), "utf-8"),
) as { icons: { src: string }[] };

/** 只许这几档 —— 标签页要的那两三档 */
const ALLOWED = new Set([16, 32, 48]);
/** 预算:当前实测约 10 KB(写实插画的 PNG 压不了多少),留一倍余量 */
const BUDGET = 24 * 1024;

interface Entry {
  size: number;
  bytes: number;
  offset: number;
}

function entries(): Entry[] {
  const count = ICO.readUInt16LE(4);
  const out: Entry[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 16;
    // 宽高各占 1 字节,0 代表 256 —— 正是这条格式约定让人误以为"该放 256"
    out.push({
      size: ICO.readUInt8(at) || 256,
      bytes: ICO.readUInt32LE(at + 8),
      offset: ICO.readUInt32LE(at + 12),
    });
  }
  return out;
}

describe("favicon · 只装标签页用得着的几档", () => {
  it("确实是 ICO,且有条目(否则下面的判据在替一个空壳站岗)", () => {
    expect(ICO.readUInt16LE(0)).toBe(0);
    expect(ICO.readUInt16LE(2)).toBe(1);
    expect(entries().length).toBeGreaterThanOrEqual(3);
  });

  it("条目尺寸只许 16 / 32 / 48 —— 256 那档没有任何调用方", () => {
    expect(
      entries()
        .map((e) => e.size)
        .sort((a, b) => a - b),
    ).toEqual([...ALLOWED]);
  });

  it("体积在预算里", () => {
    // 130 KB 的那一版就是从这里漏过去的:没有预算,谁也说不清多少算大
    expect(ICO.length, `favicon.ico 已经 ${ICO.length} B`).toBeLessThanOrEqual(BUDGET);
  });

  it("每条的字节区间都落在文件里", () => {
    for (const e of entries()) {
      expect(e.offset + e.bytes, `${e.size}px 那条越界了`).toBeLessThanOrEqual(ICO.length);
      // PNG 签名:生成器统一走 PNG 条目,不写老式 BMP + AND 掩码
      expect(ICO.subarray(e.offset, e.offset + 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });
});

describe("favicon · 引用不悬空", () => {
  it("index.html 点的图标都在", () => {
    const refs = [...INDEX_HTML.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g)].map(
      (m) => /href="\.\/([^"]+)"/.exec(m[0])?.[1] ?? "",
    );
    expect(refs.length).toBeGreaterThanOrEqual(2);
    for (const ref of refs) {
      expect(existsSync(resolve(ROOT, "public", ref)), `index.html 点的 ./${ref} 不存在`).toBe(
        true,
      );
    }
  });

  it("manifest 的安装图标都在,且都够大", () => {
    expect(MANIFEST.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of MANIFEST.icons) {
      const path = resolve(ROOT, "public", icon.src.replace("./", ""));
      expect(existsSync(path), `manifest 点的 ${icon.src} 不存在`).toBe(true);
      // 安装图标是另一条线:最小边至少 192,别拿标签页那张小图顶替
      const png = readFileSync(path);
      expect(png.subarray(1, 4).toString(), `${icon.src} 不是 PNG`).toBe("PNG");
      const side = Math.min(png.readUInt32BE(16), png.readUInt32BE(20));
      expect(side, `${icon.src} 只有 ${side}px`).toBeGreaterThanOrEqual(192);
    }
  });
});
