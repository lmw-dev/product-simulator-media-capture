---
tags:
  - project
  - core-design
  - product-simulator
  - dogfooding
  - playwright
  - script-snap
status: active
creation_date: 2026-04-03
last_modified_date: 2026-04-09
owner: Athena
related:
  - "[[项目说明 - Product Simulator & Media Capture]]"
  - "[[SOP - Product Simulator & Media Capture 执行流程]]"
  - "[[技术方案 - Product Simulator & Media Capture v2]]"
  - "[[SOP - 每日科技视频案例分析与产品校准工作流]]"
---

# 方案说明 - Product Simulator & Media Capture v2（Core Design）

## 1. 文档定位

本文档是 **Product Simulator & Media Capture 项目的当前唯一核心方案说明（SoT, Source of Truth）**。

在进入 Linear issue 拆解与正式开发之前，项目必须先以本文档完成以下事项的统一：

- 项目定义
- 核心目标
- 系统边界
- 产物定义
- Phase 1 范围
- 不做事项
- 后续开发的拆解前提

一句话：
**先确认这条流水线到底是什么，再决定怎么开发。**

---

## 2. 一句话定义

**Product Simulator & Media Capture** 不是一个“自动录屏项目”，而是一条服务于 Script Snap 的 **产品 dogfooding、结果证据抓取、案例分析输入生成、产品校准输入生成** 的执行流水线。

它的核心任务是：

1. 自动跑通 Script Snap 的真实分析链路
2. 稳定到达结果页
3. 抓取结果页右侧 `Article / Tweets` 等关键输出
4. 形成标准化的 **Result Evidence Pack（结果证据包）**
5. 为后续的每日案例分析与产品校准提供高质量输入

---

## 3. 这个项目不是什么

为避免后续开发跑偏，先明确它 **不是什么**：

- 不是单纯的自动录屏项目
- 不是单纯的 UI 巡检器
- 不是为了证明 Playwright 能跑通页面
- 不是以“保存 MP4”为第一目标的媒体项目
- 不是先做复杂调度编排系统
- 不是一个让执行器替代人类做最终内容判断的系统

视频、截图、录制都重要，但它们是 **辅助证据**，不是主目标。

---

## 4. 战略价值

该项目同时服务两个方向：

### A. To Product：产品校准
通过高频真实跑测，发现 Script Snap 在以下方面的偏差：
- 事实准确性
- 幻觉生成
- 逻辑遗漏
- 标题与结构不一致
- 专有名词识别错误
- 结果页可读性与价值感问题

### B. To Content：内容资产生产
将真实结果页产出转化为：
- 每日案例分析输入
- 可复用洞察
- 可沉淀的产品样本
- 宣发与对外表达的原始素材

一句话：
**这条线既是产品红队测试线，也是内容资产输入线。**

---

## 5. 正确的系统中心

当前版本最需要纠偏的一点是：

> 这条线的关键，不在“从 Dashboard 到结果页的过程被录下来了”，而在“结果出来之后，是否成功抓取并分析了结果页输出”。

因此，本项目的中心必须从：

- 流程录制
- 页面到达
- 自动化演示

切换为：

- 结果页证据抓取
- Article / Tweets 输出提取
- 案例分析输入生成
- 产品校准输入生成

---

## 6. 五层结构（整体框架）

### Layer 1：输入层（Input Layer）
负责决定本轮运行要分析什么。

典型输入包括：
- YouTube 科技视频 URL
- AI 产品 Demo URL
- 指定候选池中的内容链接
- 业务方指定的测试样本

这层回答的问题是：
- 这轮喂什么链接？
- 为什么选它？
- 它是否适合作为案例分析和产品校准样本？

---

### Layer 2：执行层（Execution Layer）
负责真实模拟用户使用 Script Snap 的核心链路。

标准流程：
1. 进入 Dashboard
2. 点击 Analyze / New Analysis
3. 输入 URL
4. 提交分析任务
5. 等待分析完成
6. 进入结果页

这一层的核心要求：
- 稳定
- 可重复
- 可审计

这一层的目标不是“炫自动化”，而是稳定产生后续可分析的结果。

---

### Layer 3：证据抓取层（Evidence Capture Layer）
负责把结果页转化为后续分析可消费的结构化输入。

这里是整个系统的关键中间层。

必须抓取的对象，不是“页面到了”本身，而是结果页中的关键内容。

至少应覆盖：
- result page screenshot
- article screenshot
- tweets screenshot
- article raw text
- tweets raw text
- run metadata
- 页面异常状态（如空白、报错、骨架屏）
- 可选：完整流程视频

我们将这组产物统称为：

## Result Evidence Pack

这是本项目的**主产物定义**。

---

### Layer 4：分析与校准层（Analysis & Calibration Layer）
这是项目的价值核心层。

该层基于 Result Evidence Pack，对结果页内容进行：
- 事实准确性检查
- 幻觉检测
- 专有名词识别检查
- 标题与正文一致性检查
- 结构完整性检查
- 逻辑遗漏检查
- 风格偏差检查
- 值不值得沉淀为内容资产的判断
- 需要回流产品的优化点识别

这一层应参考现有文档：
- `SOP - 每日科技视频案例分析与产品校准工作流.md`
- 既有的案例分析样本

该层的输出分为两类：

#### A. 内容资产输出
- 每日案例分析文档
- 洞察提炼
- 可复用的传播素材草稿

#### B. 产品校准输出
- Bug / 缺陷候选
- Prompt 优化建议
- 结构优化建议
- 后续 Linear issue 候选

---

### Layer 5：治理与调度层（Governance & Scheduling Layer）
负责长期稳定化运行。

典型内容包括：
- 每日 2-3 次运行节奏
- 命名规范
- 路径规范
- 成功 / 失败记录
- 审计与复盘方式
- 哪些观察升级为正式 issue

这一层很重要，但不是 Phase 1 的优先重点。

---

## 7. Playwright 的职责边界

Playwright 是这条系统中的 **执行器（Executor）**，不是最终分析器。

### Playwright 负责
- 打开 dashboard
- 点击 analyze
- 输入 URL
- 提交任务
- 等待结果页
- 定位 Article / Tweets 等关键区域
- 抓取截图与文本
- 保存结构化运行输出
- 必要时保留视频作为辅助证据

### Playwright 不负责
- 商业判断
- 红队审稿
- 深度洞察提炼
- 产品策略结论
- 最终优先级排序

一句话：
**Playwright 负责执行与抓取，不负责最终判断。**

---

## 8. 主产物与辅助产物

### 主产物（Primary Deliverables）
本项目的主产物不是视频，而是：

#### 1. Result Evidence Pack
至少包括：
- 源 URL
- run id
- 时间戳
- result page screenshot
- article screenshot
- tweets screenshot
- article raw text
- tweets raw text
- success / fail status
- 异常说明

#### 2. Calibration Notes Draft
围绕结果页的初步观察，包括：
- 结果质量判断
- 明显问题点
- 是否存在幻觉/遗漏/拼写错误
- 值不值得进入正式校准

#### 3. Case Analysis Input Draft
为后续案例分析文档提供原始结构化输入。

---

### 辅助产物（Secondary Deliverables）
以下产物有价值，但不是系统主目标：
- 全流程 MP4 视频
- Dashboard 阶段截图
- 输入框阶段截图
- 动画录制素材

这些材料适用于：
- 排障
- 演示
- 特定内容资产制作

但不应主导系统设计。

---

## 9. Result Evidence Pack（建议 Schema）

以下为当前阶段建议的结构定义：

```json
{
  "runId": "run-2026-04-03-001",
  "timestamp": "2026-04-03T00:00:00+08:00",
  "sourceUrl": "https://youtube.com/...",
  "status": "success",
  "stage": "result_page_captured",
  "artifacts": {
    "resultPageScreenshot": "...",
    "articleScreenshot": "...",
    "tweetsScreenshot": "...",
    "flowVideo": "...optional..."
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
    "observation": "...",
    "nextAction": "..."
  }
}
```

这个 schema 是后续开发拆解、目录规范、issue 化的基础。

---

## 10. Phase 1 范围（开发前必须统一）

### Phase 1 的目标
先做出一条**最小但正确的执行链路**，证明这套系统的中心逻辑成立。

### Phase 1 只做
- 单次稳定跑通核心分析链路
- 成功进入结果页
- 抓取 Article / Tweets
- 生成一个完整的 Result Evidence Pack
- 生成结构化 run output
- 为后续案例分析 / 产品校准提供输入

### Phase 1 不做
- 复杂定时调度
- 高级失败恢复编排
- 大规模样本池管理
- 自动生成最终校准结论
- 把所有分析判断完全自动化
- 以录整段视频为中心的重型媒体流水线

一句话：
**Phase 1 解决的是“正确性”，不是“自动化规模”。**

---

## 11. 当前方案与旧版本的纠偏结论

相较于项目初始文档，v2 Core Design 的核心纠偏如下：

### 旧中心
- 自动录屏
- 到达结果页
- 保存 MP4
- 媒体采集优先

### 新中心
- 抓取结果页关键输出
- 形成 Result Evidence Pack
- 为案例分析与产品校准提供输入
- 将视频降级为辅助证据

### 这意味着
后续所有 SOP、技术方案、issue 拆解、代码实现，都应围绕：

**“结果页抓取与分析输入生成”**

而不是围绕：

**“整段流程录了没有”**

---

## 12. 核心收口结论（2026-04-09 确认版）

截至 2026-04-09，以下 5 个核心点已经明确确认，作为 TOM-728 的正式方案基线：

- [x] **Result Evidence Pack 是主产物**，不是 MP4，也不是单纯截图集合
- [x] **结果页右侧 `Article / Tweets` 是 Phase 1 核心抓取对象**
- [x] **Playwright 仅负责执行与抓取**，不负责最终分析判断
- [x] **Phase 1 只做最小正确链路**，不做过度自动化
- [x] **项目中心是结果页证据抓取 + 案例分析输入 + 产品校准输入**，不是录屏项目

这 5 点已作为后续 issue 拆解、开发排期和实现评审的强约束。

## 13. 成功定义（DoD）

当以下条件满足时，可以认为核心方案成立：

- [x] 已明确主目标是 Result Evidence Pack，而非视频录制
- [x] 已明确 Playwright 只负责执行与抓取
- [x] 已明确结果页右侧 `Article / Tweets` 是核心抓取对象
- [x] 已明确分析与校准层是后续价值核心
- [x] 已明确 Phase 1 的边界与非目标
- [x] 已形成可直接拆解为 Linear issues 的方案基础

---

## 14. 进入 Linear issue 前的前置条件

在正式建 issue 之前，以下事项必须先确认：

1. Core Design 文档确认
2. Result Evidence Pack schema 确认
3. Phase 1 范围确认
4. Playwright 边界确认
5. 现有旧文档是否保留/合并/降级的处理方案确认

只有在这些前提稳定后，才进入：
- issue 拆解
- owner 指派
- 开发排期

---

## 15. 对现有文档的处理建议

建议后续按以下方式处理现有目录中的旧文档：

### 保留但降级为历史参考
- `技术方案 - Product Simulator & Media Capture v1.md`
- `技术方案 - Product Simulator & Media Capture v2.md`
- `技术方案 - 产品模拟器与素材采集执行流程.md`

### 需要后续修订
- `项目说明 - Product Simulator & Media Capture.md`
- `SOP - Product Simulator & Media Capture 执行流程.md`

### 当前唯一主文档
- `方案说明 - Product Simulator & Media Capture v2（Core Design）.md`

---

## 16. 下一步建议

建议按以下顺序推进：

1. 先确认本文档内容
2. 基于本文档修订旧的项目说明与 SOP
3. 将 Phase 1 拆解为明确的 Linear issues
4. 再进入 Playwright 实现与验证

---

## 17. 最终结论

**Product Simulator & Media Capture 的真正核心，不是录过程，而是抓结果；不是展示自动化，而是为案例分析与产品校准稳定制造输入。**

如果这条定义不变，后续开发方向就会稳定；
如果这条定义继续模糊，开发很容易再次滑回“录屏项目”的旧轨道。

---

## Next Actions

1. 基于本文档修订项目说明与 SOP
2. 将 Phase 1 拆解为明确的 Linear issues
3. 再进入 Playwright 实现与验证
