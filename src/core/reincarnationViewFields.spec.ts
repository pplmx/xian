/**
 * `ReincarnationView` 上两个没人读的字段 —— 而其中一个重复了别处已有的信息。
 *
 * ## 由来（第 214 轮，沿用上一轮「用类型定义作事实源」）
 *
 * 上一轮查 `CombatSideStats` 时用的口径是「类型上的每个字段都要有去处」。
 * 这一轮把它用到 4 个 `*View` 接口上，扫出两个:
 *
 * ```text
 * ReincarnationView.prevRealmLabel   赋值 1 处（core/reincarnation.ts:176），读取 0 处
 * ReincarnationView.stageId          赋值 1 处（core/reincarnation.ts:179），读取 0 处
 * ```
 *
 * 而同组的其余字段都是活的:
 *
 * ```text
 * stageName      界面读 7 处
 * stageDesc      界面读 1 处
 * stageAdvanced  界面读 1 处
 * ```
 *
 * ## 其中 `prevRealmLabel` 更值得记
 *
 * 界面读的是 `view.review.realmLabel`（在 `LifeReview` 里）—— 同一个事实，
 * 两处都有。而顶层的那个没人读。
 *
 * 这正是这个仓库反复踩的那种:**同一个事实有两个出处**。今天两边一致，
 * 明天有人改了 `LifeReview.realmLabel` 的取法（比如加上世界名），
 * 顶层的那个就悄悄过期，而没有任何判据会红。
 *
 * ## 这条判据守什么
 *
 * 两个字段都不许再被**赋值而不被读**:
 *
 * ① 若保留 —— 那就要么有人读，要么在类型上标注它是「给未来的」并写清原因;
 * ② 更稳妥的一条:它们不许继续留在 view 上。
 *
 * 本判据取 ② 的弱化版:**不许有「只在 core 里赋值、界面上零读取」的字段**。
 * 这一条同时防住未来新增的同类字段。
 *
 * ## 故障注入
 *
 * 往 `ReincarnationView` 加一个没人读的 `probeDeadField: string` → 第二条红，点名它。
 * （删掉 `prevRealmLabel` / `stageId` 之前，第二条红的正是那两个。）
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const TYPES = "src/types/index.ts";

/** 从某个 View 接口里取出字段名 */
function viewFields(iface: string): string[] {
  const src = stripComments(readSource(TYPES));
  const at = src.indexOf(`interface ${iface}`);
  expect(at, `找不到 ${iface}`).toBeGreaterThan(-1);
  const open = src.indexOf("{", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, `${iface} 没闭合`).toBeGreaterThan(open);
  return [...src.slice(open, end).matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]!);
}

/**
 * 注意:`value.field` 这种读法才算「被读」。
 * 若某字段只被写（`field: xxx`）而不被读，那它就是死数据。
 */
function readCount(field: string): number {
  const re = new RegExp(`\\.${field}\\b`, "g");
  let n = 0;
  for (const f of walkFiles("src", isSourceFile)) {
    // 类型定义自己不算读
    if (f.endsWith("types/index.ts")) continue;
    n += (stripComments(readSource(f)).match(re) ?? []).length;
  }
  return n;
}

describe("轮回界面 · 不许有「赋值了没人读」的字段", () => {
  it("判据的前提还在 —— 那个接口与它的活字段", () => {
    const fields = viewFields("ReincarnationView");
    expect(fields.length, "接口字段太少 —— 扫错地方了").toBeGreaterThan(8);
    // 同组里这三个是活的，作为基准
    for (const f of ["stageName", "stageDesc", "stageAdvanced"]) {
      expect(readCount(f), `${f} 也没人读了 —— 判据的前提变了`).toBeGreaterThan(0);
    }
  });

  it("每个字段都有人读", () => {
    const dead = viewFields("ReincarnationView").filter((f) => readCount(f) === 0);
    expect(
      dead,
      "这些字段在 view 上，却没有任何界面读它 —— 算出来、递过去、然后丢掉。" +
        "（其中 `prevRealmLabel` 还与 `review.realmLabel` 说的是同一件事:" +
        "同一个事实有两个出处，哪天改了一处，另一处就悄悄过期）:" +
        dead.join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出「没人读」的字段（地基）", () => {
    // stageName 是活的，随便编一个名字是死的
    expect(readCount("stageName"), "认不出活字段").toBeGreaterThan(0);
    expect(readCount("noSuchFieldAnywhere"), "认不出死字段").toBe(0);
  });
});
