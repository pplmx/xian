# 部署与安装

游戏有三种客户端形态(Web / PWA、Android、Windows 桌面)与一种自托管方式(Docker),
都由同一份 `dist/` 产物而来。开发与构建命令见 [development.md](./development.md)。

## Web / PWA

把 `bun run build` 产出的 `dist/` 交给任意静态服务器即可(或走下方 Docker 镜像)。

- 移动浏览器打开即玩,可「添加到主屏幕」;
- Service Worker 会缓存静态资源:**首次在线打开后,断网重开也能进游戏**;
  发版更新即时生效,不会卡在旧版本;
- **iOS 上请务必「添加到主屏幕」**:Safari 会在网页七天没被打开后清掉它的本地数据
  (存档与离线缓存一起没),而已安装的 Web App 不受这条规则约束 ——
  游戏检测到这种情况会在主页提示一次,设置页里也常驻可查。

## Android

CI 会把签好的 APK 作为 `android-apk` 产物上传;本地出包在
`android/app/build/outputs/apk/release/xuanshu-<版本号>.apk`。
把 APK 传到手机后点击安装(系统会提示允许安装未知来源应用,放行即可);
覆盖安装需签名一致 —— 自己构建的包与官方签名不同,要先卸载旧版。

```bash
bun run build:android    # 同步 Web 产物到 Android 工程(Capacitor)
bun run build:apk        # 直接出 Release APK
```

## Windows 桌面(Electron)

```bash
bun run build:electron   # 输出 pkg/xuanshu-<版本号>-win.zip
```

解压后运行其中的 `玄枢录.exe`。未签名 exe 被杀毒软件误报是通病,加入白名单即可。

## Docker

### 方式一:使用预构建镜像(推荐)

每次推送到 `main` 或打 `v*.*.*` 标签,GitHub Actions 都会构建并推送多架构镜像
(`linux/amd64` + `linux/arm64`):

```bash
# 最新版本
docker run -d -p 8080:80 ghcr.io/pplmx/xian:latest

# 指定版本号(取 package.json 的 version,把下面的 <version> 换成实际版本号)
docker run -d -p 8080:80 ghcr.io/pplmx/xian:<version>

# 指定提交
docker run -d -p 8080:80 ghcr.io/pplmx/xian:<commit-sha>
```

若仓库配置了 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`,同一份镜像会额外推送到 Docker Hub 的
`<user>/xian`,标签一致。

### 方式二:本地构建镜像

```bash
docker build -t xuanshu:latest .
docker build -t xuanshu:<version> .
```

### 方式三:docker compose

`docker-compose.yml` 已配好端口、时区、资源限制与日志滚动,适合自托管:

```bash
docker compose up -d        # 启动
docker compose logs -f      # 查看日志
docker compose down         # 停止
docker compose restart      # 重启
```

Compose v1 的旧 CLI 把命令换成 `docker-compose` 即可(`docker-compose.yml` 用的是 Compose v2 格式,
没有 `version:` 字段)。启动后浏览器打开 <http://localhost:8080> 即可开始游戏。

## 镜像架构

- **构建阶段**:`oven/bun:1-alpine`,`bun install --frozen-lockfile` 后跑 `bun run build`;
- **生产阶段**:`nginx:alpine` + `dist/`(约 4MB 静态产物)+ `nginx.conf`,多阶段构建让最终镜像
  只比基础 nginx 多这一份产物;
- **CI 镜像**:`Dockerfile.ci` 不在容器内构建 —— 前端由 runner 上的 Bun 构建好,镜像只负责把
  `dist/` 与 `nginx.conf` 拷进去,多架构构建因此不必在 QEMU 里重跑 `vue-tsc` 与 `vite`
  (配合 `.dockerignore.ci` 使用:工作流会先把它覆盖到 `.dockerignore`);
- **时区**:Asia/Shanghai;**端口**:80(容器内)→ 8080(宿主机);
- **健康检查**:内置 `HEALTHCHECK`,每 30 秒 `wget` 探测一次首页。

## 生产部署建议

### 构建配置

镜像构建本身无需改任何配置:`vite.config.ts` 把 `base` 固定为 `'./'`,资源按相对路径解析,
音频走 `import.meta.env.BASE_URL`,所以部署到 `/` 或 `/xiuxian/` 这类子路径都能直接工作。

`.env.production` 里的 `VITE_APP_TITLE` / `VITE_BASE_URL` / `VITE_ENABLE_PWA` 目前只是占位
(没有代码消费,页面标题写在 `index.html`),改了不生效,别把它们当成部署开关。
注意 **PWA「添加到主屏幕」与这些 env 无关**:manifest(`public/manifest.webmanifest`)与图标
由 `index.html` 无条件引用、`public/` 原样进构建,随镜像一起开箱即用;
改动图标的正确姿势是改 `public/icon.svg` 后跑 `scripts/gen-pwa-icons.mjs` 重新生成。

### Nginx 配置

`nginx.conf` 已包含:Gzip 压缩(超过 1KB 的文本资源才压)、静态资源缓存(JS/CSS/图片/字体
缓存 1 年,`index.html` 走 `no-cache`)、安全头(XSS / 点击劫持 / MIME 嗅探防护 + Referrer-Policy)、
Vue Router 兜底(`try_files ... /index.html`,刷新不 404)、隐藏文件拒绝访问。

### 资源限制

`docker-compose.yml` 已设置:CPU 最多 1 核(预留 0.25)、内存最多 512MB(预留 128MB)、
日志滚动单文件 10MB 保留 3 个。

## 反向代理与 HTTPS

使用 Traefik / Nginx Proxy Manager / Caddy 时:

```yaml
# docker-compose.yml 增加 labels
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.xian.rule=Host(`xiuxian.example.com`)"
  - "traefik.http.routers.xian.tls=true"
```

HTTPS 两种做法:

- **方案 A(推荐)**:在反向代理层终止 SSL,容器继续保持 `:80` 明文;
- **方案 B**:容器内启用 HTTPS,挂载证书到 `/etc/nginx/ssl/` 并改 `nginx.conf`。

游戏用 hash 路由(`base: './'`),反向代理一般无需特殊重写规则;把站点根路径指到容器 `:80` 即可。

## 健康检查与存档

```bash
docker inspect --format='{{.State.Health.Status}}' xuanshu   # 查看健康状态
docker exec xuanshu wget -qO- http://localhost/              # 手动探测
```

**存档在客户端浏览器 localStorage,不在容器内**(键名带 `xuanshu.` 前缀),因此容器重建不影响存档;
换环境时用游戏内的导出 / 导入(`.save` 文件)迁移。

## 故障排查

```bash
docker logs xuanshu                 # 启动失败先看日志
docker exec -it xuanshu sh          # 进容器检查
ls -lh /usr/share/nginx/html/
docker run -p 3000:80 xuanshu:latest   # 端口冲突时换映射
docker stats xuanshu                # 资源占用
```

- **页面白屏或资源 404**:先看 `docker logs` 与浏览器 Network 面板。`base: './'` 下资源走相对路径,
  子路径部署一般不会因此 404;若确实拉不到资源,多半是反向代理改写了 URL 前缀或没把整站交给容器;
- **资源限制不够**:改 `docker-compose.yml` 的 `deploy.resources.limits`(例如 `cpus: '2'`、`memory: 1G`);
- **清理**:`docker compose down`(停容器)、`docker rmi xuanshu:latest`(删镜像)、
  `docker system prune -a`(清理未使用的镜像与缓存)。

## CI/CD

`.github/workflows/xuanshu.yml` 在 push 到 `main`、打 `v*.*.*` 标签或手动触发时执行:
`bun run check` + `bun run test` 全绿 → `bun run build` → 校验 `dist/index.html` →
用 `Dockerfile.ci` 构建多架构镜像 → 推送 GHCR(`latest` / 版本号 / commit sha 三个标签);
配置了 Docker Hub 凭据时同样推送一份。

要在自己的 fork 里发布镜像,把上面这套步骤照抄即可:

```yaml
      - run: bun install --frozen-lockfile
      - run: bun run check && bun run test
      - run: bun run build
      - run: cp .dockerignore.ci .dockerignore
      - uses: docker/build-push-action@v7
        with:
          context: .
          file: ./Dockerfile.ci
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/xian:latest
            ghcr.io/${{ github.repository_owner }}/xian:${{ github.ref_name }}
```
