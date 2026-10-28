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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const RAW_BUILD = readFileSync(resolve(ROOT, ".github/workflows/build.yml"), "utf8");
const RAW_GRADLE = readFileSync(resolve(ROOT, "android/app/build.gradle"), "utf8");
const RAW_MANIFEST = readFileSync(
  resolve(ROOT, "android/app/src/main/AndroidManifest.xml"),
  "utf8",
);
const PRIVACY = readFileSync(resolve(ROOT, "public/privacy.html"), "utf8");

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

describe("Android 隐私 · 系统备份不许绕过导出/导入", () => {
  it("自动云备份与换机迁移关闭 —— 存档只留本机", () => {
    expect(PRIVACY, "隐私政策的「不跨设备同步」承诺没了 —— 这条 Android 判据失去对象").toContain(
      "不会在你的多个设备之间同步",
    );
    expect(
      RAW_MANIFEST,
      "allowBackup=true 会把 WebView 存档交给系统云备份/换机迁移,与隐私政策冲突",
    ).toMatch(/android:allowBackup="false"/);
  });
});

describe("发版正文 · 版本号一改,仓库里就得有一份同名正文", () => {
  /*
   * 约定写在 docs/development.md 的「发版」:Release 正文放仓库里,`docs/release-notes/<tag>.md`
   * 与 tag 同名。流水线找不到那份文件时会**静默退回自动生成的提交清单** —— 发得出去,
   * 只是发布页上从此是一串 commit 标题,而且只有打了 tag 才发现。
   *
   * 版本号是在本地提的(提完才打 tag),所以这一条能在提交前就拦住「提了版本、忘了写正文」。
   */
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
    version: string;
  };

  it("package.json 的当前版本有同名 Release 正文", () => {
    const file = resolve(ROOT, `docs/release-notes/v${pkg.version}.md`);
    expect(
      existsSync(file),
      `缺 docs/release-notes/v${pkg.version}.md —— 发版会静默退回自动生成的提交清单`,
    ).toBe(true);
  });

  it("流水线确实优先取仓库里那份正文", () => {
    expect(BUILD).toMatch(/NOTES="docs\/release-notes\/\$\{GITHUB_REF_NAME\}\.md"/);
    expect(BUILD, "落回自动生成时应当留一条日志,别让发版悄悄降级").toMatch(/不存在[^\n]*自动生成/);
  });
});
