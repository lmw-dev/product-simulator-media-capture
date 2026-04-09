---
tags:
  - sop
  - workflow
  - dogfooding
  - qa
  - evidence-pack
  - result-page
status: active
creation_date: 2026-04-01
last_modified_date: 2026-04-09
version: 2.0
related:
  - "[[方案说明 - Product Simulator & Media Capture v2（Core Design）]]"
  - "[[SOP - 每日科技视频案例分析与产品校准工作流]]"
---

# SOP - Product Simulator & Media Capture 执行流程

## 1. SOP 定位

本 SOP 用于定义 Product Simulator & Media Capture 的**标准执行流程**。

该流程的目标不是“录完整流程视频”，而是：
- 跑通 Script Snap 分析链路
- 成功进入结果页
- 围绕结果页右侧 `Article / Tweets` 抓取关键输出
- 生成可供后续案例分析与产品校准使用的 **Result Evidence Pack**

---

## 2. 执行频率与输入标准

### 执行频率
- 当前目标节奏：每日 2-3 次
- 但在 Phase 1，优先追求**单次正确性**，而非频率规模

### 输入标准
候选输入应优先满足以下条件：
- 有明确信息密度的科技 / AI / SaaS / 创作者经济视频或内容页面
- 适合作为案例分析样本
- 能检验 Script Snap 的生成质量，而不是只检验页面是否能加载

推荐输入来源：
- YouTube 科技博主
- AI 产品 demo
- SaaS / 商业分析内容
- 已知高价值样本池

---

## 3. 标准执行路径（Happy Path）

### Step 1：选择样本
- 从候选池中选择 1 条目标 URL
- 记录本轮 `sourceUrl`

### Step 2：进入 Dashboard
- 打开 Script Snap Dashboard
- 定位 `Analyze / New Analysis` 入口

### Step 3：输入 URL 并提交
- 将目标 URL 输入分析框
- 提交分析任务

### Step 4：等待结果完成
- 等待分析完成并进入结果页
- 若超时、报错、跳转异常，需要记录失败状态

### Step 5：聚焦结果页右侧输出
本 SOP 的核心不是泛看所有 tab，而是聚焦结果页右侧：
- `Article`
- `Tweets`

### Step 6：抓取证据
至少完成以下抓取：
- result page screenshot
- article screenshot
- tweets screenshot
- article raw text
- tweets raw text
- run status / error state

### Step 7：生成结构化输出
将本轮执行结果整理为：
- Result Evidence Pack
- run summary
- calibration notes draft（可选最小版）

---

## 4. 核心检查点（Mandatory Checks）

每次运行至少检查以下内容：

### A. 链路完成性
- [ ] 是否成功进入结果页
- [ ] 是否出现明显报错 / 空白 / 死循环 loading

### B. Article 区域
- [ ] `Article` 是否存在
- [ ] 是否为空
- [ ] 是否能成功截图
- [ ] 是否能成功提取原始文本

### C. Tweets 区域
- [ ] `Tweets` 是否存在
- [ ] 是否为空
- [ ] 是否能成功截图
- [ ] 是否能成功提取原始文本

### D. 结果质量初筛
- [ ] 是否出现明显幻觉迹象
- [ ] 是否出现明显术语错误
- [ ] 是否出现明显结构缺失
- [ ] 是否值得进入后续案例分析 / 产品校准

---

## 5. 主产物定义

### 主产物：Result Evidence Pack
本 SOP 的主产物是 **Result Evidence Pack**，至少包括：
- source URL
- run id
- timestamp
- result page screenshot
- article screenshot
- tweets screenshot
- article raw text
- tweets raw text
- success / fail status
- error state
- observation / next action

### 辅助产物
以下材料可保留，但不是主目标：
- 全流程 MP4
- Dashboard 截图
- 输入框过程截图
- 录屏素材

---

## 6. 输出与归档口径

### 执行产物目录
建议归档至：
`WORKSPACE/media/product_simulations/YYYY-MM-DD/`

### 文档归档目录
项目文档归档至：
`1_Projects/P-202603-OpenClaw_AI_Agent/07-product-simulator-media-capture/`

### 推荐输出文件
- `run-01.json`
- `run-01-article.png`
- `run-01-tweets.png`
- `run-01-result-page.png`
- `run-01-observation.md`

---

## 7. Playwright 边界提醒

Playwright 在本流程中只负责：
- 执行
- 等待
- 定位
- 抓取
- 保存结构化结果

Playwright 不负责：
- 最终分析结论
- 完整红队审稿
- 产品优先级判断
- 自动替代人工做产品校准

---

## 8. Phase 1 执行范围

### Phase 1 只做
- 单次稳定跑通链路
- 到达结果页
- 抓取 `Article / Tweets`
- 输出 Result Evidence Pack

### Phase 1 不做
- 复杂调度
- 批量样本池管理
- 自动生成深度分析结论
- 以录整段视频为中心的媒体流水线

---

## 9. 交接说明

当本 SOP 稳定后，后续可直接用于：
- Linear issue 拆解
- Hephaestus 开发实现
- 日常 dogfooding 运行标准化

---

*Updated by Athena. 2026-04-09.*
