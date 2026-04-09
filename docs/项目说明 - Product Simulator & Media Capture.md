---
tags: project/management, product-simulator, dogfooding, script-snap
status: active
creation_date: 2026-04-01
owner: Athena
---

# 项目说明 - Product Simulator & Media Capture

last_modified_date: 2026-04-09

# 项目说明 - Product Simulator & Media Capture

## 1. 战略对齐 (Strategic Alignment)
本项目用于把 Script Snap 的真实使用链路制度化为一条可重复执行的 dogfooding 流水线，核心目标不是“录一段流程视频”，而是持续制造：

- **向外 (To Market)**：可用于每日案例分析与内容资产沉淀的真实结果样本
- **向内 (To Product)**：可用于发现问题、提出优化点、支撑后续工程迭代的结果页证据

它服务的是业务验证与产品校准，而不是单纯的自动化演示。

## 2. 核心价值 (Core Value)
- **替代高成本手工跑测**：把 CEO 的重复性输入、打开页面、等结果、截图、抄记录等动作系统化
- **稳定制造校准输入**：围绕结果页右侧 `Article / Tweets` 形成可复用证据包
- **支撑双向产出**：同一轮运行同时服务内容分析与产品迭代
- **减少开发跑偏**：以 Core Design 为基线，避免项目滑回“录屏项目”旧轨道

## 3. 项目主定义 (Primary Definition)
本项目当前的正式主定义如下：

> **Product Simulator & Media Capture 是 Script Snap 的结果页证据抓取、案例分析输入生成、产品校准输入生成流水线。**

其主产物不是 MP4，而是 **Result Evidence Pack**。

其 Phase 1 的核心抓取对象不是所有 tab，而是结果页右侧：
- `Article`
- `Tweets`

## 4. 成功定义 (DoD)
### 当前方案定稿级 DoD
- [x] 已明确项目不是录屏项目
- [x] 已明确主产物是 Result Evidence Pack
- [x] 已明确 `Article / Tweets` 是 Phase 1 核心抓取对象
- [x] 已明确 Playwright 仅负责执行与抓取
- [x] 已明确 Phase 1 只做最小正确链路

### 后续实现级 DoD（Phase 1）
- [ ] 单次稳定跑通 Script Snap 分析链路
- [ ] 成功进入结果页
- [ ] 成功抓取 `Article / Tweets` 的截图与原始文本
- [ ] 生成一个完整的 Result Evidence Pack
- [ ] 输出结构化 run summary，供后续案例分析与产品校准使用

## 5. 相关主文档
当前项目方案以以下文档为准：
- `方案说明 - Product Simulator & Media Capture v2（Core Design）.md`

本项目说明文档用于快速解释项目定位，不替代 Core Design 作为唯一 SoT。 

---
*Updated by Athena. 2026-04-09.*
