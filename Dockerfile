# ===== Stage 1: 构建阶段 =====
# 钉死与 package.json 的 packageManager(bun@1.4.2)一致:浮动的 :1 标签
# 会在 bun 出新版时悄悄换基础镜像,而锁文件与安装行为都可能随之漂移。
FROM oven/bun:1.4.2-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock* ./

# 复制 workspace 子包的 manifest
# 根 package.json 声明了 "workspaces": ["packages/*"] 且依赖 "wanxiang-engine": "workspace:*"，
# bun install --frozen-lockfile 会校验 lock 里登记的 workspace 是否真实存在；
# 若 packages/engine 还没进镜像，会直接报
# "the root package depends on workspace \"wanxiang-engine\" (packages/engine), which is listed in bun.lock but not on disk"。
# 只复制 manifest 而非整目录，保持依赖层缓存不被源码变更击穿。
COPY packages/engine/package.json ./packages/engine/

# 安装依赖(--frozen-lockfile 保证依赖锁定)
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 构建生产版本
RUN bun run build

# ===== Stage 2: 生产阶段(Nginx 服务) =====
FROM nginx:alpine

# 安装 tzdata 设置时区
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 暴露端口
EXPOSE 80

# 启动 Nginx(前台运行)
CMD ["nginx", "-g", "daemon off;"]
