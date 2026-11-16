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

/**
 * 另一半:**从没被写过**的字段。
 *
 * ## 缺口(第 414 轮)
 *
 * 上面那条判据问的是「写进去了却没人读」——`written && !read`。
 * 而 `LifeRecord.bond` 是另一种:`written` 与 `read` **都是假** ——
 * 它有一个字段声明与一句注释,却既没有赋值点也没有消费者。
 *
 * 查下去发现那段注释说的是「本世的关系结局(Phase 33.8);未遇见任何人为 null」——
 * 听起来像实现了。而道侣结局实际走的是另一条路:`archiveBond()` → `player.recordBond()`
 * → `BondDialog` 的「历世同行」那一节。**同一个信息有出口,而这个字段是那次重构留下的壳。**
 *
 * 故判据从两条变三条:
 *
 * ```text
 *   写的有人读      written && read      原先那条
 *   写进去没人读    written && !read     原先那条
 *   从没写过        !written && !read    ← 本轮补的
 * ```
 *
 * ## 为什么「从没写过」不等于「该删」
 *
 * 有些字段是**外部数据**的镜像(从存档、从内容表读进来),本仓代码不写它。
 * 那些不能按这条判。故这条只对 `types/index.ts` 里的**运行时状态**接口生效 ——
 * 而那个文件里全是运行时结构,没有内容表。
 */
/**
 * `data/` 里的**运行时状态**接口 —— 它们与 `types/index.ts` 同性质（会被 seq 化进存档、
 * 逐字段读写），而上面两条判据只扫了 types，于是 `LifeRecord.bond` 藏在这里。
 *
 * 只收这四个：`data/` 下其余接口都是**内容表**（静态声明，字段本来就由 UI 直接取）。
 * 名单是穷举的、不是猜想 —— 判据要求每个都真的存在，改名或删掉会红。
 */
const DATA_STATE_INTERFACES = [
  ["src/data/samsara.ts", "LifeRecord"],
  ["src/data/samsara.ts", "LifeVow"],
  ["src/data/lifeTrials.ts", "LifeTrialState"],
  ["src/data/souls.ts", "SoulInstance"],
] as const;

/**
 * **同名字段跨接口误命中** —— 这条判据的固有局限，写在这里免得下一个人以为它万能。
 *
 * `LifeRecord.bond` 与 `BondState.bond`（`player.bond`）同名字段。第 414 轮删掉
 * `LifeRecord.bond` 时，把「谁在读 `.bond`」这件事查了一遍：**19 处命中里有 18 处
 * 是 `BondState` 那一侧，还有一处是 CSS 类名 `.bond-scene`。**
 *
 * 也就是说：这条判据按**字段名**判定，分不出「这个名字在哪个接口上被读」。
 * 它挡住的是「一个字段名全仓没人碰」，挡不住「同名不同接口」。
 *
 * 真要分接口，得走 TypeScript 语法树（像 `deadExportAudit` 那样）。而这里的收益不足以
 * 付那个成本 —— 这一类（运行时状态接口里既没写过也没读过）实测只有 `LifeRecord.bond`
 * 一个，且已经删了。**记下边界，比把判据做复杂更好。**
 */
const DATA_STATE_FIELD_SAME_NAME_EXEMPT = new Set<string>([]);

describe("data 层的运行时状态接口 · 字段两头都要有人", () => {
  it("每个既没写过也没读过的字段，都被删掉或登记过", () => {
    let corpus = "";
    for (const f of walkFiles("src", isSourceFile)) corpus += stripComments(readSource(f)) + "\n";

    const hollow: string[] = [];
    for (const [file, iface] of DATA_STATE_INTERFACES) {
      const src = stripComments(readSource(file));
      expect(
        src.includes(`export interface ${iface}`),
        `${file} 里找不到 ${iface} —— 判据要跟着改名`,
      ).toBe(true);
      for (const field of fieldsOf(src, iface)) {
        /*
         * 读的口径要严：`.field` 后面**不能紧跟** `-` 或字母。
         *
         * 初版写的是 `\.${field}\b`，而 `\b` 在 `-` 前也成立 ——
         * `.bond-scene`（CSS 类名）于是被算成「有人读 bond」，
         * 故障注入（把 LifeRecord.bond 加回去）**测不出来**（实测确认）。
         * 这与第 393/398/410 轮撞过的是同一个形状：钉住一个词的出现在，而不是
         * 它作为**属性访问**被使用。
         */
        const read = new RegExp(`\\.${field}(?![\\w-])`).test(corpus);
        const written = new RegExp("\\b" + field + "\\??\\s*[:=]").test(corpus);
        if (!written && !read && !DATA_STATE_FIELD_SAME_NAME_EXEMPT.has(`${iface}.${field}`))
          hollow.push(`${iface}.${field}`);
      }
    }
    expect(
      hollow,
      "这些 data 层状态字段既没被写过、也没被读过 —— 只剩声明与注释，读起来却像实现了。" +
        "第 414 轮 LifeRecord.bond 就是这样藏了不知多少轮:" +
        hollow.join(" / "),
    ).toEqual([]);
  });
});

describe("类型字段 · 从没被写过的也要有人认领", () => {
  it("每个既没写过也没读过的字段，都在 RESERVED 里", () => {
    const src = stripComments(readSource(TYPES));
    const ifaces = [...src.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]!);

    let corpus = "";
    for (const f of walkFiles("src", isSourceFile)) {
      if (f.endsWith("types/index.ts")) continue;
      corpus += stripComments(readSource(f)) + "\n";
    }

    const hollow: string[] = [];
    for (const iface of ifaces) {
      for (const field of fieldsOf(src, iface)) {
        const key = `${iface}.${field}`;
        if (RESERVED.has(key)) continue;
        const written = new RegExp(`\\b${field}\\s*[:=]`).test(corpus);
        const read = new RegExp(`\\.${field}\\b`).test(corpus);
        if (!written && !read) hollow.push(key);
      }
    }

    expect(
      hollow,
      "这些字段既没被写过、也没被读过 —— 只剩一行声明与一句注释，读起来却像实现了。" +
        "删掉它，或者登记进 RESERVED 说明它为什么还在这里:" +
        hollow.join(" / "),
    ).toEqual([]);
  });
});
