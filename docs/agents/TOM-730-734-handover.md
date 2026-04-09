# 交接文档：Product Simulator & Media Capture v2 Phase 1
**执行任务**: TOM-730 ~ TOM-734 实现

### 问题分析
- **需求本质**：为 Script Snap 提供一套基于浏览器自动化的 dogfooding 测试辅助流水线（最小化脚本），核心目的是将产品分析全路径（填入 URL -> 等待结果 -> 获取组件数据）跑通并固化为证据产物（Screenshot & JSON）。
- **架构视角**：
  - 此阶段（Phase 1）非后台系统也非通用爬虫，应**极度收敛**并避免微服务倾向，基于 Node CLI 实现最优。
  - 由于 Playwright 的页面控制较重，采取 “Config分离+流程Steps拆解+统一产物封装” 的策略进行模块解耦。目标页面的变动风险很高，所有 Selectors 均外部化。

### 方案设计
- **输入层**：使用 `yargs` 提供基于 CLI 参数 `--url` 的单一工作流入口。
- **业务操作流 (Steps)**：
  - `open-dashboard`：打开基础页或登录态挂载
  - `submit-url`：定位分析入口并提交地址
  - `wait-result-page`：基于并行条件竞速 (success / err / timeout) 等待目标出现
  - `capture-article` / `capture-tweets`：抓取右侧的核心内容，包括文本提取与独立截图。
- **状态及输出网关 (Core)**：
  - `result-state.js` 控制超时/空结果等复杂边界判断。
  - `evidence-pack.js` 处理抓取数据的自动校验（例如内容存在但为空白）并输出带有时间戳的唯一追踪包（JSON + MD Summary）。

### 代码实现
已完成所有对应代码结构的开发，存放于 `src/`：
1. **Config 层**：`src/config/app-config.js` 及 `src/config/selectors.js`，包含 DOM 锚点和超时阀值。
2. **Core 机制**：实现了路径统一生成工具和 JSON 包结构管理器。
3. **主入口与调度**：`src/run-single-analysis.js`（入口点），通过顺序执行不同 Stage 并更新 evidence-pack，最后保证即便中途报错，也会执行到 finally 中保存现场截图。

### 部署与后续建议
1. **认证环境前置处理**：当前脚本预期从 `playwright/.auth/state.json` 读取缓存作为免密登录态。后续测试前请先手工或另写小脚本（`playwright auth` 登录导出），以免在 dashboard 跳转时被拦截。
2. **DevMode / Headless**：为方便调试报错锚点，建议在最初使用的时候可以通过在命令中加入 `--no-headless` 来监控流程是否准确打击目标模块。
3. **长期维护重点**：`src/config/selectors.js` 内的 DOM Query 带有部分假定标签名（如 `[data-testid]` 等），如后续 Script Snap UI 重构，仅需在此收敛更新即可。
