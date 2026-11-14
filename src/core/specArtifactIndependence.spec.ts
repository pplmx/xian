/**
 * 判据不许依赖「跑 test 时还不存在」的产物。
 *
 * ## 由来（第 201 轮，接上一轮的教训）
 *
 * 第 200 轮写 `zeroExternalRequests.spec` 时，第一版扫 `dist/assets/*.js`。
 * 做完故障注入（往产物里塞一个 `fetch` → 红）以为成了 —— 然后去核 `verify` 的顺序:
 *
 * ```text
 * clean-dist  →  check  →  test  →  test:report  →  vp build  →  …
 * ```
 *
 * **跑 test 时 dist 刚被清空。** 那条判据在 verify 链路里永远走「没有产物，跳过」，
 * 什么都没核。故障注入之所以能红，是因为我**手动 build 过**。
 *
 * ## 这条判据守什么
 *
 * 扫全仓 spec:凡在读**构建产物目录**里文件的，点名。
 *
 * ## 判不了的部分（写在明处）
 *
 * 「那条断言在实际跑的那一次有没有东西可核」这件事，机械判据判不了 ——
 * 它取决于 `verify` 的命令顺序，而那一步由 `gateWiring.spec` 守着。
 * 这里只拦最直接的一种:判据代码里出现构建产物的路径。
 *
 * ## 允许的例外
 *
 * 读 `public/`、`src/`、配置文件、`package.json` 的都算常驻文件，不受影响 ——
 * `favicon.spec` 读 `public/icon.png`、`releasePipeline.spec` 读 `electron-builder.yml`，
 * 那些一直都在。
 *
 * ## 故障注入
 *
 * 新建一个 `existsSync(join(process.cwd(), "dist/index.html"))` 的 spec →
 * 「没有 spec 直接读构建产物目录」当场点名它。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSpecFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/** 构建产物的目录名 —— test 阶段（verify 里）它们刚被 clean-dist 清空 */
const ARTIFACT_DIRS = ["dist", "build", "out", ".vite"];

/**
 * 判这一行是否在构造构建产物的路径。
 *
 * 按行找 `"dist/…"` 这类字面量，且同一行有读文件的调用。
 * 用 `includes` 而不是正则，避开 `/` 的转义纠缠（前两版都栽在那里）。
 */
function artifactReads(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    if (!/existsSync|readFileSync|readdirSync|join\(|resolve\(/.test(line)) continue;
    /*
     * 排除「在别的文件的源码里找这个字符串」那种形态 —— `toContain('join(ROOT, "dist/sw.js")')`
     * 读的是那个**脚本的正文**，不是 dist 里的文件（实测 `swPrecache.spec` 就是这样）。
     */
    if (/toContain\(|toMatch\(|includes\(/.test(line)) continue;
    for (const d of ARTIFACT_DIRS) {
      if (line.includes(`"${d}/`) || line.includes(`'${d}/`) || line.includes(`\`${d}/`)) {
        out.push(line.trim().slice(0, 80));
        break;
      }
    }
  }
  return out;
}

describe("判据不依赖构建产物", () => {
  it("扫到了足够多的 spec（防空转）", () => {
    let n = 0;
    for (const f of walkFiles("src", isSpecFile)) {
      if (/existsSync|readFileSync|readdirSync/.test(stripComments(readSource(f)))) n += 1;
    }
    expect(n, "一个读文件的 spec 都没扫到 —— 判据空转").toBeGreaterThan(20);
  });

  it("没有 spec 直接读构建产物目录", () => {
    const offenders: string[] = [];
    for (const f of walkFiles("src", isSpecFile)) {
      // 跳过自己:地基那几条样本里带着 "dist/" 字面量
      if (f.endsWith("specArtifactIndependence.spec.ts")) continue;
      const src = stripComments(readSource(f));
      for (const hit of artifactReads(src)) {
        offenders.push(`${f.replace(/^.*\/src\//, "src/")}: ${hit}`);
      }
    }
    expect(
      offenders,
      "这些判据在读构建产物 —— 而 verify 链路里 test 早于 build，跑 test 时它刚被清空，" +
        "这些断言实际什么都没核。改成读源码，或把检查挪到构建之后的脚本里:" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出这个形状（地基）", () => {
    const bad = 'expect(existsSync(join(ROOT, "dist/assets/x.js"))).toBe(true);';
    const good = 'expect(existsSync(join(ROOT, "public/icon.png"))).toBe(true);';
    const mention = '// 注释里提到 "dist/sw.js" 不算读它';
    expect(artifactReads(bad).length, "认不出读 dist 的那一行").toBe(1);
    expect(artifactReads(good).length, "把读 public 的也报出来了").toBe(0);
    expect(artifactReads(mention).length, "把注释里的 dist 也算成读了").toBe(0);
  });
});
