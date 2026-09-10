# OmniImage Studio (全象生图站 & App) - 产品需求规格说明书 (PRD)

## 1. Project Name & One-Liner
* **Project Name**: OmniImage Studio (全象生图)
* **One-Liner**: 一款多协议兼容、自带提示词智能增强、支持多端云同步的极简专业生图工作台。

---

## 2. User Stories (Must-Have)

### 2.1 鉴权与配置 (Auth & Settings)
* **US-01**: As a 用户, I want to 通过邮箱与密码快速注册/登录, so that 我的接口配置与历史出图资产可以在 Web 与未来的 App 间云端同步。
* **US-02**: As a 开发者/资深玩家, I want to 在设置中配置多种生图服务协议（OpenAI Images 规范、SD WebUI 规范、Fal.ai 规范等）, so that 我可以直接填入自建 API、聚合中转站或开源算力接口进行生图。
* **US-03**: As a 用户, I want to 独立配置一个文本 LLM（OpenAI 兼容协议的 Endpoint + API Key）, so that 系统可以调用大模型帮我进行提示词中英翻译与画面扩写。

### 2.2 提示词智能工坊 (Prompt Workshop)
* **US-04**: As a 用户, I want to 输入简短的中文自然语言描述并点击“智能扩写”, so that LLM 能够自动生成结构化的高质量英文正向提示词和规避缺陷的负向提示词。
* **US-05**: As a 用户, I want to 快捷点选画面风格标签（如摄影质感、赛博朋克、动漫原画、光影构图等）, so that 我能低成本地组合出专业生图修饰词。

### 2.3 核心生图工作流 (Creation Studio)
* **US-06**: As a 用户, I want to 进行**文生图 (Text-to-Image)**，选择画面画幅（1:1、4:3、16:9、9:16）、步数、采样器及种子数, so that 我能精准把控图像的生成构图与质量。
* **US-07**: As a 用户, I want to 进行**图生图 (Image-to-Image)**，上传本地图片作为参考底图，并调节重绘幅度 (Denoise Strength) 和提示词引导强度, so that 能够在保留原图构图/线稿的前提下生成衍生作品。
* **US-08**: As a 用户, I want to 在提交生图任务后获得清晰的进度状态反馈（排队中、生成中、失败原因提示、成功即时展示）, so that 我清楚感知当前的渲染进度。

### 2.4 资产画廊与历史回溯 (Gallery & Inspector)
* **US-09**: As a 用户, I want to 在画廊中以瀑布流/网格形式浏览我的全部历史出图记录，并支持按收藏与时间筛选, so that 我能高效检索过往作品。
* **US-10**: As a 用户, I want to 点击历史图片查看其全尺寸大图及全量生成元数据（Prompt、Negative Prompt、Seed、协议类型、生图参数）, so that 我可以一键“复制参数”或“全量带回工作台再次微调生成”。
* **US-11**: As a 用户, I want to 在历史详情中一键将此图片“设为参考图发送到图生图”, so that 我能快速开展迭代创作流程。

---

## 3. Pages/Screens

### 3.1 全局布局架构 (Responsive Shell)
* **Desktop 视图**：
  * 左侧/顶部导航栏：[创作工作台] / [历史画廊] / [API 配置中心] / [用户中心]。
  * 创作页采用双栏/三栏设计：左侧为控制与参数面板（含 Prompt 优化区），右侧为主画布（实时预览区与最近生成结果）。
* **Mobile / App 视图**：
  * 底部 Tab 导航：[创作]、[画廊]、[我的/设置]。
  * 控制面板采用抽屉（Bottom Sheet）或滑动分段标签页，核心操作区保持高拇指热区友好度。

### 3.2 页面结构与关键元素

#### 页面 1：创作工作台 (Studio / Workspace)
* **模式切换器**：[文生图 (T2I)] / [图生图 (I2I)] Segmented Control。
* **生图服务选择**：下拉菜单选择当前激活的接口预设（如 "聚合中转站-Flux" / "自建SD-WebUI"）。
* **Prompt 交互区**：
  * 正向提示词输入框（多行文本域，支持字符计数）。
  * “魔法棒”优化按钮：点击触发 LLM 优化弹层（展示：原词 -> 优化后正向词 + 推荐负向词 -> [应用到输入框]）。
  * 常用预设标签选择盘（可折叠横向滑动标签 Chip）。
  * 负向提示词输入框（Negative Prompt）。
* **图生图专用区（I2I 模式下展示）**：
  * 参考图拖拽上传/画廊选取占位卡片（支持更换与移除）。
  * 去噪强度/相似度（Denoise Strength）滑块（0.0 ~ 1.0，默认 0.75）。
* **通用参数调控面板**：
  * 画幅比例选择器：预设图标（1:1 方图, 3:4 纵向, 4:3 横向, 16:9 宽屏, 9:16 移动竖屏, 自定义宽高）。
  * 进阶折叠面板（Advanced）：采样器选择（Euler a, DPM++ 等）、采样步数（10~50）、CFG Scale（1~20）、Seed（随机开关或填入固定整数）、生成张数（Batch size: 1~4）。
* **执行主按钮**：常驻底部悬浮或主操作栏的 [立即生成 (Generate)] 按钮，支持展示预计耗时或当前任务队列状态。
* **画布预览区**：
  * 空状态引导插画。
  * 生成中骨架屏与 Shimmer 呼吸光动画（展示生成中耗时计时器）。
  * 完成态卡片：原图高清展示、快速操作栏（[下载] / [收藏] / [以此图图生图] / [查看参数]）。

#### 页面 2：历史画廊 (Gallery & Archive)
* **头部控制条**：搜索框（根据 Prompt 关键字过滤）、筛选器（全部 / 仅收藏 / 文生图 / 图生图）、视图切换（瀑布流 / 紧凑网格）。
* **画廊列表项**：卡片悬浮/长按展示关键 Prompt 缩略，右下角快速收藏爱心按钮，左下角展示画幅标签。
* **图片详情 Modal (Inspector Drawer)**：
  * 左侧/上方：高保真原图（支持平移缩放、双击放大）。
  * 右侧/下方：参数详情清单：
    * 正向提示词（带一键复制按钮）。
    * 负向提示词。
    * 使用模型及接口提供方。
    * 尺寸、步数、CFG、Seed。
    * 生成耗时与生成时间戳。
  * 动作底栏：[保存原图]、[载入到工作台并复用参数]、[送去图生图]、[删除]。

#### 页面 3：配置中心 (Settings & Protocols)
* **生图服务提供商列表 (Image Providers)**：
  * 支持添加多个配置项并设置一个默认项。
  * 单项配置包含：
    * 别名（如 "本地 ComfyUI"、"SiliconFlow Flux"）。
    * 协议类型单选：`OpenAI-Compatible` / `SD-WebUI` / `Fal-ai` / `Generic-Proxy`。
    * Base URL (例如 `https://api.example.com/v1`)。
    * API Key (支持明文/密文切换，带脱敏显示)。
    * 默认模型名称（如 `flux-1-schnell`, `dall-e-3`, `sd_xl_base_1.0`）。
    * 连通性测试按钮：[发送测试请求]（绿色通过 / 红色报错详情）。
* **文本大模型配置 (LLM for Prompt Enhancement)**：
  * Base URL、API Key、模型名称（如 `deepseek-chat`, `gpt-4o-mini`）。
  * 系统优化 Prompt 模板编辑区（预设专业 SD/Flux 提示词工程 System Prompt，支持用户重置或定制）。
* **数据与关于**：
  * 当前登录账号信息与退出登录。
  * 存储占用情况、清除本地图片缓存按钮。

---

## 4. Data Logic (业务逻辑实体)

```
[User] (用户)
  ├── has_many [ImageProviderConfig] (生图接口配置)
  ├── has_one  [LLMConfig] (提示词优化接口配置)
  └── has_many [GenerationTask] (生图任务记录)
        └── has_many [ImageArtifact] (生成产物图片)
```

### 4.1 实体定义与业务关联

1. **User (用户实体)**
   * 属性：`id`, `email`, `created_at`, `avatar_url`。
   * 关系：拥有多个生图接口配置，拥有一个 LLM 配置，拥有多条生图任务。

2. **ImageProviderConfig (生图接口配置实体)**
   * 属性：`id`, `user_id`, `name`, `protocol_type` (`OPENAI` | `SD_WEBUI` | `FAL_AI` | `CUSTOM`), `base_url`, `api_key_encrypted`, `model_name`, `is_default`, `extra_headers` (JSON)。
   * 逻辑规则：同一用户同一时间仅有一个 `is_default = true`。

3. **LLMConfig (文本模型配置实体)**
   * 属性：`id`, `user_id`, `base_url`, `api_key_encrypted`, `model_name`, `system_prompt_template`。

4. **GenerationTask (生图任务实体)**
   * 属性：
     * `id`, `user_id`, `provider_config_snapshot` (生成时使用的接口快照，防止配置修改导致历史断层)。
     * `task_type`: `TEXT_TO_IMAGE` | `IMAGE_TO_IMAGE`。
     * `prompt`: 正向提示词（优化后）。
     * `original_prompt`: 用户输入的原始语言（用于对比历史）。
     * `negative_prompt`: 负向提示词。
     * `reference_image_url`: 参考底图地址（仅图生图有效）。
     * `parameters`: `{ width, height, aspect_ratio, steps, cfg_scale, seed, denoise_strength, sampler_name }`。
     * `status`: `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`。
     * `error_message`: 失败时的具体原因（如接口鉴权失败、超时等）。
     * `cost_time_ms`: 生成耗时。
     * `created_at`。

5. **ImageArtifact (生成图片资产实体)**
   * 属性：`id`, `task_id`, `user_id`, `storage_url` (云端持久化存储地址), `thumbnail_url` (用于画廊秒开的高压缩缩略图), `width`, `height`, `file_size`, `is_favorited` (是否收藏), `created_at`。

---

## 5. Non-Functional Requirements (非功能性要求)

### 5.1 跨端架构预备 (Mobile & App Ready)
* **响应式与触摸支持**：前端必须采用自适应流式排版（Tailwind 断点适配），移动端视口禁用不适宜的双指缩放破坏体验，所有按钮保证触控热区 $\ge 44 \times 44\text{px}$。
* **离线容灾与缓存**：配置信息和最新画廊数据需在客户端做 LocalStorage / IndexedDB 离线缓存，防止弱网白屏。
* **解耦设计**：UI 表现层与 API 请求逻辑必须完全解耦为独立 SDK / Adapter，方便后续无缝注入 Capacitor 插件或由 Flutter / React Native 客户端调用。

### 5.2 安全与密钥保护
* 敏感密钥（API Keys）在网络传输必须使用 TLS 加密；服务端对第三方 Keys 进行对称加密存储（AES-256-GCM），且在前端页面回显时强制掩码脱敏（只留前后 4 位）。
* 允许前端直接配置代理中转，避免直接暴露在公网引发 CORS 跨域拦截。

### 5.3 交互与性能体验
* **画廊加载性能**：历史记录必须采用分页（Cursor-based Pagination）或虚拟列表（Virtual List）渲染，原图默认延迟加载，画廊优先展示 WebP 缩略图。
* **超时与重试**：生图接口异步轮询需设置合理的自适应退避间隔（如每 2s 轮询一次，上限 180s），失败时明确展示错误码与重试引导。
