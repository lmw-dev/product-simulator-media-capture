---
tags:
  - planning
  - phase-1
  - linear-ready
  - product-simulator
  - playwright
status: active
creation_date: 2026-04-09
last_modified_date: 2026-04-09
owner: Athena
related:
  - "[[方案说明 - Product Simulator & Media Capture v2（Core Design）]]"
  - "[[SOP - Product Simulator & Media Capture 执行流程]]"
---

# Phase 1 拆解 - Product Simulator & Media Capture v2

## 1. 文档定位

本文档用于将 Core Design 中已经确认的 Phase 1 范围，收敛成可以直接进入 Linear issue 拆解的开发前结构。

Phase 1 的目标不是“做大做全”，而是完成一条**最小但正确**的执行链路。

---

## 2. Phase 1 单句目标

**单次稳定跑通 Script Snap 分析链路，成功进入结果页，抓取右侧 `Article / Tweets`，并生成一个完整的 Result Evidence Pack。**

---

## 3. Phase 1 范围内的工作块

### Workstream A：分析链路执行
目标：稳定完成从 Dashboard 到结果页的最小用户链路。

包括：
- 打开 Dashboard
- 定位 Analyze / New Analysis
- 输入 URL
- 提交分析任务
- 等待结果页完成

DoD：
- 能稳定跑完一次链路
- 能识别成功到达结果页或失败退出

---

### Workstream B：结果页完成判断
目标：定义“结果页完成”在脚本里的可判断标准。

包括：
- 成功态判断
- 超时判断
- 空白态判断
- 报错态判断

DoD：
- 运行结束时能输出明确状态：success / fail / timeout / error

---

### Workstream C：Article / Tweets 抓取
目标：把右侧 `Article / Tweets` 作为核心抓取对象固定下来。

包括：
- 定位 `Article` 区域
- 定位 `Tweets` 区域
- 判断是否存在
- 判断是否为空
- 提取原始文本
- 生成局部截图

DoD：
- `Article` 和 `Tweets` 至少能分别输出“存在 / 不存在 / 为空 / 抓取失败”状态
- 成功时拿到截图和文本

---

### Workstream D：Result Evidence Pack 输出
目标：把本轮结果写成统一结构。

至少包括：
- run id
- timestamp
- source URL
- result page screenshot
- article screenshot
- tweets screenshot
- article raw text
- tweets raw text
- status
- error state
- observation / next action

DoD：
- 单轮运行结束后能生成一个完整结构化输出文件

---

### Workstream E：运行摘要与审计输出
目标：为后续案例分析 / 产品校准保留最小审计材料。

包括：
- run summary
- 本轮是否值得进入后续分析
- 明显问题记录

DoD：
- 每轮运行结束后至少留下一份最小可读摘要

---

## 4. 明确不在 Phase 1 的内容

以下内容明确不进入当前 Phase 1：
- 复杂定时调度
- 高频自动批量运行
- 自动生成完整案例分析文档
- 自动生成完整红队审稿结论
- 复杂失败恢复系统
- 全流程重型视频媒体流水线
- 泛抓所有结果页 tab

---

## 5. 建议的 Linear issue 拆法

建议至少拆为以下 issue：

1. **TOM-728A**：打通 Dashboard → Analyze → URL 提交 → 结果页到达
2. **TOM-728B**：定义结果页完成 / 超时 / 报错判断逻辑
3. **TOM-728C**：抓取 `Article / Tweets` 文本与截图
4. **TOM-728D**：输出 Result Evidence Pack JSON / 文件结构
5. **TOM-728E**：输出 run summary 与最小 observation 草稿

如果需要进一步压缩，也可以先合并成 3 个：
- 执行链路
- 抓取与证据包
- 审计输出

---

## 6. 交付判断标准

当以下条件满足时，Phase 1 可以认为达到开发完成标准：

- [ ] 单次链路稳定跑通
- [ ] 成功进入结果页
- [ ] 成功抓取 `Article / Tweets`
- [ ] 成功输出 Result Evidence Pack
- [ ] 成功留下 run summary
- [ ] 输出结果可直接供后续案例分析 / 产品校准使用

---

## 7. 下一步

1. 将本文档拆为 Linear issues
2. 指派 Hephaestus 进入实现
3. 先完成一次真实跑通验证

---

*Created by Athena. 2026-04-09.*
