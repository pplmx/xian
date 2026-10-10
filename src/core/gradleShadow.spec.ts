/**
 * 出包脚本的 Groovy 遮蔽 —— 一条"本地全绿、只在 CI 才炸"的错,值一条判据。
 *
 * 起因:`android/app/build.gradle` 里签名口令的局部变量曾与 `signingConfigs` 的 DSL
 * 方法同名(`storePassword` / `keyPassword`)。Groovy 把 `storePassword storePassword`
 * 读成「把 storePassword 当可调用物、把 storePassword 传进去」,而**处在作用域里的
 * 局部变量优先于闭包 delegate 上的 DSL 方法** —— 于是配置期当场炸:
 *
 *     A problem occurred evaluating project ':app'
 *     > No signature of method: java.lang.String.call()
 *
 * 它只在口令齐备时才执行,所以本地(不设 KEYSTORE_* 环境变量时走"未签名出包")一路全绿,
 * CI 注入了 Secrets 才第一次真正跑到那一行 —— **能过的门都没跑到这一行**,
 * v1.34.0 / v1.35.0 两次发版都停在这里、一次 Release 都没能发出来。
 *
 * 判据就是那条语义本身:一份 `.gradle` 脚本里,顶层 `def x = …` 的名字不许同时被当作
 * 「裸词调用的左词」用(`x y`)—— 那正是"局部变量遮蔽 DSL 方法"的形状。
 * 只查这一种形状,不查 Groovy 的全部语义:能静态数出来的,就该有一条会自己跑的判据。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(import.meta.dirname, "../..");
const ANDROID = join(ROOT, "android");

/** android/ 下全部出包脚本(跳过构建产物目录,免得数到生成出来的 .gradle) */
function gradleScripts(dir = ANDROID, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "build" || entry.name === ".gradle") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) gradleScripts(full, out);
    else if (entry.name.endsWith(".gradle")) out.push(full);
  }
  return out;
}

/**
 * 判据本体(纯函数,好让历史写法也能喂进来量一次):
 * 返回「顶层 def 的名字又被当裸词调用」的那些行。
 */
export function shadowedDslCalls(text: string): { line: number; name: string }[] {
  const declared = new Set(
    [...text.matchAll(/^def\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1] as string),
  );
  const hits: { line: number; name: string }[] = [];
  text.split("\n").forEach((raw, i) => {
    // 裸词调用:`名字 参数`,且名字后面不是 `(`(那是普通函数调用)、不是 `=`(那是赋值)
    const m = /^\s*([A-Za-z_$][\w$]*)\s+([^\s=(].*)$/.exec(raw);
    if (m && declared.has(m[1] as string)) hits.push({ line: i + 1, name: m[1] as string });
  });
  return hits;
}

describe("出包脚本 —— Groovy 局部变量遮蔽 DSL 方法", () => {
  it("android/ 下的 gradle 脚本里,顶层 def 都不与裸词调用同名", () => {
    const files = gradleScripts();
    expect(files.length, "一个 .gradle 都没扫到 —— 目录挪走了?").toBeGreaterThan(0);
    const offenders = files.flatMap((f) =>
      shadowedDslCalls(readFileSync(f, "utf8")).map(
        (h) => `${f.slice(ROOT.length + 1)}:${h.line} ${h.name}`,
      ),
    );
    expect(
      offenders,
      `这些行会让 Groovy 把局部变量当可调用物调(配置期 String.call() 炸):${offenders.join("、")}`,
    ).toEqual([]);
  });

  it("这条判据抓得住历史写法 —— 换回旧名字,当场点名是哪一行", () => {
    // 曾经的写法(逐字取自 v1.35.0 的 android/app/build.gradle)
    const historical = [
      "def pick = { String key, String envName, props, local ->",
      "    def v = System.getenv(envName)",
      "    if (v != null) return v",
      "    return null",
      "}",
      "def storePassword = pick('storePassword', 'KEYSTORE_STORE_PASSWORD', keystoreProps, localProps)",
      "def keyPassword = pick('keyPassword', 'KEYSTORE_KEY_PASSWORD', keystoreProps, localProps)",
      "signingConfigs {",
      "    release {",
      "        if (signingAvailable) {",
      "            keyAlias keystoreProps['keyAlias']",
      "            keyPassword keyPassword",
      "            storeFile rootProject.file(keystoreProps['storeFile'])",
      "            storePassword storePassword",
      "        }",
      "    }",
      "}",
    ].join("\n");
    const hits = shadowedDslCalls(historical);
    expect(hits.map((h) => `${h.line}:${h.name}`)).toEqual(["12:keyPassword", "14:storePassword"]);
    // 反向:同一段里那些**不**同名的 DSL 行不许被误伤(storeFile / keyAlias 都不是 def)
    expect(hits.some((h) => h.name === "storeFile" || h.name === "keyAlias")).toBe(false);
  });
});
