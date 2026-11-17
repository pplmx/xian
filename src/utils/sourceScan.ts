/**
 * 扫源码文本时，先把它里面**字符串字面量**里的内容抹掉。
 *
 * ## 为什么需要它（第 510 轮）
 *
 * 本仓有两百份 spec 会 `readFileSync` 别的源码再拿正则去扫。而扫的是**文本**，
 * 文本里既有代码，也有**字符串里的代码**：
 *
 * ```ts
 * // 判据自己要自证，于是在用例里写了一段假样本
 * const fake = `it("只有两项是真正的自动复利", () => { … })`;
 * ```
 *
 * 按行扫的判据会把这段假样本当成真用例。实测有三处判据都栽在这上面，
 * 而它们各自的办法都是**把自己整个文件跳过**:
 *
 * ```text
 *   reportTestDecl.spec   name !== "reportTestDecl.spec.ts"
 *   specGapClaims.spec    x !== "specGapClaims.spec.ts"
 *   testNameTruth.spec    x !== "testNameTruth.spec.ts"
 * ```
 *
 * 跳过整个文件是「不再查自己」，而不是「查对」。三处各自写一遍的同时，
 * 也让这三份文件里的**真实**内容脱离了检查。
 *
 * ## 这个函数做什么
 *
 * 把字符串字面量（单引号、双引号、反引号）里的内容替换成等长的空格，
 * 保留引号与换行位置 —— 于是**偏移量与行号都不变**，正则与报错位置照旧可用。
 *
 * ```text
 *   原始   const x = it("A")            → 扫到的仍是 it 这个标识符
 *   抹后   const x = it(" ")            → 而引号里的 A 不见了
 * ```
 *
 * ## 它做不到什么
 *
 * 这不是解析器。它按字符扫，处理 `\` 转义与三种引号，**不处理**模板字符串里的
 * `${…}` 嵌套（那一段里的代码会被一并抹掉）。对「扫源码找标识符」这个用途够用，
 * 对「分析代码结构」不够 —— 需要后者的地方该用真正的 AST。
 */
export interface StripOptions {
  /**
   * 哪些字符串要**留着**（不抹）。给一个判定函数，返回 true 的保留。
   *
   * 为什么需要它:有的判据要读某个特定的字符串（比如「it() 的用例名」），
   * 而其余字符串里的代码样文本才是要防的噪音。
   */
  keep?: (content: string) => boolean;
}

export function stripStringLiterals(src: string, opts: StripOptions = {}): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  /** 当前引号；null 表示在代码里 */
  let quote: string | null = null;
  while (i < n) {
    const ch = src[i]!;
    if (quote === null) {
      if (ch === '"' || ch === "'" || ch === "`") {
        /*
         * 若要保留这一整段字符串，就原样把它复制过去。
         * 这里先把结束位置找出来 —— 免得在保留态里再走一遍状态机。
         */
        const close = findStringEnd(src, i, ch);
        const content = src.slice(i + 1, close);
        if (opts.keep?.(content)) {
          out.push(src.slice(i, Math.min(close + 1, n)));
          i = Math.min(close + 1, n);
          continue;
        }
        quote = ch;
        out.push(ch);
        i += 1;
        continue;
      }
      /* 行注释与块注释原样保留 —— 判据常要扫注释里的说法 */
      out.push(ch);
      i += 1;
      continue;
    }
    /* 在字符串里 */
    if (ch === "\\") {
      /* 转义：连同下一字符一起抹掉，但保留字符数 */
      out.push(" ");
      out.push(src[i + 1] === "\n" ? "\n" : " ");
      i += 2;
      continue;
    }
    if (ch === quote) {
      quote = null;
      out.push(ch);
      i += 1;
      continue;
    }
    /* 换行在模板字符串里是合法的，保留它以免行号错位 */
    out.push(ch === "\n" ? "\n" : " ");
    i += 1;
  }
  return out.join("");
}

/** 从 start（引号位置）找到这个字符串的结束引号；找不到就返回末尾 */
function findStringEnd(src: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i;
    i += 1;
  }
  return src.length;
}
