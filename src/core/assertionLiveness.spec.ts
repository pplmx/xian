/**
 * 断言不许空转 —— `FILES.find` 找不到文件时,`not.toContain` 会永远通过。
 *
 * ## 上一轮栽的那一次
 *
 * `uiLayering.spec` 里写着「装备卡『新』徽章要有入场动画」,而
 * `components/equipment/EquipmentCard.vue` 全仓已无 import —— 行囊早就换成了
 * 另一个组件。断言本身是 `.toContain`,文件不存在时 `card?.src` 是 `undefined`,
 * 于是它**当场报红**,被我看见。算运气好。
 *
 * ## 真正危险的是另一半
 *
 * 同一个文件里还有二十几条 `.not.toContain`:
 *
 *   const market = FILES.find((f) => f.path === "views/MarketView.vue");
 *   expect(market?.src, "寄卖要列全背包,不许 slice 截断").not.toContain("...");
 *
 * 这写法在文件**存在**时守着一件事;在文件**被改名或删掉**之后,
 * `market` 是 `undefined`,`market?.src` 也是 `undefined`,
 * 而 `expect(undefined).not.toContain("x")` —— **永远通过**。
 *
 * 于是「把这段坏代码删干净」与「把整个文件删掉」在判据眼里没有分别:
 * 前者是它想守的,后者是它该报的。一条判据一旦会静默通过,它守的那件事
 * 就已经不在守了,而它看起来还在。
 *
 * ## 这一条判据怎么守
 *
 * 静态扫描 `uiLayering.spec` 与其它用 `FILES.find` 的 spec:
 * **每一个 `FILES.find` 的变量都必须在同一文件里被"非空断言"过一次** ——
 * 要么 `expect(x?.src).toBeDefined()`,要么用 `x!.src`。
 *
 * 不去逐条改那 26 处(那会把 26 条判据的意思全动一遍),而是加一条
 * **元判据**:它们共用的那几个变量,每一个都得先被证明存在。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/** 用到 `FILES.find` 的 spec 文件 —— 目前只有这一份,新加的自动纳入 */
const SPEC_FILES = ["src/core/uiLayering.spec.ts", "src/core/layoutMeasure.spec.ts"];

/** 去掉注释,只留代码 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * 抽出所有**裸的** `FILES.find(...)` —— 即 `fileAt` 定义之外的那些。
 *
 * `fileAt` 自己内部要用一次裸查(那是它该做的),故按函数体把它摘出去再扫。
 */
export function bareFinds(source: string): string[] {
  const code = stripComments(source);
  // 去掉 fileAt 的函数体:它内部那一次裸查是正当的
  const helperStart = code.indexOf("function fileAt(");
  let scannable = code;
  if (helperStart >= 0) {
    /*
     * 按**括号配对**找函数体的结尾 —— 用 `\n}` 这种字面找法在单行函数体上会失灵
     * (自测里那条样例正是单行),于是"摘除"没摘干净,正当的那一次被算成违规。
     */
    /*
     * 找函数体起始:`fileAt` 的签名带返回类型(`: { path: string; src: string }`),
     * 那个大括号不是函数体。故以**最后一条 `return` 之前最近的一个 `{`** 为界 ——
     * 对这类小工具函数足够稳,且不依赖签名的写法。
     */
    const helperTail = code.indexOf("return hit;", helperStart);
    const braceStart = code.lastIndexOf("{", helperTail >= 0 ? helperTail : helperStart);
    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < code.length; i += 1) {
      if (code[i] === "{") depth += 1;
      else if (code[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    scannable = code.slice(0, helperStart) + code.slice(end);
  }
  return [...scannable.matchAll(/FILES\.find\(/g)].map((m) => m[0]);
}

describe("断言不许空转 · 裸的 FILES.find 一处都不许留", () => {
  /*
   * 这一条对着**真实的 spec 文件**跑,不是在测样例:它守的正是那两个文件当下的状态。
   *
   * `uiLayering.spec` 已把全部 200+ 处 `FILES.find` 换成 `fileAt(...)` ——
   * 后者在找不到文件时当场抛错。留下任何一处裸的,就又是一条可能静默通过的断言。
   */
  for (const file of SPEC_FILES) {
    it(`${file}: 只用 fileAt,不用裸 FILES.find`, () => {
      const src = readFileSync(resolve(ROOT, file), "utf-8");
      const bare = bareFinds(src);
      expect(
        bare,
        "这些地方还在裸查文件 —— 改成 fileAt(...):文件改名/删除时它才会当场报错," +
          "而裸查 + .not.toContain 会静默通过",
      ).toEqual([]);
    });
  }
});

describe("断言不许空转 · 解析器本身可信", () => {
  it("认得出裸的 FILES.find", () => {
    const sample = `
      const a = FILES.find((f) => f.path === "views/A.vue");
      expect(a?.src).toContain("x");
    `;
    expect(bareFinds(sample)).toHaveLength(1);
  });

  it("fileAt(...) 不算裸查", () => {
    const sample = `
      const a = fileAt("views/A.vue");
      expect(a.src).toContain("x");
    `;
    expect(bareFinds(sample)).toEqual([]);
  });

  it("fileAt 自己内部那一次裸查是正当的,不算违规", () => {
    const sample = `
      function fileAt(path: string) {
        const hit = FILES.find((f) => f.path === path);
        if (!hit) throw new Error("missing");
        return hit;
      }
      const a = fileAt("views/A.vue");
    `;
    expect(bareFinds(sample)).toEqual([]);
  });

  it("注释里提到的 find 不算数", () => {
    const sample = `
      // const d = FILES.find((f) => f.path === "views/D.vue");
      /* const e = FILES.find((f) => f.path === "views/E.vue"); */
    `;
    expect(bareFinds(sample)).toEqual([]);
  });
});
