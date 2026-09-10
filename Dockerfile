# ==========================================
# 阶段 1: 依赖依赖安装与构建环境
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@10.15.1

# 安装构建所需依赖
COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma/

# 安装依赖并生成 Prisma Client
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate

# 拷贝全量源码
COPY . .

# 执行 Next.js 生产构建 (standalone 输出)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# ==========================================
# 阶段 2: 极轻量运行时镜像 (Runner)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建非 root 运行用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 从构建阶段拷贝 standalone 产物与静态资源
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
