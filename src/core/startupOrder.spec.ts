/**
 * 启动顺序 —— 先抢写者席位,再碰盘。
 *
 * ## 守的是什么
 *
 * `main.ts` 的头三步有严格先后:
 *
 * ```js
 * const isSaveWriter = await acquireSaveWriterRole();   // ① 抢席位
 * if (!isSaveWriter) blockSaveWrites();                  // ② 抢不到就切成只读
 * const corrupted = isSaveWriter ? prepareLocalSave() : []; // ③ 只有写者才碰盘
 * ```
 *
 * 顺序反了会出真事:`prepareLocalSave()` 会**搬旧前缀、隔离坏档、升级结构**,
 * 全是写盘动作。如果它排在 ② 之前,只读页(另一处已经开着游戏)会跟着改盘 ——
 * 两个页面各自认"我是写者",后写的那份把另一页的进度盖回去。
 * 这正是 `core/singleWriter` 整个模块存在的原因。
 *
 * ## 为什么此前没人守
 *
 * `singleWriter.spec` 测的是"抢席位这个动作对不对",`storage.spec` 测的是
 * "prepareLocalSave 做没做对" —— 两边各自都是绿的,而**它们之间的先后**
 * 没有任何判据看。把 ③ 挪到 ② 前面,两边的用例照样全过。
 *
 * 判据用**位置比较**而不是正则匹配某一行:三条语句谁在前谁在后,是这段启动序列
 * 唯一要保证的性质,其余细节(怎么调用、返回值怎么用)由各自的用例管。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MAIN = readFileSync(join(ROOT, "src/main.ts"), "utf-8");

/** 去掉注释后再比 —— 注释里会引用这几步,不剥会被自己的文档绊到 */
const CODE = MAIN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const at = (needle: string): number => CODE.indexOf(needle);

describe("启动顺序 · 先抢写者席位,再碰盘", () => {
  it("三步都在 —— 判据的前提还在", () => {
    // 防空转:任何一条被改名或删掉,后面的位置比较都会退化成 -1 比 -1
    expect(at("acquireSaveWriterRole("), "main.ts 里找不到抢席位那一步").toBeGreaterThan(0);
    expect(at("blockSaveWrites("), "main.ts 里找不到切成只读那一步").toBeGreaterThan(0);
    expect(at("prepareLocalSave("), "main.ts 里找不到改动磁盘那一步").toBeGreaterThan(0);
  });

  it("抢席位在切只读之前", () => {
    expect(
      at("acquireSaveWriterRole("),
      "acquireSaveWriterRole 排在了 blockSaveWrites 之后 —— 只读页会先跑一段写逻辑",
    ).toBeLessThan(at("blockSaveWrites("));
  });

  it("切只读在碰盘之前 —— 这一条最要紧", () => {
    /*
     * 反了的话,只读页会跟着搬前缀/隔离坏档/升级结构。而两个页面同时开着时,
     * 后写的那份会把另一页的进度盖回去 —— 玩家看到的是"我在 A 页练的功没了"。
     */
    expect(
      at("blockSaveWrites("),
      "blockSaveWrites 排在了 prepareLocalSave 之后 —— 只读页会跟着改盘," +
        "而它本该一个字节都不碰",
    ).toBeLessThan(at("prepareLocalSave("));
  });

  it("改动磁盘那一步有写者判断 —— 不是无条件执行", () => {
    /*
     * 即便顺序对了,若 `prepareLocalSave()` 被写成无条件调用(去掉三元),
     * 只读页照样会写盘。这条守的是那个 `isSaveWriter ?` 守卫本身。
     */
    const line = CODE.split("\n").find((l) => l.includes("prepareLocalSave(")) ?? "";
    expect(line, "prepareLocalSave 是无条件调用的 —— 只读页也会写盘").toMatch(/isSaveWriter\s*\?/);
  });
});
