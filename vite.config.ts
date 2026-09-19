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
    legacy({
      targets: ['Chrome >= 51', 'Android >= 7'],
      modernPolyfills: true
    })
  ],
  resolve: {
    alias: {
      // 用 import.meta.dirname 而非 __dirname:Vite 8 的 configLoader: 'native'
      // (未来版本的默认值)不提供 CJS 那套变量,继续用 __dirname 会在切换后报错
      '@': resolve(import.meta.dirname, 'src'),
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
    testTimeout: 20000
  }
})
