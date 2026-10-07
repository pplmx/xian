# 安全策略

## 报告漏洞

请**不要**用公开 issue 报安全问题。用 GitHub 的
[私密漏洞报告](https://github.com/pplmx/wanxiang-engine/security/advisories/new)
(仓库的 **Security → Report a vulnerability**),或直接给维护者发私信。

报告时尽量带上:影响范围、触发条件、最小复现,以及你期望的行为。

## 支持范围

- 只维护**最新一个 0.x 版本**的修复(见 [CHANGELOG](./CHANGELOG.md));更早的版本请先升级。
- 0.x 期间不承诺 API 稳定,但**默认值与旧行为**在未显式配置时保持逐位一致。

## 攻击面(为什么它很小)

引擎是**纯函数 + 数据结构**的库,刻意不碰这些东西:

- 不做任何网络 / 文件 / 进程 IO —— 存储介质、账号云同步、服务端接口都由使用方接;
- 不读环境变量、不写全局状态、不依赖浏览器 API;
- 唯一的平台原语是 `Math.random`(只在显式命名、供非复现场合用的 `randomRng` 里)
  与 `encodeSave` 的一个可传参默认 `Date.now()`。

所以可报告的安全问题多半落在两类:**内容解析**(把不可信的存档 / 配置喂进 `normalize`
或 `runMigrations` 时的形状处理),以及**依赖链**(本包零运行时依赖;开发依赖的问题
请在报告里注明是 dev-only)。
