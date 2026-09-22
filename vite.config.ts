/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  base: './',
  esbuild: {
    // 只丢 debugger 与调试级 console:console.error/warn 必须留在生产构建里。
    // 全量 drop:['console'] 会把 App.vue 全局 errorHandler 的 console.error 一并删掉,
    // 玩家侧只剩「出现异常,已记录」的 toast 而没有任何堆栈,线上问题无从查起
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
    legalComments: 'none'
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          comments: false
        }
      }
    }),
    /*
     * legacy 只在**发布**时打(XIAN_LEGACY=1,见 package.json 的 build:release)。
     *
     * 它是给 Chrome 51 / Android 7 那批老内核兜底的产物:每次构建都要把每个 chunk
     * 再走一遍 babel + SystemJS 打包。实测本机 32s 的构建里 26s(82%)花在这一步、
     * 106 次调用 —— 而开发、PR 门、单元测试都不需要它:那些环境跑的是现代浏览器,
     * legacy 产物一个字节都不会被请求。
     *
     * 所以规矩是「**要发出去的那一份才带 legacy**」:Pages 部署、Electron、APK 都走
     * build:release;日常构建与 CI 门走 build。legacy 还在不在,由
     * `bun scripts/legacy-artifacts.mjs` 在发布路径上当场核(见 .github/workflows)。
     */
    ...(process.env.XIAN_LEGACY === '1'
      ? [
          legacy({
            targets: ['Chrome >= 51', 'Android >= 7'],
            modernPolyfills: true
          })
        ]
      : [])
  ],
  resolve: {
    alias: {
      // 用 import.meta.dirname 而非 __dirname:Vite 8 的 configLoader: 'native'
      // (未来版本的默认值)不提供 CJS 那套变量,继续用 __dirname 会在切换后报错
      '@': resolve(import.meta.dirname, 'src'),
      /*
       * 根别名:src 里想读仓库根的少数稳定文件(package.json 的 version 等)走它,
       * 免得散落 `../../..` 这种跨目录相对导入。只读、不改,演进时别用熟。
       */
      '@root': resolve(import.meta.dirname),
      /*
       * 公共库按**包名**解析 —— 应用侧源码里写的就是 `from 'wanxiang-engine'`,
       * 与"别人装了包再用"时一模一样。
       *
       * 依赖本身是真的:`package.json` 里声明了 `workspace:*`(库就在 `packages/engine`),
       * `bun install` 会建软链,node 侧脚本与工具链都按普通依赖解析它(判据见
       * `scripts/engine-dist.mjs` 的第 ⑦ 条)。**这一行只是开发加速通路**:指到源码,
       * 改库立刻热更新,不必先 build。去掉它照样能用 —— 那时解析的是 `dist`(记得 build)。
       */
      'wanxiang-engine': resolve(import.meta.dirname, 'packages/engine/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    // 应用自身的用例在 src/,公共库的用例在 packages/engine —— 两边都要跑
    include: ['src/**/*.spec.ts', 'packages/engine/**/*.spec.ts'],
    // 平衡审计类用例(buildSim / celestialSim / synergyScan / worldGen 等)
    // 单个要跑上万次模拟,单独执行约 2 秒,但 97 个文件并行时互相抢 CPU 会顶到
    // vitest 的 5 秒默认上限 —— 切到 bun 后并行度更高,synergyScan 实测 5227ms 超时。
    // 放宽的是**并行竞争的余量**,不是掩盖变慢:该用例单跑仍是 1.8~2.0 秒
    testTimeout: 20000,
    // 把转译缓存落到磁盘,跨运行复用:vitest 实录里 transform 占了八成追踪时间,
    // 而本仓 118k 行 + 293 份 spec 每次都要在「并行开跑前」整份重新转译一次。
    // fsModuleCache 按内容哈希失效 —— 改过的文件照常重转,没改的不再重算。
    fsModuleCache: true
  }
})
