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
