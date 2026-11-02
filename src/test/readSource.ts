/**
 * 源码读取 —— 界面契约测试共用的「读一份源文件」。
 *
 * 由来:31 个 spec 各自写了一份 `source(rel)`,其中 28 份逐字相同,都带着同一条
 * 分支:`src/style.css` 要走 readStyleCss() 拼回整份样式(运行时那几份是按路由
 * 拆掉的,直接读 style.css 会漏掉页面层)。这条分支是**约定**,不是可选项 ——
 * 一旦哪个 spec 抄的是简版,它读到的就不是「界面实际用的那份样式」,判据照旧全绿。
 *
 * 故把实现收到一处:调用方只写路径,拼装规则不出这个文件。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
