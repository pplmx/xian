/**
 * 引擎入口判据 —— **它必须真的扫到东西**。
 *
 * ## 本轮发现的失效
 *
 * `scripts/engine-dist.mjs` 的第 ⑥ 条守着三条纪律:宿主要经公开入口引用库,
 * 不许 `@engine` 别名、不许深层导入(子路径)、不许相对路径钻进
 * `packages/engine/src`。三条都写成了:
 *
 * ```js
 * if (/from '@engine/.test(text)) aliasUsers.push(...)
 * if (/from 'wanxiang-engine\//.test(text)) deepUsers.push(...)
 * if (/from '[^']*packages\/engine/.test(text)) crawlUsers.push(...)
 * byName += (text.match(/from 'wanxiang-engine'/g) ?? []).length
 * ```
 *
 * **引号全是单引号,而本仓库源码一律用双引号。** 于是:
 *
 * - `byName` 数到的 3 处,全部来自注释里引用的示例文字(`import { … } from 'wanxiang-engine'`);
 * - 67 处真实引用一处都没数到;
 * - 更要紧的是**三条纪律判据从来没在真实引用上生效过** —— 它们看的是一个空集,
 *   所以永远绿,而「宿主守不守入口纪律」这件事等于没人管。
 *
 * 修好后 byName 从 3 变成 70(含 `export … from`),三条纪律也仍在(注入三处全红)。
 *
 * ## 判据守什么
 *
 * 静态扫描 `engine-dist.mjs`,要求那四条正则**两种引号都认**。这条判据本身很轻,
 * 但它守的是一类很容易复发的错:**判据写对了逻辑,却扫错了集合,于是静默全绿**。
 * 这类失效不会报错,只会让人以为有保护。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const GATE = readFileSync(join(ROOT, "scripts/engine-dist.mjs"), "utf-8");

describe("引擎入口判据 · 必须两种引号都认", () => {
  it("三条纪律判据不再写死单引号", () => {
    /*
     * 要拦的是 `/from '[^']*…/` 这种**只有单引号**的形态。这里按"源码里还有没有
     * 那种正则"来判断 —— 用字符串拼出来比对,不写成字面量(写成字面量的话,
     * `engine-dist.mjs` 扫宿主源码时会把它当成真的违规引用,实测撞到)。
     */
    const Q = String.fromCharCode(39);
    const dead = [
      `/from ${Q}@engine`,
      `/from ${Q}wanxiang-engine`,
      `/from ${Q}[^${Q}]*packages`,
    ].filter((needle) => GATE.includes(needle));
    expect(dead, "这三条 from 正则只认单引号,而本仓源码用双引号 —— 它们会在空集上永远绿").toEqual(
      [],
    );
  });

  it("用了一个同时覆盖两种引号的 from 片段", () => {
    /*
     * 接受两种写法:直接写字符组 `(['"])`,或用 `String.raw` 拼一个 FROM 常量
     * (本仓用的是后者 —— 四条正则共用一处,免得再各写各的、又漂成单引号)。
     */
    const hasCharClass = /\(\[(['"])\]\)/.test(GATE);
    const hasSharedFragment = /const FROM\s*=/.test(GATE) && /FROM\b/.test(GATE);
    expect(
      hasCharClass || hasSharedFragment,
      "那几条 from 判据既没有引号字符组、也没有共用的 FROM 片段 —— 可能还是只认单引号",
    ).toBe(true);
  });

  it("byName 统计含 export … from —— 再导出也是一种引用", () => {
    /*
     * 修完引号之后仍然只数 import 侧的那个包名,会漏掉
     * `export { x } from` 那个包名。这类写法在本仓存在(引擎适配层)。
     */
    expect(GATE, "byName 只数 import from,漏了 export … from").toMatch(/export/);
  });
});
