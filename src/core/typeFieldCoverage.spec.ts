/**
 * 类型上的字段，要么有人读，要么登记在「预留」里。
 *
 * ## 由来（第 215 轮，沿用前两轮那个口径）
 *
 * 前两轮用「类型定义作事实源」各查出一批（`CombatSideStats` 的展示、`ReincarnationView`
 * 的两个死字段）。这一轮把它推广到 `src/types/index.ts` 的**全部 69 个接口、521 个字段**:
 *
 * ```text
 * RegionRecall.since        赋值（deriveProsperity）但不读
 * NemesisRecord.lastLossAt  赋值（worldMemory 三处）但不读，也不参与排序
 * Loadout.savedAt           赋值（loadoutService）但不读
 * ```
 *
 * 521 里只有这 3 个 —— 覆盖面本身很干净。但它们是同一个形状:
 * **算出来、存进去、然后谁也不要。**
 *
 * ## 为什么不一律删除
 *
 * `RegionRecall.since` 与另外两个不同:它有明确的语义（「本次状态自何时起」），
 * 只是还没有界面用它。删掉它会让「这一档还能持续多久」这件事将来无处安放。
 *
 * 故判据给两条路:**要么有人读，要么登记在 `RESERVED` 里并写明原因。**
 * 名单不常驻 —— 一旦有人接上，这条会红，提醒销账。
 *
 * ## 判据口径
 *
 * 「被读」认 `.field` 这种写法。`field: value` 是**写**，不算。
 * `types/index.ts` 自己不算（那是声明，不是消费）。
 *
 * ## 故障注入
 *
 * 往 `NemesisRecord` 加一个 `probeDead: number` 并在 `makeNemesis` 里赋上值 →
 * 「每个只写不读的字段都在 RESERVED 里」红，点名 `NemesisRecord.probeDead`。
 * 给 `RegionRecall.since` 接上一个消费者 → 「RESERVED 里的每条都还真的没人读」红（该销账）。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const TYPES = "src/types/index.ts";

/**
 * 预留字段 —— 有语义、将来要用，但此刻没有消费者。
 *
 * 留一条就要写明**为什么留**与**谁将来会读**。
 */
const RESERVED = new Map<string, string>([
  [
    "RegionRecall.since",
    "「本次状态自何时起」。有语义（这一档繁盛/混乱从哪天开始），暂未上界面；" +
      "将来若做「这一档还能持续多久」会读它",
  ],
]);

/** 取出某个接口的全部字段名（含可选标记） */
function fieldsOf(src: string, iface: string): string[] {
  const at = src.indexOf(`export interface ${iface}`);
  if (at < 0) return [];
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
  if (end < 0) return [];
  return [...src.slice(open, end).matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]!);
}

describe("类型字段 · 要么有人读，要么登记为预留", () => {
  it("扫到了足够多的接口与字段（防空转）", () => {
    const src = stripComments(readSource(TYPES));
    const ifaces = [...src.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]!);
    expect(ifaces.length, "接口太少 —— 扫错地方了").toBeGreaterThan(30);
    const total = ifaces.reduce((n, i) => n + fieldsOf(src, i).length, 0);
    expect(total, "字段太少 —— 扫错地方了").toBeGreaterThan(200);
  });

  it("每个只写不读的字段都在 RESERVED 里，且写了原因", () => {
    const src = stripComments(readSource(TYPES));
    const ifaces = [...src.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]!);

    /* 全仓生产代码（除类型文件自己） */
    let corpus = "";
    for (const f of walkFiles("src", isSourceFile)) {
      if (f.endsWith("types/index.ts")) continue;
      corpus += stripComments(readSource(f)) + "\n";
    }

    const dead: string[] = [];
    for (const iface of ifaces) {
      for (const field of fieldsOf(src, iface)) {
        const key = `${iface}.${field}`;
        if (RESERVED.has(key)) continue;
        // 只写不读：语料里有 `field:` 或 `field =`，但没有 `.field`
        const written = new RegExp(`\\b${field}\\s*[:=]`).test(corpus);
        const read = new RegExp(`\\.${field}\\b`).test(corpus);
        if (written && !read) dead.push(key);
      }
    }

    expect(
      dead,
      "这些字段写进了对象，却没有任何人读 —— 算出来、存进去、然后谁也不要。" +
        "要么接上一个消费者，要么删掉；确有理由先留的，登记进 RESERVED 并写明原因:" +
        dead.join(" / "),
    ).toEqual([]);
  });

  it("RESERVED 里的每条都还真的没人读（接上了就该销账）", () => {
    let corpus = "";
    for (const f of walkFiles("src", isSourceFile)) {
      if (f.endsWith("types/index.ts")) continue;
      corpus += stripComments(readSource(f)) + "\n";
    }
    const nowRead = [...RESERVED.keys()].filter((key) => {
      const field = key.split(".")[1]!;
      return new RegExp(`\\.${field}\\b`).test(corpus);
    });
    expect(
      nowRead,
      "这些预留字段已经有人读了 —— 把它们从 RESERVED 里删掉（名单不常驻）:" + nowRead.join(" / "),
    ).toEqual([]);
  });

  it("RESERVED 的每一条都写了原因", () => {
    for (const [key, why] of RESERVED) {
      expect(why.length, `${key} 没写为什么留`).toBeGreaterThan(10);
    }
  });
});
