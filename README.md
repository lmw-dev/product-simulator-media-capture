# Product Simulator & Media Capture (产品模拟与媒体捕获)

## 项目定位

`Product Simulator & Media Capture` 是一个 **Script Snap 产品体验与结果证据捕获运行器 (Runner)**。

其目的是执行真实的 Script Snap 分析流程，到达结果页面，捕获右侧的 `Article` 和 `Tweets` 内容，并生成结构化的 **结果证据包 (Result Evidence Pack)**，用于：

- 产品校准 (Product Calibration)
- 案例分析输入 (Case Analysis Input)
- 结果页证据收集 (Result-page Evidence Collection)
- 可重复的产品体验 (Dogfooding)

本仓库负责项目的 **执行层 (Execution Layer)**。

- **定义层 (Definition Layer)** 位于项目文档 / Obsidian 工作区
- **执行层 (Execution Layer)** 位于此处的代码中

---

## 明确“非目标”

本项目 **不是**：

- 通用的浏览器自动化平台
- 录屏优先工具
- 长期运行的后端服务
- 内部 API 服务器
- 多用户队列系统
- 宽泛的内容导出框架
- “从每个标签页抓取一切”的流水线

第一阶段 (Phase 1) 必须保持聚焦和克制。

---

## 项目定义（已锁定）

项目定义已在设计文档中锁定。

### 核心定义
这是一个用于以下目标的流水线：
- Script Snap 产品体验 (Dogfooding)
- 结果证据捕获
- 案例分析输入生成
- 产品校准输入生成

### 主要交付物
主要交付物是：
- `Result Evidence Pack` (结果证据包)

### 第一阶段捕获重点
第一阶段仅关注：
- 到达结果页
- 捕获右侧 `Article` (文章)
- 捕获右侧 `Tweets` (推文)
- 生成结构化输出

### Playwright 职责边界
Playwright 仅负责：
- 执行
- 等待
- 定位
- 捕获
- 结构化输出生成

Playwright **不** 负责：
- 最终的分析判断
- 产品策略结论
- 红队审查结论
- 替代人工审查

---

## 第一阶段范围 (Phase 1 Scope)

第一阶段仅执行最小路径：

1. 打开 Script Snap 控制台 (Dashboard)
2. 触发分析
3. 提交目标 URL
4. 等待结果页加载
5. 捕获 `Article / Tweets`
6. 生成 `Result Evidence Pack`
7. 生成最小化运行摘要 (Run Summary)

### 第一阶段明确排除在外的：
- Cron 定时调度（交由系统 launchd 处理）
- 长期运行的服务模式
- 任务排队
- 多任务编排
- 数据库存储
- 宽泛的插件架构
- 全流程媒体流水线
- 深度自动内容分析

---

## 推荐目录结构

```text
product-simulator-media-capture/
  README.md
  docs/                   # 项目文档
  src/                    # 源码
    run-single-analysis.js # 主运行脚本
    steps/                # 步骤逻辑
    core/                 # 核心模块
    config/               # 配置与选择器
  outputs/                # 运行输出
```

---

## 输出预期

每次运行应产生一个特定于该次运行的输出文件夹，例如：

```text
outputs/
  2026-04-09/
    run-2026-04-09-001/
      evidence-pack.json  # 核心结构化数据
      result-page.png      # 结果页全屏截图
      article.png         # 文章面板截图
      tweets.png          # 推文面板截图
      run-summary.md      # 运行摘要
```

### 最小 `Result Evidence Pack` 内容
输出的 JSON 应至少包含：
- `runId`: 运行 ID
- `timestamp`: 时间戳
- `sourceUrl`: 源 YouTube URL
- `status`: 状态
- 结果页截图路径
- 文章面板截图路径
- 推文面板截图路径
- 文章原始文本 (article raw text)
- 推文原始文本 (tweets raw text)
- 校验状态
- 基础备注 (notes)

---

## 相关文档

### 核心项目文档 (文内)
- `方案说明 - Product Simulator & Media Capture v2（Core Design）.md`
- `SOP - Product Simulator & Media Capture 执行流程.md`
- `Phase 1 拆解 - Product Simulator & Media Capture v2.md`

### 实施总结 (新增)
- `docs/auth-automation-summary.md` (关于 Auth 架构调整的详细说明)

---

## 现状

- 项目定义已锁定
- Phase 1 任务已在 Linear 创建
- 代码仓库已初始化
- 执行流程已完全打通

---

## 构建哲学

构建“最小且正确”的运行器。

不要过度构建。
不要平台化。
不要为想象中的未来复杂度进行优化。

本仓库应保持为一个 **专注的执行项目**，而非通用框架。

---

## 使用指南 (Usage)

### 环境要求
- Node.js (v18+)
- Playwright
- 已安装 Google Chrome (`/Applications/Google Chrome.app`)

```bash
npm install
```

---

### 第一阶段 SOP：两步工作流

本项目采用“人工协同 + 半自动”的模式。

#### 第一步：Init Auth (人工协同，一次登录，长期有效)

由于 Google OAuth 会拦截自动化浏览器，我们需要使用**专用 Profile (Persistent Context)** 模式。

```bash
node src/capture-auth-state.js
# 或使用脚本: npm run auth:capture
```

1. 脚本会以**有头模式**开启一个专用的 Chrome 窗口。
2. 你在窗口中手动完成 Script Snap 登录（支持 Google/GitHub）。
3. 确认看到控制台 (Dashboard) 后，在终端按 **ENTER**。
4. 登录态将永久保存在 `ScriptSnapBot` 专用 Profile 目录中。

> **注意**：这只需要执行一次。只要服务端 Session 不过期，之后的自动化运行就不需要再人工干预。

#### 第二步：运行捕获流水线 (完全自动)

```bash
node src/run-single-analysis.js --url "https://www.youtube.com/watch?v=67Cbb3DyIxA"
```

**可选参数：**
- `--no-headless`: 显示浏览器窗口（调试用）。默认为无头模式。
- `--url <url>`: 指定要分析的 URL。
- `--from-pool`: 从本地 URL Source Pool 取下一条 `pending` URL。
- `--pool-db <path>`: 覆盖默认 SQLite 路径（仅在 `--from-pool` 场景常用）。

---

### URL Source Pool（SQLite）

TOM-740 已实现本地 URL 输入池（去重 + 状态管理），默认数据库位置：

`data/url-source-pool.sqlite`

支持状态：
- `pending`
- `processed`
- `failed`
- `skipped`

#### 1) 添加 URL

```bash
npm run url-pool -- add \
  --url "https://www.youtube.com/watch?v=67Cbb3DyIxA" \
  --source-type manual \
  --source-name "daily-pick" \
  --content-type youtube
```

#### 2) 查看下一条待执行 URL

```bash
npm run url-pool -- next
```

#### 3) 按 URL 查询

```bash
npm run url-pool -- get --url "https://www.youtube.com/watch?v=67Cbb3DyIxA"
```

#### 4) 状态回写（processed / failed / skipped）

```bash
npm run url-pool -- mark --url "https://www.youtube.com/watch?v=67Cbb3DyIxA" --status processed --run-id "run-2026-04-11-123456"
```

#### 5) 让 runner 直接消费 URL pool

```bash
node src/run-single-analysis.js --from-pool
# 或
npm run start:from-pool
```

runner 在 `--from-pool` 模式下会自动回写状态：
- 成功 -> `processed`
- 非成功结束 -> `failed`

---

### 自动化定时运行 (macOS)

为了实现无人值守，我们提供了 `launchd` 配置：

1. **配置脚本**：编辑 `run-daily.sh` 设定默认 URL。
2. **部署任务**：
   ```bash
   cp docs/com.openclaw.productsimulator.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.openclaw.productsimulator.plist
   ```
3. 任务会在每天上午 09:00 自动运行。

#### TOM-745: 自动回传与审核归档

`run-daily.sh` 现已在每次运行结束后自动执行 post-run hook：
- 生成 `review-summary.md` 到当前 run 目录
- 发送结构化执行摘要到 Discord `#script-snap-exec`
- 通过 OpenClaw Agent 追加模型评审（可行性结论 + 风险建议）

可选环境变量：
- `DISCORD_SCRIPT_SNAP_EXEC_CHANNEL_ID`: Discord channel id（默认 `1489176810410479696`，用于 OpenClaw 主路径）
- `DISCORD_SCRIPT_SNAP_EXEC_WEBHOOK_URL`: Discord webhook URL（仅作为 OpenClaw 失败时的 fallback）

本地 dry-run（仅生成报告并打印 payload）：

```bash
npm run report:post-run -- --dry-run
```

强制指定传输方式（调试用）：

```bash
npm run report:post-run -- --transport openclaw --dry-run
npm run report:post-run -- --transport webhook
```

关闭模型评审（仅规则评审）：

```bash
npm run report:post-run -- --llm-review false
```

---

### 快速检查 Auth 状态

在运行前，可以快速检查本地状态：

```bash
node src/check-auth.js
# 或: npm run auth:check
```

- 退出码 0 = 正常。
- 退出码 1 = 过期或缺失 → 请重新执行 **第一步**。

---

### 配置维护

所有 Playwright 选择器和基础定义均已隔离，方便未来 UI 变更时维护：
- `src/config/app-config.js`: 全局配置（超时、路径、Profile）
- `src/config/selectors.js`: 精确的 UI 选择器定义
