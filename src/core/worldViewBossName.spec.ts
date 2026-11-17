/**
 * 世界视图里的首领名，不许是内部 id。
 *
 * ## 由来（第 463 轮）
 *
 * `worldView(w, bossNameOf, isCleared)` 的第二个参数是**解析器**。两处调用：
 *
 * ```text
 *   MortalWorldView.vue:397   worldView(w, (id) => enemyDef(id)?.name ?? id, cleared)  ← 正确
 *   AdventureView.vue:1166    worldView(w, (id) => id)                                 ← 恒等函数
 * ```
 *
 * 当时历练页那个恒等函数**没有造成任何可见问题** —— `MortalWorldRibbon` 只读
 * `place.name` 与位置，`bossName` 一个地方都没消费。
 *
 * 但它是一颗定时炸弹：哪天有人在行旅条里加一句「此去守关者：{{ place.bossName }}」，
 * 历练页会直接印出 `e_bwking`。而世界页从头就是解析过的 —— **同一个函数、
 * 两处传法不同，正是「两本账」的起点**。
 *
 * ## 判据
 *
 * ① 传给 `worldView` 的解析器必须真的解析 —— 不许出现恒等函数；
 * ② 反差：世界页那份必须仍然解析（防止有人「统一」成恒等）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const VIEWS = ["src/views/MortalWorldView.vue", "src/views/AdventureView.vue"];

describe("世界视图 · 首领名必须是解析过的", () => {
  it("① 两处 worldView 调用的解析器都真的解析，不用恒等函数", () => {
    const bad: string[] = [];
    for (const rel of VIEWS) {
      /*
       * 去掉注释再扫 —— 本文件与源码里都会**引用**那句旧写法来说明问题，
       * 而引用不是调用（第 445 轮踩过同一个坑：判据把「引用」当成了「声称」）。
       */
      const raw = readFileSync(resolve(ROOT, rel), "utf-8");
      const src = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      /*
       * 找 `worldView(w, <第二参数>` —— 只看第二参数的开头一小段，
       * 因为解析器是一行的箭头函数。
       */
      /*
       * 直接找**恒等函数本身**，而不是先切参数再判——
       * 初版用 `[^,)]+` 切第二参数，被 `(id)` 的括号截断成 `(id`，
       * 于是注入恒等函数之后判据仍然全绿（第 463 轮实测）。
       */
      for (const m of src.matchAll(/worldView\(\s*w\s*,\s*(\(id\)\s*=>\s*id)\s*\)/g)) {
        bad.push(`${rel}: worldView(w, ${m[1]}) —— 首领名会原样印出 id`);
      }
    }
    expect(bad, "这个解析器没有解析 —— 界面会印出 e_bwking 这类内部 id：" + bad.join("；")).toEqual(
      [],
    );
  });

  it("② 反差：世界页那份解析器必须仍然解析（不许被「统一」成恒等）", () => {
    const src = readFileSync(resolve(ROOT, "src/views/MortalWorldView.vue"), "utf-8");
    expect(src, "世界页的解析器丢了 —— 那是最早正确的那一处").toMatch(
      /worldView\(\s*w\s*,\s*\(id\)\s*=>\s*enemyDef\(id\)\?\.name\s*\?\?\s*id/,
    );
  });
});
