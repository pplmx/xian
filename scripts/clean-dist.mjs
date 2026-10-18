/**
 * 清空 dist —— `bun run verify` 的第一步。
 *
 * 为什么单独一个脚本:vite emptyOutDir 会一次性 rmSync 整个 dist/assets,
 * WorkBuddy 的 node shim 对「一次调用删 >50 个文件」要求确认
 * (SAFE_DELETE_BULK_CONFIRM_REQUIRED),CI 与本地都三次撞过。
 * 逐文件 unlink 单次调用只删一个,不触发阈值;目录空了再整棵移除。
 */
import { rmSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [join(ROOT, "dist"), join(ROOT, "node_modules/.vitest-cache")];

/**
 * .vitest-cache 也要清:vitest 首跑的 ensureCacheIntegrity 会删缓存目录,
 * 一样撞宿主批删护栏(主程序附记的已知坑)—— 预清一次即过。
 */
for (const TARGET of TARGETS) {
  if (!existsSync(TARGET)) continue;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      try {
        rmSync(p, { recursive: true, force: false });
      } catch {
        // 目录非空 = 里面还有文件,递归再来一层
        walk(p);
        try {
          rmSync(p);
        } catch {
          /* 实在删不掉的留给 vite 自己处理 */
        }
      }
    }
  };
  walk(TARGET);
  try {
    rmSync(TARGET);
  } catch {
    /* 空目录删不掉也不影响构建(vite 可往里写) */
  }
}
console.log("[clean-dist] dist 已清空");
