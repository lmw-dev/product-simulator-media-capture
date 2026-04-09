# TOM-730-734 Prompt — Product Simulator & Media Capture v2 Phase 1 Implementation

## 🎯 目标 (Objective)
**Linear Issues**:
- `TOM-730` - Product: 打通 Dashboard 到结果页的 Phase 1 最小执行链路
- `TOM-731` - Product: 定义结果页完成、超时与异常状态判断逻辑
- `TOM-732` - Product: 抓取结果页右侧 Article 与 Tweets 的文本和截图
- `TOM-733` - Product: 输出 Result Evidence Pack 的结构化文件与目录约定
- `TOM-734` - Product: 生成 run summary 与最小 observation 审计输出

**核心指令**:
请实现 `Product Simulator & Media Capture v2` 的 **Phase 1 最小可执行 runner**。该实现必须严格围绕 **Script Snap 产品 dogfooding + 结果证据抓取** 展开，而不是演变成通用自动化框架、录屏工具或服务系统。

唯一核心目标：
- 跑通 Script Snap 分析链路
- 成功到达结果页
- 抓取右侧 `Article / Tweets`
- 生成结构化 `Result Evidence Pack`
- 生成最小 run summary

---

## 📋 上下文参考 (Context References)

### 主要参考文档
请先阅读并严格遵循以下项目文档定义：
- `/Users/liumingwei/Library/Mobile Documents/iCloud~md~obsidian/Documents/1_Projects/P-202603-OpenClaw_AI_Agent/07-product-simulator-media-capture/方案说明 - Product Simulator & Media Capture v2（Core Design）.md`
- `/Users/liumingwei/Library/Mobile Documents/iCloud~md~obsidian/Documents/1_Projects/P-202603-OpenClaw_AI_Agent/07-product-simulator-media-capture/SOP - Product Simulator & Media Capture 执行流程.md`
- `/Users/liumingwei/Library/Mobile Documents/iCloud~md~obsidian/Documents/1_Projects/P-202603-OpenClaw_AI_Agent/07-product-simulator-media-capture/Phase 1 拆解 - Product Simulator & Media Capture v2.md`

### 代码项目根目录
- `/Volumes/ExternalLiumw/lavori/01_code/product-simulator-media-capture`

### 当前已锁定的核心约束
你必须接受以下定义为已定事实，不可擅自改写：
1. 这不是“自动录屏项目”
2. 这是一条 Script Snap 的产品 dogfooding + 结果证据抓取 + 案例分析输入 + 产品校准输入流水线
3. 主产物是 `Result Evidence Pack`
4. Phase 1 核心抓取对象只有结果页右侧：
   - `Article`
   - `Tweets`
5. Playwright 只负责执行与抓取，不负责最终分析判断
6. Phase 1 只做最小正确链路，不做服务化、调度化和平台化

---

## 🔧 具体要求与约束 (Requirements & Constraints)

### 技术栈约束
- **语言**: Node.js
- **浏览器自动化**: Playwright
- **运行形态**: 单次执行 CLI runner
- **代码风格**: CommonJS 或 ESM 二选一，但必须保持全项目一致

### 严禁事项
本任务中严禁主动扩展为以下形态：
- HTTP API 服务
- 常驻 worker
- 队列系统
- 定时调度系统
- 多用户系统
- 数据库系统
- 插件框架
- 录屏优先的媒体流水线
- 泛抓所有结果 tab 的大而全抓取器

### 必须实现的功能要求

#### A. CLI 入口
必须提供一个可直接执行的入口，例如：

```bash
node src/run-single-analysis.js --url "https://youtube.com/..."
```

至少支持：
- `--url`

可选支持：
- `--headless`
- `--timeout-ms`
- `--out-dir`

但不要扩展得太重。

#### B. Dashboard 访问与登录态复用
必须支持：
- 打开 Script Snap dashboard
- 支持从 config 读取 dashboard URL
- 支持从 config 读取 Playwright storage state 路径
- 登录态失效时给出明确报错

#### C. URL 提交
必须支持：
- 定位 `Analyze / New Analysis`
- 输入目标 URL
- 触发分析提交

selector 策略要求：
- 优先使用稳定 selector
- 如果页面缺少稳定 selector，则将 fallback 策略隔离到 `selectors` 配置中
- 不要把脆弱 selector 硬编码散落在各文件中

#### D. 结果页状态判断
必须有独立模块负责判断：
- `success`
- `timeout`
- `error`
- `blank`
- `loading_stuck`

要求：
- 不能只靠固定 `sleep`
- 必须有显式状态分类
- 必须能为后续抓取提供结构化状态输出

#### E. 结果页证据抓取
当结果页成功时，必须至少抓取：
- `result-page.png`
- `article.png`
- `tweets.png`
- `Article` 原始文本
- `Tweets` 原始文本

如果 `Article` 或 `Tweets` 不存在 / 为空：
- 必须明确写入结构化结果
- 不能静默忽略

#### F. Result Evidence Pack
必须输出统一结构化 JSON，至少包含：

```json
{
  "runId": "run-2026-04-09-001",
  "timestamp": "2026-04-09T13:00:00+08:00",
  "sourceUrl": "https://youtube.com/...",
  "status": "success",
  "stage": "result_page_captured",
  "artifacts": {
    "resultPageScreenshot": "...",
    "articleScreenshot": "...",
    "tweetsScreenshot": "..."
  },
  "content": {
    "articleText": "...",
    "tweetsText": "..."
  },
  "validation": {
    "articlePresent": true,
    "tweetsPresent": true,
    "articleEmpty": false,
    "tweetsEmpty": false,
    "errorState": null
  },
  "notes": {
    "observation": "",
    "nextAction": ""
  }
}
```

你可以扩展字段，但不可以偏离这个核心结构。

#### G. 最小 run summary
必须输出一份最小可读的 `run-summary.md` 或等价文本文件，至少包括：
- source URL
- run status
- Article 是否抓到
- Tweets 是否抓到
- 明显错误 / timeout 提示

注意：
这不是完整案例分析报告。
只是一层最小审计输出。

---

## 🧱 建议的实现结构 (Suggested Output Structure)

请在项目根目录中实现最小结构：

```text
product-simulator-media-capture/
  package.json
  README.md
  docs/
    CODEX_IMPLEMENTATION_PROMPT.md
  src/
    run-single-analysis.js
    steps/
      open-dashboard.js
      submit-url.js
      wait-result-page.js
      capture-article.js
      capture-tweets.js
    core/
      result-state.js
      evidence-pack.js
      paths.js
      logger.js
    config/
      app-config.js
      selectors.js
  outputs/
    .gitkeep
```

你可以小幅优化命名，但不要把结构做重。

---

## 🧪 测试策略 (Testing Strategy)

### AI 角色：Backend-first QA Engineer + Execution-focused Builder
你必须遵循“**验证关键执行链路，而不是堆砌花哨结构**”的原则。

这个任务的重点不是前端 UI 单元测试全覆盖，而是：
- runner 结构可运行
- 状态判断逻辑可测试
- evidence pack 生成逻辑可测试
- 路径与输出逻辑可测试
- selector / Playwright 交互尽量隔离，便于后续替换与验证

### 本任务建议的测试重点
优先测试这些非 UI-heavy 模块：
- `result-state.js`
- `evidence-pack.js`
- `paths.js`
- 参数解析 / run metadata 生成逻辑

### 如果你添加测试
测试优先级建议：
1. **单元测试**：状态判断、schema 输出、路径生成
2. **轻量集成测试**：对核心 runner 的非真实站点依赖部分做最小验证

### 测试要求
如果你写测试：
- 不要为了“看起来工程化”而过度搭测试基建
- 不要为 Phase 1 引入重型测试框架组合
- 测试必须服务于核心 runner 正确性，而不是形式主义

---

## 🔄 实现步骤 (Implementation Steps)

请严格按以下顺序工作：

### Step 1 — 初始化项目骨架
- 创建 `package.json`
- 安装并声明 `playwright`
- 创建目录结构
- 放置 `.gitkeep` 等基础文件

### Step 2 — 建立 config 与 paths 层
- 建立 dashboard URL / auth path / timeout 等配置入口
- 建立统一 output path 生成逻辑
- 确保输出目录能自动创建

### Step 3 — 实现最小执行 runner
- 解析 CLI 参数
- 启动 Playwright
- 打开 dashboard
- 提交 URL
- 进入等待逻辑

### Step 4 — 实现结果状态判断
- 分类 success / timeout / error / blank / loading_stuck
- 把判断逻辑从 runner 主流程中抽离

### Step 5 — 实现 Article / Tweets 抓取
- 截图
- 提取文本
- 记录存在 / 缺失 / 空内容状态

### Step 6 — 实现 Result Evidence Pack
- 写入结构化 JSON
- 写入最小 run summary
- 明确 failure run 的保底输出策略

### Step 7 — 补 README
README 必须说明：
- 这是什么项目
- 这不是什么项目
- 如何运行
- 输出什么
- 当前限制是什么

---

## 🛡️ 实现质量要求 (Implementation Quality Bar)

### 必须做到
- 代码真实可运行
- 配置集中管理
- 错误输出清楚
- 文件结构清楚
- 不写大段伪代码
- 失败时尽量留下可审计痕迹

### 不允许出现
- “TODO 后续实现全部逻辑”式空壳
- 过度抽象的 framework 化目录
- 直接把全部逻辑塞进一个超长文件
- 到处散落 hardcoded selector
- 只有 sleep、没有显式状态判断

---

## 🎉 完成检查清单 (Completion Checklist)

### Ⅰ. 功能检查
- [ ] 已创建最小项目骨架
- [ ] CLI runner 可启动
- [ ] 可打开 dashboard
- [ ] 可提交 URL
- [ ] 可判断结果页状态
- [ ] 可抓取 `Article / Tweets`
- [ ] 可生成 `Result Evidence Pack`
- [ ] 可生成最小 `run-summary`

### Ⅱ. 结构检查
- [ ] 项目仍然是单次执行 runner，而不是 service
- [ ] 代码未跑偏成通用自动化平台
- [ ] 仍然严格聚焦 `Article / Tweets`
- [ ] 输出结构和路径命名清晰稳定

### Ⅲ. 文档检查
- [ ] README 已更新
- [ ] 核心定义与 Core Design 保持一致
- [ ] 已明确说明当前 Phase 1 scope limitations

---

## 最终指令 (Final Instruction)

保持克制。
不要解决未来六个月的假问题。
不要把这个项目做成平台。

你要实现的是：

> 一个 **最小但正确** 的 Script Snap Phase 1 执行 runner。

它的使命只有四件事：
- 跑通链路
- 到达结果页
- 抓 `Article / Tweets`
- 生成 `Result Evidence Pack`
