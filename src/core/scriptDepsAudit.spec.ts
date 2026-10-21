/**
 * 脚本依赖对账 —— scripts/ 里 import 的第三方裸模块名必须都在 package.json 报过账
 *
 * 由来:gen-pwa-icons.mjs 一直 `import sharp`,而 sharp 从未写进 package.json /
 * bun.lock —— 本机因残留安装能跑通,干净 clone 上这条命令直接 Cannot find package,
 * 而文档(deployment.md)还把它写成「改图标的正确姿势」,等于指向一条走不通的路。
 * 判据扫 scripts/ 下所有第三方裸导入(node: 前缀与相对路径不算),逐个对账;
 * 故障注入:临时放一个 import 未声明模块的脚本,判据当场点名文件与模块。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const scriptsDir = resolve(__dirname, "../../scripts");
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8"));

/** package.json 声明过的全部包名(依赖 + 开发依赖;带 scope 的取到第二段) */
function declaredPackages(): Set<string> {
  const names = new Set<string>();
  for (const section of [pkg.dependencies, pkg.devDependencies]) {
    for (const name of Object.keys(section ?? {})) names.add(name);
  }
  return names;
}

/** 从一条 import 说明符里剥出包名:相对路径/node: 内建不算,scoped 取两段 */
function barePackageName(spec: string): string | null {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? (parts.slice(0, 2).join("/") ?? null) : (parts[0] ?? null);
}

describe("脚本依赖对账", () => {
  it("scripts/ 里每个第三方裸导入都在 package.json 报过账", () => {
    const declared = declaredPackages();
    const offenders: string[] = [];
    for (const file of readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs"))) {
      const src = readFileSync(resolve(scriptsDir, file), "utf8");
      // 只认真正的 import 语句(行首 import ... from),不认注释/正则字面量里的
      // from '...' 写法 —— engine-dist 的对账判据正则里就有这种字符串,别扫到它
      for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)) {
        const name = barePackageName(m[1] ?? "");
        if (name && !declared.has(name)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders, "未声明的第三方依赖(修法:进 package.json,或改用仓里已有的库)").toEqual([]);
  });
});
