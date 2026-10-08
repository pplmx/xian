import { resolve } from "node:path";
import { defineConfig, lazyPlugins } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  fmt: {},
  staged: {
    "*.{ts,tsx,vue}": "vp check --fix",
    "*.{mjs,cjs,json}": "vp fmt",
    /* markdown 门:staged 里提交的 .md 直接经 rumdl 查(与全量 verify 里的
       docs-check→rumdl 同一份 rumdl.toml),让提交这一步就拦下坏的 md,
       不等到重活 verify 尾巴 —— 与 CI 对文档的门一致。lint-staged 会自动把
       本次暂存的 .md 列表追加到命令后。 */
    "*.md": "bunx --no-install rumdl check",
  },
  run: {
    tasks: {
      /* 一次跑完整套门禁 —— 提交/推送前该过的全过:
         type-check + 全仓 oxlint + docs-check、全量测试、文档例数对账、
         生产构建、引擎子树同树、独立仓模拟(后两步最容易忘,缓存会掩盖
         引擎回归 —— 见 memory 续十四之二)。

         cache: false 保留,理由有二:
          ① 引擎两段(check:engine / standalone)必须每次真跑,内容缓存会掩盖
             引擎回归 —— 这正是当初设 cache:false 的原因;
          ② 其余步骤(check/test/build)走的是 package.json script,默认本就不
             参与内容缓存(要缓存得开 run.cache.scripts,而那会把引擎两段也
             一并变成可缓存,与「每次都真跑」相悖)。故这里不折腾选择性缓存,
             去重交给下面两步——真正的耗时在重复,不在缓存。

         去重:测试只跑一遍 —— `bun run test`(vp test run)一次把结果落成
         JSON(test.reporters 里的 json reporter),`test:report` 用
         VERIFY_SHARED_VITEST_JSON=1 复读同一份,不再二跑全量 vitest;
         vue-tsc 整链也只跑一遍 —— check 里的 type-check 已过,构建这步直接
         `vp build` 打包(见 scripts/test-report.mjs 与 scripts/engine-dist.mjs)。 */
      verify: {
        cache: false,
        command: [
          "bun run check",
          "bun run test",
          "VERIFY_SHARED_VITEST_JSON=1 bun run test:report",
          "vp build",
          "bun run check:engine",
          "bun run check:engine:standalone",
        ],
      },
    },
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "vue"],
    categories: {
      correctness: "warn",
    },
    env: {
      builtin: true,
      browser: true,
      node: true,
      serviceworker: true,
      worker: true,
    },
    ignorePatterns: ["dist/**", "node_modules/**"],
    rules: {
      "no-array-constructor": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": "error",
      "vue/no-arrow-functions-in-watch": "error",
      "vue/no-async-in-computed-properties": "error",
      "vue/no-computed-properties-in-data": "error",
      "vue/no-deprecated-data-object-declaration": "error",
      "vue/no-deprecated-destroyed-lifecycle": "error",
      "vue/no-deprecated-events-api": "error",
      "vue/no-deprecated-props-default-this": "error",
      "vue/no-deprecated-vue-config-keycodes": "error",
      "vue/no-dupe-keys": "error",
      "vue/no-export-in-script-setup": "error",
      "vue/no-expose-after-await": "error",
      "vue/no-lifecycle-after-await": "error",
      "vue/no-reserved-component-names": "error",
      "vue/no-reserved-keys": "error",
      "vue/no-reserved-props": "error",
      "vue/no-shared-component-data": "error",
      "vue/no-side-effects-in-computed-properties": "error",
      "vue/no-watch-after-await": "error",
      "vue/prefer-import-from-vue": "error",
      "vue/require-prop-type-constructor": "error",
      "vue/require-render-return": "error",
      "vue/require-slots-as-functions": "error",
      "vue/return-in-computed-property": "error",
      "vue/return-in-emits-validator": "error",
      "vue/valid-define-emits": "error",
      "vue/valid-define-props": "error",
      "vue/valid-next-tick": "error",
      "vue/component-definition-name-casing": "warn",
      "vue/prop-name-casing": "warn",
      "vue/require-default-prop": "warn",
      "vue/require-prop-types": "warn",
      "vue/no-multiple-slot-args": "warn",
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
      "typescript/ban-ts-comment": "error",
      "typescript/no-duplicate-enum-values": "error",
      "typescript/no-empty-object-type": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-extra-non-null-assertion": "error",
      "typescript/no-misused-new": "error",
      "typescript/no-namespace": "error",
      "typescript/no-non-null-asserted-optional-chain": "error",
      "typescript/no-require-imports": "error",
      "typescript/no-this-alias": "error",
      "typescript/no-unnecessary-type-constraint": "error",
      "typescript/no-unsafe-declaration-merging": "error",
      "typescript/no-unsafe-function-type": "error",
      "typescript/no-wrapper-object-types": "error",
      "typescript/prefer-as-const": "error",
      "typescript/prefer-namespace-keyword": "error",
      "typescript/triple-slash-reference": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
        rules: {
          "constructor-super": "off",
          "getter-return": "off",
          "no-class-assign": "off",
          "no-const-assign": "off",
          "no-dupe-class-members": "off",
          "no-dupe-keys": "off",
          "no-func-assign": "off",
          "no-import-assign": "off",
          "no-new-native-nonconstructor": "off",
          "no-obj-calls": "off",
          "no-redeclare": "off",
          "no-setter-return": "off",
          "no-this-before-super": "off",
          "no-undef": "off",
          "no-unreachable": "off",
          "no-unsafe-negation": "off",
          "no-var": "error",
          "no-with": "off",
          "prefer-const": "error",
          "prefer-rest-params": "error",
          "prefer-spread": "error",
        },
      },
      {
        /* 字形覆盖审计的夹具:spec 注释里有它要证明的字面全角空格(U+3000 起),
           那才是夹具本体 —— oxlint 的 no-irregular-whitespace 会把它误判为笔误,
           真改掉那行注释,审计文档就失真了。按类别放行这一条,别按「修注释」处理。 */
        files: ["src/ui/kaiFontCoverage.spec.ts"],
        rules: {
          "no-irregular-whitespace": "off",
        },
      },
      {
        /* CLI 脚本的输出通道就是 console:docs-check/test-report/engine-* 的打印
           是给人跟 CI 读的契约,不是调试残留,也不该改走日志库(那是纯搅动)。
           只放行 scripts/ 目录——src 侧若冒出 console 照旧被钉。 */
        files: ["scripts/**"],
        rules: {
          "no-console": "off",
        },
      },
      {
        /* Electron 沙箱 preload 只能用 CommonJS:BrowserWindow 未开 sandbox:false
           时 ESM preload 根本不加载 —— 这句 require 是平台强制的形态,不是残留。 */
        files: ["electron/preload.js"],
        rules: {
          "no-require-imports": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  base: "./",
  // 生产代码净化交给 oxc(默认压缩器)与 lint 兜底,删掉了死在转译层里的
  // esbuild 块:oxc 接手后那句 "esbuild options will be ignored" 警告指明
  // drop/pure/legalComments 全部失效。诚实的迁移结论:
  //   · dropDebugger —— 应用源码零 debugger(lint 禁),全产物也零,无需配置
  //   · dropConsole / drop:['console'] —— 刻意不用:全灭会连 App.vue 全局
  //     errorHandler 的 console.error 一起删掉,线上问题无从查起
  //   · pure:['console.log'…] —— oxc 无对应;应用源码本就零调试 console,
  //     唯一的第三方残留 Tone 版本横幅由 TONE_SILENCE_LOGGING 静默(audio.ts)
  plugins: lazyPlugins(() => [
    vue({
      template: {
        compilerOptions: {
          comments: false,
        },
      },
    }),
  ]),
  resolve: {
    alias: {
      // 用 import.meta.dirname 而非 __dirname:Vite 8 的 configLoader: 'native'
      // (未来版本的默认值)不提供 CJS 那套变量,继续用 __dirname 会在切换后报错
      "@": resolve(import.meta.dirname, "src"),
      /*
       * 根别名:src 里想读仓库根的少数稳定文件(package.json 的 version 等)走它,
       * 免得散落 `../../..` 这种跨目录相对导入。只读、不改,演进时别用熟。
       */
      "@root": resolve(import.meta.dirname),
      /*
       * 公共库按**包名**解析 —— 应用侧源码里写的就是 `from 'wanxiang-engine'`,
       * 与"别人装了包再用"时一模一样。
       *
       * 依赖本身是真的:`package.json` 里声明了 `workspace:*`(库就在 `packages/engine`),
       * `bun install` 会建软链,node 侧脚本与工具链都按普通依赖解析它(判据见
       * `scripts/engine-dist.mjs` 的第 ⑦ 条)。**这一行只是开发加速通路**:指到源码,
       * 改库立刻热更新,不必先 build。去掉它照样能用 —— 那时解析的是 `dist`(记得 build)。
       */
      "wanxiang-engine": resolve(import.meta.dirname, "packages/engine/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    // 应用自身的用例在 src/,公共库的用例在 packages/engine —— 两边都要跑
    include: ["src/**/*.spec.ts", "packages/engine/**/*.spec.ts"],
    // 平衡审计类用例(buildSim / celestialSim / synergyScan / worldGen 等)
    // 单个要跑上万次模拟,单独执行约 2 秒,但 97 个文件并行时互相抢 CPU 会顶到
    // vitest 的 5 秒默认上限 —— 切到 bun 后并行度更高,synergyScan 实测 5227ms 超时。
    // 放宽的是**并行竞争的余量**,不是掩盖变慢:该用例单跑仍是 1.8~2.0 秒
    testTimeout: 20000,
    // 把转译缓存落到磁盘,跨运行复用:vitest 实录里 transform 占了八成追踪时间,
    // 而本仓 118k 行 + 293 份 spec 每次都要在「并行开跑前」整份重新转译一次。
    // fsModuleCache 按内容哈希失效 —— 改过的文件照常重转,没改的不再重算。
    fsModuleCache: true,
    // 让任何一次 vitest 运行把完整结果也落成 JSON(test:report 复读同一份,
    // 免得 verify 里跑第二遍全量 vitest —— 见 scripts/test-report.mjs)。
    // 人看的默认 reporter 照常打,JSON 只是旁路产物,写进已 gitignore 的 .vitest/。
    reporters: ["default", "json"],
    outputFile: { json: ".vitest/vitest-report.json" },
  },
});
