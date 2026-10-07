# 参与贡献

先谢谢你看这个库。这份文件只说三件事:**什么改动会被接受**、**动之前跑什么**、**交 PR 时带什么**。

## 什么改动会被接受

库已经进入**维护期**(见 [docs/development.md](./docs/development.md) 的「维护期」一节)—— 这不是"关门",
而是把"为什么动它"写清楚,免得功能越长越多、每处都半新:

| 会被接受 | 为什么 |
| --- | --- |
| **真错**:行为与文档或判据说的不一致 | 先补一条**会红**的判据,再修 —— 让错误不会再回来 |
| **判据漏洞**:某一类腐烂没人盯着 | 补一条机器门;文档片段只编不跑、死链、相对导入缺 `.js` 都是这么补上的 |
| **文档与实现不一致** | 十八道常驻自检会先替你抓一遍(`bun run check`) |
| **性能/可读性的内部重构** | 不改公开面、不改默认数值即可;不占 CHANGELOG 条目 |

**不会**被接受的:新增能力层。要新玩法请在**库外组合**已有的层 ——
配方见 [组装指南](./docs/assembly.md);库里只留"一层回答一个问题"的通用件。

## 动之前跑什么

都在 `packages/engine/` 下:

```bash
bun install        # 只装 typescript + vite-plus + publint + attw + @types/node
bun run check      # 类型检查 + 用例 + 出产物 + 18 道自检 + 发布包自检 + 跑示例 + 包形态门
bun run tuning     # 31 份消融的读数(只有改了数值或曲线时才需要)
```

两条硬纪律:

- **默认不变**:不显式配置任何东西时,行为与旧实现**逐位一致**(`baseline.spec.ts` 与
  `docs/parity.md` 的对账守着);
- **随机流是契约**:保底**改写结果而不跳过掷骰**;周期类的东西**不消耗全局随机流**。

## 交 PR 时带什么

1. **先写会红的判据**:修错先补一条复现用例;加判据先让它对旧实现红。
2. **公开面变了就显式改清单**:`src/publicApi.spec.ts` 钉着运行时长导出的名单与每个模块的公开类型,
   增删都要改它 —— 顺带就是一次"这是不是破坏性变更"的自问。
3. **对使用者有影响的改动写进 `CHANGELOG.md` 的「未发布」一节**(内部重构不占条目)。
4. **跑一遍完整 `bun run check`**,并在 PR 里贴出最后几行的读数。

## 开发环境

- 包管理 / 运行时:[Bun](https://bun.sh);
- 工具链:[Vite+](https://viteplus.dev/)(`vp`)—— `bun run check` 里的 `vp test run` 就是它;
- 引擎的用例在 `src/*.spec.ts`(每层一份),消融读数在 `src/*.sim.spec.ts`,跨模块不变量在 `src/integration*.spec.ts`。

提交信息用 [Conventional Commits](https://www.conventionalcommits.org/)(`fix` / `test` / `docs` / `refactor` …)。
