/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 发布产物自检 —— 从**真的装出去的包**里，确认只在那条流水线上才生效的修复确实进去了
 *
 * 用法:
 *   bun scripts/verify-release.mjs <tag> [--dir <解压缓存目录>]
 *   bun scripts/verify-release.mjs v0.0.3
 *
 * ## 为什么值得一条判据
 *
 * 本仓**三次发版**都栽在同一类代码上:`android/`、`electron/`、`package.json` 的
 * `build` 字段 —— 只在那条 tag 流水线上执行,本地门全绿不代表发得出去。
 * v0.0.2 栽的是 `build.win.icon` 指着 48×48 的 favicon;修完之后**本地 `--win`
 * 跑通了一次**,但那是一次性的手工验证,下一版不会再跑。
 *
 * 这个脚本把「事后验证」固化成一条命令:下载该 tag 的两个产物,分别检查
 * 那些**只有在产物里才看得出来**的东西。
 *
 * ## 每项检查都对着一条真实缺陷
 *
 * | 检查 | 对应那次事故 |
 * | --- | --- |
 * | Windows 包里有没有 `app.asar` | `build.asar` 曾被照搬成 false,本仓从没为它写过理由 |
 * | 打包后的 main.js 里,开发菜单是否在 `isPackaged` 守卫内 | 装好的客户端按 F12 就能改存档 |
 * | 打包后的 main.js 里,设置是否先写 tmp 再 rename | 覆盖写让设置在崩溃时悄悄复位 |
 * | APK 的 dex 里,轮询是否带次数上限 | 原本每 200ms 无限空转 |
 * | APK 里有没有 `launch_background` 这个命名资源 | 色号曾硬编码在七个地方 |
 *
 * ## asar 不用装依赖
 *
 * asar 就是一段 JSON 头 + 文件数据:
 *
 *   [uint32 headerSize][uint32 headerStringSize][JSON header][数据区]
 *
 * 头里的 `files` 是一棵树,叶子带 `{ offset, size }` —— 相对数据区起点。
 * 为了读一个 `dist-electron/main.js` 装一个 `asar` 包不值得,故就地解析。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "pplmx/xian";

/** 每 5 秒一次 flush,单次加密约 5.7ms —— 见 docs/development.md 的「存档落盘」 */
const RED = "\u001b[31m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const OFF = "\u001b[0m";

const failures = [];
const ok = (msg) => console.log(`  ${GREEN}✓${OFF} ${msg}`);
const bad = (msg) => {
  failures.push(msg);
  console.log(`  ${RED}✗${OFF} ${msg}`);
};

/** 跑一条命令,返回 stdout;失败时返回 null(由调用方决定怎么报) */
function tryRun(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
  } catch {
    return null;
  }
}

/**
 * 从 asar 里取一个文件。
 * @param {Buffer} buf 整个 .asar
 * @param {string} relPath 形如 `dist-electron/main.js`
 * @returns {Buffer | null}
 */
function readAsarFile(buf, relPath) {
  /*
   * 实际布局(2026-11-09 对着真产物量的):
   *   @0  uint32 = 4                  「下一个字段本身的长度」
   *   @4  uint32 = headerSize         含它自己的 4 字节
   *   @8  uint32 = headerSize - 4     含它自己的 4 字节
   *   @12 uint32 = JSON 的字节数
   *   @16 JSON 开始
   *
   * 所以数据区起点是 `8 + headerSize`(@4 的值),而 JSON 的长度在 @12。
   * 按「@0 是 headerSize」去读会把整个偏移量推算错位 —— 第一版就是这么错的。
   */
  const headerSize = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  const headerJson = buf.subarray(16, 16 + jsonLen).toString("utf8");
  let header;
  try {
    header = JSON.parse(headerJson);
  } catch {
    return null;
  }
  const dataStart = 8 + headerSize;

  let node = header;
  for (const part of relPath.split("/")) {
    node = node?.files?.[part];
    if (!node) return null;
  }
  /*
   * **offset 一律是字符串** —— 这是第一版踩到的坑:asar 的头部是 JSON,数字被序列化成
   * 字符串存着(`"offset": "32107058"`),我按 `typeof === "number"` 判断,于是把每个
   * 真实文件都当成"不是文件"返回 null。空文件同样是字符串("0"),区别只在 size。
   */
  if (node.offset === undefined || typeof node.size !== "number") return null;
  const start = dataStart + Number(node.offset);
  return buf.subarray(start, start + node.size);
}

async function main() {
  const args = process.argv.slice(2);
  const tag = args.find((a) => !a.startsWith("--"));
  if (!tag) {
    console.error("用法:bun scripts/verify-release.mjs <tag>   (例:v0.0.3)");
    process.exit(2);
  }
  const dirArgIdx = args.indexOf("--dir");
  const cacheDir =
    dirArgIdx >= 0 && args[dirArgIdx + 1]
      ? resolve(args[dirArgIdx + 1])
      : join(ROOT, ".release-verify");
  mkdirSync(cacheDir, { recursive: true });

  console.log(`发布产物自检 · ${tag}`);
  console.log(`${DIM}  缓存目录 ${cacheDir}${OFF}\n`);

  /* ---------- 1. 下载两个产物 ---------- */
  const assets = tryRun("gh", [
    "release",
    "view",
    tag,
    "-R",
    REPO,
    "--json",
    "assets",
    "--jq",
    ".assets[].name",
  ]);
  if (assets === null) {
    console.error(`取不到 ${tag} 的产物清单 —— gh 没登录 / tag 不存在 / 网络不通`);
    process.exit(2);
  }
  const names = assets.split("\n").filter(Boolean);
  const zipName = names.find((n) => n.endsWith("-win.zip"));
  const apkName = names.find((n) => n.endsWith(".apk"));
  if (!zipName) return bad(`${tag} 里没有 Windows 包(*-win.zip)`);
  if (!apkName) return bad(`${tag} 里没有 APK(*.apk)`);
  ok(`产物清单:${zipName} · ${apkName}`);

  for (const name of [zipName, apkName]) {
    const dest = join(cacheDir, name);
    if (existsSync(dest)) {
      ok(`${name} 已在缓存`);
      continue;
    }
    const r = tryRun("gh", ["release", "download", tag, "-p", name, "-R", REPO, "-D", cacheDir]);
    if (r === null) return bad(`下载 ${name} 失败`);
    ok(`下载 ${name}`);
  }

  /* ---------- 2. Windows:asar 与两处 electron 修复 ---------- */
  const zipPath = join(cacheDir, zipName);
  const winOut = join(cacheDir, "win");
  rmSync(winOut, { recursive: true, force: true });
  mkdirSync(winOut, { recursive: true });
  // unzip 对非 ASCII 文件名会抱怨"mismatching local filename",但退出码仍是 0
  tryRun("unzip", ["-o", "-q", zipPath, "-d", winOut]);

  const asarPath = join(winOut, "resources", "app.asar");
  if (!existsSync(asarPath)) {
    bad("Windows 包里没有 resources/app.asar —— build.asar 没生效");
  } else {
    ok(`app.asar 在(${(readFileSync(asarPath).length / 1048576).toFixed(1)} MB)`);
    const asar = readFileSync(asarPath);
    const mainJs = readAsarFile(asar, "dist-electron/main.js");
    if (!mainJs) {
      bad("app.asar 里取不到 dist-electron/main.js");
    } else {
      const src = mainJs.toString("utf8");

      /*
       * 开发菜单必须在 isPackaged 守卫内。esbuild 保留了这个标识符,
       * 故直接看 `isPackaged` 与紧随其后的「开发」标签是否相邻 —— 不相邻说明
       * 菜单被挪到守卫外面了。
       */
      const guardThenDev = /isPackaged\)\s*\{[\s\S]{0,200}?label:\s*"\\u5F00\\u53D1"/.test(src);
      if (guardThenDev) ok("开发者工具在 isPackaged 守卫内");
      else bad("打包后的 main.js 里,「开发」菜单不在 isPackaged 守卫内 —— F12 又能改存档了");

      /*
       * 设置原子写:先写 `${settingsPath}.tmp` 再 renameSync。
       * 只看 "renameSync" 不够 —— 别处也可能 rename;要连 tmp 变量一起认。
       */
      const atomicWrite = /\.tmp`[\s\S]{0,300}?renameSync\(/.test(src);
      if (atomicWrite) ok("设置落盘是原子写(tmp + rename)");
      else bad("打包后的 main.js 里找不到 tmp + renameSync —— 设置又变回覆盖写了");
    }
  }

  /* ---------- 3. Android:dex 里的三处修复 ---------- */
  const apkPath = join(cacheDir, apkName);
  const apkOut = join(cacheDir, "apk");
  rmSync(apkOut, { recursive: true, force: true });
  mkdirSync(apkOut, { recursive: true });
  tryRun("unzip", ["-o", "-q", apkPath, "-d", apkOut]);

  const dexPath = join(apkOut, "classes.dex");
  if (!existsSync(dexPath)) {
    bad("APK 里没有 classes.dex");
  } else {
    // dex 是二进制,但字符串常量以明文存着 —— 我们要找的都是字符串/标识符
    const dex = readFileSync(dexPath).toString("latin1");

    // 轮询带次数上限:认 `check(left)` 这个形参与末尾的 `})(150)`
    if (/function check\(left\)/.test(dex) && /\)\(150\)/.test(dex)) {
      ok("遮挡层轮询带次数上限(check(left) … )(150))");
    } else {
      bad("APK 的 dex 里找不到带上限的轮询 —— 遮挡层又会无限空转");
    }

    if (dex.includes("removeCallbacksAndMessages")) {
      ok("迁移器销毁时摘 handler 队列");
    } else {
      bad("APK 的 dex 里没有 removeCallbacksAndMessages —— 销毁后仍可能弹 Toast");
    }

    if (dex.includes("launch_background")) {
      ok("启动底色用命名资源 launch_background");
    } else {
      bad("APK 的 dex 里没有 launch_background —— 色号可能又散回多处硬编码");
    }
  }

  /* ---------- 收尾 ---------- */
  console.log();
  if (failures.length) {
    console.log(`${RED}✗ ${failures.length} 项没过${OFF} —— 这些是只有产物里才看得出的问题`);
    for (const f of failures) console.log(`    ${f}`);
    process.exit(1);
  }
  console.log(`${GREEN}✓ 两个产物里的修复都在${OFF}(Windows 3 项 · Android 3 项)`);
  console.log(`${DIM}  临时文件留在 ${cacheDir},下次复用;要清就 rm -rf 它${OFF}`);
}

await main();
