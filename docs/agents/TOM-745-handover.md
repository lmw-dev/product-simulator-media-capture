# 交接文档：TOM-745 Automatic Reporting & Review Archival
**执行任务**: TOM-745（每日执行结果自动回传 + 审核归档）

### 问题分析
- **需求本质**：daily run 结束后，需要自动把“可验收摘要”推送到 Discord `#script-snap-exec`，并把审核结果固化到 run 输出目录，形成闭环证据链。
- **原始缺口**：
  - 仅有 `evidence-pack.json` / `run-summary.md`，缺少面向管理层的审核摘要。
  - 无统一 post-run hook，失败/超时时无法保证“必回传”。
  - 仅靠规则无法评估产品可行性，需要引入模型层语义审核。
- **体系约束**：项目已在 OpenClaw cron 体系中运行，Discord 发送应优先复用 OpenClaw 能力，而非强绑定 webhook。

### 方案设计
- **触发机制**：
  - 在 `run-daily.sh` 主流程结束后执行 `post-run` hook。
  - 保证 run 成功或失败都触发 hook，形成稳定回传机制。
- **审核双层架构**：
  - **规则层（Heuristic）**：状态、字符数、tweet 数量、结构化组件信号、完整性检测。
  - **模型层（LLM via OpenClaw Agent）**：输出 `Review Level / Feasibility / Confidence / Risks / Recommendations`。
  - **最终判定**：采用更保守策略，规则层与模型层取更严格结论。
- **消息发送策略**：
  - 优先 `openclaw message send --channel discord`。
  - webhook (`DISCORD_SCRIPT_SNAP_EXEC_WEBHOOK_URL`) 仅作为 fallback。
  - 两者都不可用时 warning，不阻断 daily run 主流程。

### 代码实现
- **新增文件**：
  - `src/post-run-report.js`
    - 读取 run 目录和 `evidence-pack.json`
    - 生成 `review-summary.md`
    - 调用 OpenClaw Agent 执行模型审核
    - 发送 Discord 结构化摘要（OpenClaw 主路径，webhook 兜底）
- **修改文件**：
  - `run-daily.sh`
    - 接入 post-run hook，记录 `run_exit` 与 `report_exit`
  - `src/core/evidence-pack.js`
    - 增加 `runtime.startedAt/finishedAt/durationMs`
  - `src/run-single-analysis.js`
    - 增加 `outputs/latest-run-meta.json`，用于 post-run 定位最新 run
  - `package.json`
    - 增加脚本：`report:post-run`
  - `README.md`
    - 补充 TOM-745 使用说明、transport/llm 开关说明
  - `docs/TOM-745.prompt.automatic-reporting-and-review-archival.md`
    - 更新为 OpenClaw 主路径 + 模型审核要求

### 验证结果
- 已验证 `npm test` 不受影响。
- 已验证 `npm run report:post-run -- --dry-run`：
  - 可生成/更新 `review-summary.md`
  - 可构建 Discord 消息 payload
  - OpenClaw 发送路径可用
- 已验证模型审核链路：
  - `review-summary.md` 中新增 `## LLM Review`
  - 当前可见模型标识示例：`gemini-3-flash-preview`
  - LLM 失败时自动降级为规则审核，不中断流程

### 部署与后续建议
1. **建议保留双层审核**：规则层负责稳定性，模型层负责语义可行性，二者互补可降低误判风险。
2. **建议增加提示词版本管理**：将 LLM 审核 prompt 独立为模板文件，后续可做 A/B 迭代与回溯。
3. **建议新增回归样本集**：固定 5~10 条历史 run 作为“评审基准集”，用于校验模型输出稳定性与一致性。
4. **建议补一次真实非 dry-run 验收**：在生产 cron 时间窗前手动跑一次，确认 Discord 展示样式与 CEO 验收视角一致。

