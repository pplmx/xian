/**
 * 源码读取 —— 界面契约测试共用的「读一份源文件」。
 *
 * 由来:32 个 spec 各自写了一份 `source(rel)`,其中 28 份逐字相同,都带着同一条
 * 分支:`src/style.css` 要走 readStyleCss() 拼回整份样式(运行时那几份是按路由
 * 拆掉的,直接读 style.css 会漏掉页面层)。这条分支是**约定**,不是可选项 ——
 * 一旦哪个 spec 抄的是简版,它读到的就不是「界面实际用的那份样式」,判据照旧全绿。
 *
 * 故把实现收到一处:调用方只写路径,拼装规则不出这个文件。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readStyleCss } from "./readStyleCss";

export const ROOT = resolve(__dirname, "../..");

/**
 * 读仓库里的一份源文件(相对仓库根)。
 *
 * `src/style.css` 单独走 readStyleCss():那是「逻辑上的整份样式」,由 base 与各页
 * 分片重新拼成;其余路径直读。路径不存在时 readFileSync 会抛,不吞。
 */
export function readSource(rel: string): string {
  if (rel === "src/style.css") return readStyleCss();
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/**
 * 递归列出一棵目录下的文件(绝对路径)。
 *
 * 各 spec 原本各写一份 `walk`,彼此只差一个「收哪些扩展名」的判断 —— 而那正是
 * 最容易抄错的一行:`!(entry.endsWith(".spec.ts"))` 少个 s、把 `.d.ts` 当源码、
 * 或漏掉 `.mjs`,都会让某个审计悄悄少扫一片而不报错。这里用 `accept` 把差异
 * 摊到调用点上,遍历本身只写一次。
 */
export function walkFiles(
  dir: string,
  accept: (name: string) => boolean,
  out: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, accept, out);
    else if (accept(entry)) out.push(full);
  }
  return out;
}

/**
 * 源码语料:`.ts` / `.vue`,含用例,只排除类型声明。
 *
 * 与 isSourceFile 的差别只在「收不收 spec」,而那正是两类审计的分界:
 *  - 查「谁在用这个导出」要把 spec 算进来(否则引用它的用例不算数,
 *    一百多个有主的导出会被误判成死导出 —— 实测过);
 *  - 查「界面实际用了哪份样式」不该把用例里抄的字符串算进语料。
 * 名字写死在这里,免得每个 spec 各自记着该不该排除 spec。
 */
export const isTypeScriptOrVue = (name: string): boolean =>
  /\.(ts|vue)$/.test(name) && !name.endsWith(".d.ts");

/** 源码文件:`.ts` / `.vue`,默认排除用例与类型声明 */
export const isSourceFile = (name: string): boolean =>
  isTypeScriptOrVue(name) && !name.endsWith(".spec.ts");

/** 只收 `.vue` 单文件组件 */
export const isVueFile = (name: string): boolean => name.endsWith(".vue");

/** 只收用例文件 */
export const isSpecFile = (name: string): boolean => name.endsWith(".spec.ts");

/** 源码加上脚本(`scripts/*.mjs`)—— 判据要连真浏览器门一起扫时用 */
export const isSourceOrScript = (name: string): boolean =>
  isSourceFile(name) || (name.endsWith(".mjs") && !name.endsWith(".spec.mjs"));

/**
 * 从一份 markdown 里切出**一个小节**的正文。
 *
 * ## 为什么要有这个函数
 *
 * 本仓有 12 个 spec 要读 `docs/*.md`,其中几处要「只取某一节」。切法各写各的,
 * 而**踩同一个坑三次**:
 *
 * ```text
 *   137 轮  misjudgmentLedger  正文里的圈号冒充了下一个条目
 *   140 轮  designToc          目录上方说明里的「动效」冒充了列表项
 *   150 轮  misjudgmentLedger  又一次 —— 修了 nextAt 却漏了 at
 * ```
 *
 * 三次的形状一样:**用 `indexOf(某个词)` 找边界,而那个词在正文里也出现**。
 *
 * ## 用法
 *
 * ```ts
 * const body = markdownSection(doc, "## 待办 · 下一步");
 * ```
 *
 * 边界按**行首**匹配(行内出现的 `## ` 不算),到**下一个同级或更高级标题**为止:
 *
 * ```text
 *   markdownSection(doc, "### 法则 J")
 *     → 切到下一个 `### ` 或 `## ` 之前
 *   markdownSection(doc, "## 待办")
 *     → 切到下一个 `## ` 之前(不再往下切 `###`)
 * ```
 *
 * 找不到标题时**抛错**而不是返回空串 —— 返回空串会让「找不到」伪装成「那节是空的」,
 * 而后者看起来像一条内容缺口。
 */
export function markdownSection(doc: string, heading: string): string {
  const lines = doc.split("\n");
  const level = /^(#+)\s/.exec(heading)?.[1]?.length;
  if (!level) throw new Error(`markdownSection: 标题要以 # 开头,收到 ${JSON.stringify(heading)}`);

  // 标题必须**整行**相等(或行尾多几个空格),不许是行内提及
  const start = lines.findIndex((l) => l.trimEnd() === heading.trimEnd());
  if (start < 0) throw new Error(`markdownSection: 找不到标题 ${JSON.stringify(heading)}`);

  // 到下一个「同级或更高级」的标题为止
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+)\s/.exec(lines[i]!);
    if (m && m[1]!.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
