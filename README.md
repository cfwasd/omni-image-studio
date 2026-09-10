# OmniImage Studio (全象生图站 & App)

多协议兼容、自带提示词智能增强、支持多端云同步的极简专业生图工作台。

---

## 🌟 核心特性

- **多协议生图网关**：内置抹平 OpenAI Images 规范 (`/v1/images/generations`)、SD WebUI 规范 (`/sdapi/v1/txt2img` & `/img2img`)、聚合中转站与开源生图服务。
- **提示词智能扩写工坊**：集成 LLM 魔法棒，输入简短中文即可一键转写为结构化专业英文 Prompt，规避肢体缺陷与生成杂音。
- **全象创作工作台**：支持文生图 (T2I)、图生图 (I2I，上传参考底图+控制重绘幅度)、画幅比例调控 (1:1、4:3、16:9、9:16 等)、采样步数与种子数精确调优。
- **历史画廊与 Inspector 参数回溯**：瀑布流浏览历史出图、收藏筛选、全量元数据查看、**一键全量复用参数带回工作台**、**一键以此图继续图生图**。
- **系统与服务配置中心**：
  - **PostgreSQL 状态**：连接状态检测、毫秒级延迟拨测 (Ping)、数据资产统计。
  - **阿里云 OSS 在线配置**：AccessKey 密文脱敏管理、自定义 CDN 域名、**在线读写连通性测试 (Test Ping)**。
  - **生图服务多提供商管理**：多配置添加、连通性测试、一键切换激活。
  - **LLM 扩写引擎配置**：Base URL / Key / 自定义 System Prompt 模板。
- **简易实用账号体系**：JWT 会话、Cookie 保持、首位注册用户自动提权为管理员、多用户数据与 API Key 严格隔离。

---

## 🐳 Docker 生产部署指南（推荐）

由于您已拥有现成的 **PostgreSQL** 和 **阿里云 OSS**，容器本身完全保持**无状态 (Stateless)**，更新镜像或重启绝不丢失任何出图数据。

### 1. 准备环境变量文件 `.env`

复制并编辑环境变量：
```bash
cp .env.example .env
```
填入您的 PG 连接串与 OSS 凭据（也可以只填 PG，OSS 启动后在页面里点选保存）：
```env
DATABASE_URL="postgresql://username:password@your-pg-host:5432/omni_image?schema=public"
JWT_SECRET="your-secure-random-jwt-key"
```

### 2. 初始化 PostgreSQL 表结构

在项目根目录执行一次同步脚本（Prisma 会自动在您的 PG 中创建所有表）：
```bash
pnpm prisma db push
```

### 3. 一键启动 Docker 容器

使用 Docker Compose：
```bash
docker compose up -d --build
```
或者使用原生 Docker 构建与启动：
```bash
docker build -t omni-image-studio .
docker run -d -p 3000:3000 --name omni-image-studio --env-file .env omni-image-studio
```

启动完成后，直接在浏览器中访问：`http://localhost:3000` 或服务器公网 IP 即可！

---

## 💻 本地开发运行

```bash
# 1. 安装依赖
pnpm install

# 2. 生成 Prisma 客户端
pnpm prisma generate

# 3. 启动开发服务器
pnpm dev
```
开发服务器地址：`http://localhost:3000`。
