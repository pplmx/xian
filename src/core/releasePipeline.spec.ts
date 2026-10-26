/**
 * 发版流水线 · 只能靠打 tag 才验得到的那两处,用判据钉住。
 *
 * Electron 与 Android 的构建只在 tag 上跑(`.github/workflows/build.yml`),
 * 本地门全绿也证明不了它们跑得通 —— 本仓两次发版都栽在「本地永远绿、只有 CI 才执行到」
 * 的代码上:
 *   ① Android 签名:Groovy 把 `storePassword storePassword` 读成「拿 String 当闭包调」,
 *      配置期当场炸;修法是换两个局部变量名。
 *   ② Electron:electron-builder 26 在 tag 构建上会**隐式发 Release**,而构建 job 的
 *      token 只读 → 包打好了却在最后一步 403。修法是显式 `--publish never`。
 * 两条都是「改一次就过、谁回头改一下就悄悄复发」的类型,故在这里钉死形状。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const RAW_BUILD = readFileSync(resolve(ROOT, ".github/workflows/build.yml"), "utf8");
const RAW_GRADLE = readFileSync(resolve(ROOT, "android/app/build.gradle"), "utf8");

/**
 * 判据只看**生效的代码**,不看注释 —— 两处历史事故的说明文字里都原样引用了坏的写法
 * (`storePassword storePassword`、`contents: write 只给 release job`),把注释算进来
 * 会当场误红(第一次写这条判据就踩了)。
 */
const BUILD = RAW_BUILD.split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const GRADLE = RAW_GRADLE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("发版流水线 · 两条历史事故的护栏", () => {
  it("只在 tag(v*.*.*)上触发 —— main 的提交不再顺手发版", () => {
    expect(BUILD, "触发条件被改回 main push 了?").toMatch(/tags:\s*\n\s*-\s*"v\*\.\*\.\*"/);
    expect(BUILD, "不要同时挂 branches:main —— 那又会每次提交发一个 Release").not.toMatch(
      /^\s{2}push:\s*\n\s{4}branches:/m,
    );
  });

  it("Electron 构建显式 --publish never —— 隐式发布会拿只读 token 去 POST /releases", () => {
    expect(BUILD, "electron-builder 的隐式发布又回来了").toMatch(
      /build:electron[^\n]*--publish never/,
    );
    expect(BUILD, "构建 job 不该显式发版").not.toContain("--publish always");
  });

  it("Android 签名变量不遮蔽 —— Groovy 会把同名参数读成方法调用", () => {
    expect(GRADLE, "签名口令的取值入口没了").toMatch(/def storePass = pick\(/);
    expect(GRADLE).toMatch(/def keyPass = pick\(/);
    expect(GRADLE, "局部变量又叫回 storePassword 了(Groovy 遮蔽)").not.toMatch(
      /\bstorePassword\s+storePassword\b/,
    );
    expect(GRADLE).not.toMatch(/\bkeyPassword\s+keyPassword\b/);
  });

  it("tag 与 package.json 版本不一致时不许往下走", () => {
    expect(BUILD, "版本闸门那一步不见了").toContain("校验 tag 与 package.json 版本一致");
  });

  it("写权限只给 release job —— 构建 job 手里不该攥着能发版的 token", () => {
    const writes = [...BUILD.matchAll(/contents:\s*write/g)].length;
    expect(writes, "contents: write 只允许出现在 release job 里一次").toBe(1);
  });
});
