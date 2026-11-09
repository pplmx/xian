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
const NETWORK_CONFIG_FILE = resolve(
  ROOT,
  "android/app/src/main/res/xml/network_security_config.xml",
);
const NETWORK_CONFIG = existsSync(NETWORK_CONFIG_FILE)
  ? readFileSync(NETWORK_CONFIG_FILE, "utf8")
  : "";
const RAW_MIGRATOR = readFileSync(
  resolve(ROOT, "android/app/src/main/java/com/mystvio/xuanshu/SaveMigrator.java"),
  "utf8",
);
const PRIVACY = readFileSync(resolve(ROOT, "public/privacy.html"), "utf8");
const PRIVACY_DIALOG = readFileSync(
  resolve(ROOT, "src/components/common/PrivacyDialog.vue"),
  "utf8",
);
const PRIVACY_DIALOG_TEXT = PRIVACY_DIALOG.replace(/\s+/g, "");

/**
 * 判据只看**生效的代码**,不看注释 —— 两处历史事故的说明文字里都原样引用了坏的写法
 * (`storePassword storePassword`、`contents: write 只给 release job`),把注释算进来
 * 会当场误红(第一次写这条判据就踩了)。
 */
const BUILD = RAW_BUILD.split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const GRADLE = RAW_GRADLE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MIGRATOR = RAW_MIGRATOR.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

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

  it("权限清单与隐私页同一份账 —— 去掉没用的,公开真正申请的", () => {
    expect(RAW_MANIFEST, "ACCESS_NETWORK_STATE 没有任何读取方,不应继续随包申请").not.toContain(
      "android.permission.ACCESS_NETWORK_STATE",
    );
    expect(RAW_MANIFEST, "Android 8~9 导出文档仍需要这条受限权限").toContain(
      "android.permission.WRITE_EXTERNAL_STORAGE",
    );
    expect(RAW_MANIFEST, "存储权限若不封顶,Android 10+ 也会背上不必要的敏感权限").toMatch(
      /android:name="android\.permission\.WRITE_EXTERNAL_STORAGE"\s+android:maxSdkVersion="28"/,
    );
    expect(PRIVACY, "隐私页只报了旧的两项,漏掉了真实存在的存储权限").toContain("以下三项权限");
    expect(PRIVACY).toContain("<code>WRITE_EXTERNAL_STORAGE</code>");
    expect(PRIVACY, "已移除的权限不该继续写在隐私页上").not.toContain(
      "<code>ACCESS_NETWORK_STATE</code>",
    );
    expect(PRIVACY_DIALOG_TEXT, "游戏内短版隐私说明也要交代备份与换机路径").toContain(
      "系统自动备份已关闭,换设备请使用「导出/导入」",
    );
  });

  it("明文 HTTP 只留给本地迁移 —— 其余域一律拒绝", () => {
    expect(RAW_MANIFEST).toMatch(/android:usesCleartextTraffic="false"/);
    expect(RAW_MANIFEST).toMatch(/android:networkSecurityConfig="@xml\/network_security_config"/);
    expect(NETWORK_CONFIG, "网络白名单文件不见了").toMatch(
      /<base-config\s+cleartextTrafficPermitted="false"\s*\/>/,
    );
    const domains = [...NETWORK_CONFIG.matchAll(/<domain\b[^>]*>([^<]+)<\/domain>/g)].map(
      (m) => m[1],
    );
    expect(domains, "只允许旧存档的 localhost origin,不能顺带放开别的域").toEqual(["localhost"]);
  });

  it("迁移服务器真的只绑回环地址 —— NanoHTTPD 无主机名构造器会监听所有网卡", () => {
    expect(MIGRATOR, "迁移服务又绑到通配地址了").toMatch(
      /MigrationServer\(int port\)\s*\{\s*super\("localhost", port\);/,
    );
    expect(MIGRATOR).not.toMatch(/super\(port\)/);
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

  it("Windows 打包图标至少 256×256 —— 48 的 favicon 会让构建当场失败", () => {
    /*
     * **真发生过**(v0.0.2 打 tag 时):`build.win.icon` 指着 `public/favicon.ico`,
     * 而那枚 .ico 只装了 16/32/48 三档 —— 那是刻意缩的,标签页只用得上这几档,
     * 塞 256 会让每次冷启动多走 130KB。但 electron-builder 要求 Windows 应用图标
     * **至少 256×256**,于是打包直接失败:
     *
     *   ⨯ Icon must be at least 256x256 pixels, provided: 48x48
     *
     * 两个用途(浏览器标签页 / 桌面应用图标)被一份配置同时承担了。
     * 修法是让打包用 `public/icons/icon-512.png`(与 PWA 安装图标同一枚),
     * favicon 保持精简。这条判据钉住「打包那枚够大」,不钉具体路径。
     */
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
      build?: { win?: { icon?: string } };
    };
    const icon = pkg.build?.win?.icon;
    expect(icon, "build.win.icon 没配 —— Windows 打包会用默认图标").toBeTruthy();
    const file = resolve(ROOT, icon!);
    expect(existsSync(file), `build.win.icon 指向的文件不存在:${icon}`).toBe(true);

    // 只解析 PNG 的 IHDR:宽高各 4 字节,偏移 16 与 20。.ico 走另一条路(见下)。
    const buf = readFileSync(file);
    if (icon!.endsWith(".png")) {
      expect(buf.subarray(1, 4).toString("latin1"), `${icon} 不是 PNG`).toBe("PNG");
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(
        Math.min(w, h),
        `${icon} 是 ${w}×${h} —— Windows 应用图标至少要 256×256,否则 electron-builder 当场失败`,
      ).toBeGreaterThanOrEqual(256);
    } else {
      // .ico:目录项里 width/height 是 1 字节,0 表示 256
      expect(buf.readUInt16LE(2), `${icon} 不是 ico`).toBe(1);
      const count = buf.readUInt16LE(4);
      const sizes = Array.from({ length: count }, (_, i) => {
        const w = buf.readUInt8(6 + i * 16);
        return w === 0 ? 256 : w;
      });
      expect(
        Math.max(...sizes),
        `${icon} 里最大的条目只有 ${Math.max(...sizes)} —— 至少要有一档 ≥256,否则 electron-builder 当场失败`,
      ).toBeGreaterThanOrEqual(256);
    }
  });

  it("启动底色只有一个出处 —— 七个引用点不许再写死色号", () => {
    /*
     * 启动过程要经过三段底色,它们必须**完全相同**,否则会看到"闪一下":
     *
     *   Android 12+ 的系统启动画面(`values-v31` 的 windowSplashScreenBackground)
     *   → 启动主题的 windowBackground(`values` / `values-night`)
     *   → Capacitor 加载层的 activity_main 背景
     *   → 最后才被 WebView 的页面盖住
     *
     * 此前 `#0d1117` **硬编码在这七个地方**:三个 styles.xml 的
     * `windowBackground` / `colorBackground` 共五处、activity_main.xml 一处、
     * 以及 colors 文件里的定义。改一处漏一处,启动瞬间就会闪一下别的颜色 ——
     * 而这种闪变只在真机上、只持续几百毫秒,本地开发永远看不到。
     *
     * 现在色号只在 `values/ic_launcher_background.xml` 的 `launch_background` 定义一次,
     * 其余全部引用它。这条判据把「不该再写死」钉住。
     */
    const res = resolve(ROOT, "android/app/src/main/res");
    const files = [
      "values/styles.xml",
      "values-night/styles.xml",
      "values-v31/styles.xml",
      "layout/activity_main.xml",
    ];
    const hardCoded: string[] = [];
    for (const rel of files) {
      const text = readFileSync(resolve(res, rel), "utf8");
      // 只查**属性值位置**写死的色号:注释里提原值是说明来由,该留
      const code = text.replace(/<!--[\s\S]*?-->/g, "");
      if (/#0d1117/i.test(code)) hardCoded.push(rel);
    }
    expect(
      hardCoded,
      "这些文件又写死了启动底色 —— 改用 @color/launch_background:" + hardCoded.join("、"),
    ).toEqual([]);

    // 定义处必须真的在(否则上面全绿只是因为引用了一个不存在的资源)
    const colors = readFileSync(resolve(res, "values/ic_launcher_background.xml"), "utf8");
    expect(colors, "launch_background 的唯一定义不见了").toMatch(
      /<color name="launch_background">#[0-9a-fA-F]{6}<\/color>/,
    );

    // 四个文件都必须真的引用它,不能只是"没写死"却也没引用
    for (const rel of files) {
      expect(
        readFileSync(resolve(res, rel), "utf8"),
        `${rel} 没有引用 @color/launch_background`,
      ).toContain("@color/launch_background");
    }
  });

  it("应用标识五处同源 —— 改一处忘一处，Capacitor 就找不到 MainActivity", () => {
    /*
     * 同一个 `appId` 写在 **五个** 地方,各有各的用途,谁都不能落下:
     *
     *   · `capacitor.config.ts` 的 `appId`      → Capacitor 按它拼 `MainActivity` 的类名
     *   · `android/app/build.gradle` 的 `applicationId` → 真正的包名
     *   · `android/app/build.gradle` 的 `namespace`     → Java 包与 R 类
     *   · `strings.xml` 的 `package_name`      → Capacitor 运行时认平台用
     *   · `strings.xml` 的 `custom_url_scheme` → 深链接 scheme
     *
     * 前两个对不上,Capacitor 会去找一个不存在的 `com.xxx.xxx.MainActivity`,
     * 构建期看不出来、装上才崩。而这几处散在 TS / Gradle / XML 三种文件里,
     * 改项目标识时极容易只改一半。
     *
     * 改名那次(2026-09,《云隐修仙录》→《玄枢录》)正是全量替换的一轮,
     * 这类一致性只能靠判据钉住。
     */
    const cap = readFileSync(resolve(ROOT, "capacitor.config.ts"), "utf8");
    const strings = readFileSync(
      resolve(ROOT, "android/app/src/main/res/values/strings.xml"),
      "utf8",
    );
    const capId = /appId:\s*"([^"]+)"/.exec(cap)?.[1];
    expect(capId, "capacitor.config.ts 里没有 appId").toBeTruthy();

    const gradle = RAW_GRADLE;
    const appId = /applicationId\s+"([^"]+)"/.exec(gradle)?.[1];
    const namespace = /namespace\s*=\s*"([^"]+)"/.exec(gradle)?.[1];
    const pkgName = /<string name="package_name">([^<]+)<\/string>/.exec(strings)?.[1];
    const urlScheme = /<string name="custom_url_scheme">([^<]+)<\/string>/.exec(strings)?.[1];

    expect(appId, "build.gradle 里没有 applicationId").toBeTruthy();
    expect(namespace, "build.gradle 里没有 namespace").toBeTruthy();
    expect(pkgName, "strings.xml 里没有 package_name").toBeTruthy();
    expect(urlScheme, "strings.xml 里没有 custom_url_scheme").toBeTruthy();

    expect(appId, "capacitor.config.ts 的 appId 与 build.gradle 的 applicationId 不一致").toBe(
      capId,
    );
    expect(namespace, "namespace 与 applicationId 不一致").toBe(appId);
    expect(pkgName, "strings.xml 的 package_name 与 applicationId 不一致").toBe(appId);
    expect(urlScheme, "custom_url_scheme 必须与包名一致，否则深链接进不来").toBe(appId);

    // appName 同理:capacitor 的 appName 与 strings.xml 的两个显示名要一致
    const capName = /appName:\s*"([^"]+)"/.exec(cap)?.[1];
    const appName = /<string name="app_name">([^<]+)<\/string>/.exec(strings)?.[1];
    const titleName = /<string name="title_activity_main">([^<]+)<\/string>/.exec(strings)?.[1];
    expect(capName, "capacitor.config.ts 里没有 appName").toBeTruthy();
    expect(appName, "strings.xml 的 app_name 与 capacitor 的 appName 不一致").toBe(capName);
    expect(titleName, "title_activity_main 与 app_name 不一致").toBe(appName);
  });

  it("Electron 打包开着 asar —— 关掉时构建每轮都在警告「strongly not recommended」", () => {
    /*
     * `build.asar` 曾经是 **false**,来源是照搬参考仓 yunyin-xiuxian 的配置
     * (见 `package.json` 首版提交 cdce24d6,当时 name 还是 yunyin-xiuxian)。
     * 本仓从没为它写过理由,而 electron-builder 每轮构建都警告:
     *
     *   • asar usage is disabled — this is strongly not recommended
     *
     * 关掉的代价实测:
     *   · 产物 166,936,968 字节 → 开启后 164,074,083(少 2.7 MiB)
     *   · **拿不到 asar 完整性校验** —— 开启后 electron-builder 会自动执行
     *     `updating asar integrity executable resource`,关着就没有这一步
     *   · 源码与资源以散文件躺在安装目录里,谁都能直接翻
     *
     * 开启是安全的:`main.js` 只读 `app.getAppPath()` 下的 `dist/` 与 `public/`,
     * 这两个在 asar 里由 Electron 自动虚拟化;写盘只写 `app.getPath("userData")`,
     * 那在 asar 之外。实测 `electron-builder --win` 通过,`asar list` 确认
     * `/dist/index.html` 与 `/public/icons/icon-512.png` 都在归档里。
     */
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
      build?: { asar?: boolean };
    };
    expect(
      pkg.build?.asar,
      "build.asar 必须显式 true —— 关掉会丢 asar 完整性校验,且构建每轮警告",
    ).toBe(true);
  });

  it("流水线确实优先取仓库里那份正文", () => {
    expect(BUILD).toMatch(/NOTES="docs\/release-notes\/\$\{GITHUB_REF_NAME\}\.md"/);
    expect(BUILD, "落回自动生成时应当留一条日志,别让发版悄悄降级").toMatch(/不存在[^\n]*自动生成/);
  });
});
