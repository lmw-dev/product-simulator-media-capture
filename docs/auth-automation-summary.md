# Auth & Automation 实施总结

**日期**: 2026-04-10  
**任务**: 解决登录认证问题，打通每日自动化运行流程  
**状态**: ✅ 架构完成，待首次 Setup 验证

---

## 背景

### v1.0 的设计前提（从未改变）

这个项目从一开始就不是"认证自动化项目"。v1.0 的核心设计是：

- **人工协同 + 半自动**
- 先跑通流程，先留痕，先形成可复用模板
- **默认前提是"已有可用登录态"**，runner 只负责消费

本次工作的目标是：在不违背这个设计前提的情况下，让"已有可用登录态"这件事变得尽可能低摩擦。

---

## 问题诊断过程

### 第一层：看起来有效 ≠ 实际有效

| 检查项 | 结果 |
|--------|------|
| `auth:check` 本地 cookie 检查 | ✅ 通过（cookie 未过期） |
| runner 实际访问 dashboard | ❌ 被重定向到登录页 |

**结论**：本地 cookie timestamp 有效，但 Clerk 服务端 session 已被 revoke（8天未使用，或从其他设备登出触发）。这两者是独立的。

### 第二层：storageState 注入方案的根本限制

即使拿到新的 auth state，Playwright 注入 storageState 的方式也存在根本问题：

- Playwright 启动一个**没有真实用户 profile 的 Chrome**
- Clerk + Cloudflare 的指纹检测识别出这是自动化浏览器
- 即使 cookie 正确，服务端仍然拒绝

验证：browser subagent（使用系统真实浏览器）可以正常进入 dashboard 并完成完整流程，Playwright storageState 方式始终被拒。

### 第三层：Google OAuth 的额外限制

尝试用 `capture-auth-state.js` 打开 Chrome 让用户手动登录时，遇到 Google 报错：

> **无法登录** — 此浏览器或应用可能不安全

原因：Playwright 启动的 Chrome 没有真实的 `--user-data-dir`，Google OAuth 检测到这是被自动化控制的浏览器实例，直接拒绝。

---

## 解决方案：launchPersistentContext + 专用 Chrome Profile

### 核心思路

不再用 `storageState` 注入，改用 `launchPersistentContext`，让 Playwright 使用一个**有持久登录态的真实 Chrome profile**。

```
旧方案（失败）：
  Playwright launch → 注入 storageState → Clerk/Google 拒绝

新方案（正确）：
  Playwright launchPersistentContext(专用 profile) → 直接复用已有登录态
```

### 专用 profile 的优点

- Google OAuth 正常通过（Chrome 使用真实 profile，有 Google 登录态）
- Clerk session 存在 profile 目录里，每次 runner 启动直接复用
- session 有效期几个月，到期才需要人工重新登录一次
- 使用专用 profile（`ScriptSnapBot`），不影响用户日常 Chrome

---

## 代码改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/check-auth.js` | 本地 auth 预检工具（快速排查文件缺失/cookie 过期） |
| `run-daily.sh` | 每日自动化运行包装脚本，由 launchd 调用 |
| `docs/com.openclaw.productsimulator.plist` | macOS launchd 定时任务配置（每天09:00） |

### 修改文件

| 文件 | 改动要点 |
|------|----------|
| `src/capture-auth-state.js` | 完全重写：改为 `launchPersistentContext` 模式，创建专用 Chrome profile 并完成一次性登录 |
| `src/run-single-analysis.js` | 改用 `launchPersistentContext` + 专用 profile，不再依赖 storageState 注入 |
| `src/config/app-config.js` | 新增 `chromeUserDataDir`、`chromeProfileDir` 配置项 |
| `src/config/selectors.js` | 全部选择器基于实际截图验证更新（`input#url`、tab 按钮等） |
| `src/steps/open-dashboard.js` | 加入 Clerk redirect 检测，提供明确的操作指引错误信息 |
| `src/steps/submit-url.js` | 去掉调试用 inspect 函数，流程简洁化 |
| `src/steps/wait-result-page.js` | 加入每30秒进度日志，`clearInterval` finally 清理 |
| `README.md` | Usage 章节更新为两步 SOP 说明 |
| `package.json` | 新增 `auth:check` 命令 |

---

## UI 验证（截图确认的选择器）

通过 browser subagent 完整跑通流程并截图验证，确认以下选择器：

| 元素 | 选择器 |
|------|--------|
| New Analysis 按钮 | `button:has-text("New Analysis")` |
| URL 输入框 | `input#url` |
| Analyze 按钮 | `button:has-text("Analyze")` |
| 结果页成功标志 | `button[role="tab"]:has-text("Article")` |
| 结果页 URL pattern | `/project/<id>` |

---

## 当前运行架构

```
首次 Setup（人工，一次）
  node src/capture-auth-state.js
    ↓ Chrome 弹出
    ↓ 用户手动登录 Script Snap
    ↓ 按 ENTER
    ↓ 专用 profile (ScriptSnapBot) 创建完成，session 存储在 profile 内

每日自动运行（全自动，每天09:00）
  launchd → run-daily.sh
    → node src/run-single-analysis.js --url <URL>
       → launchPersistentContext(ScriptSnapBot profile)
       → 直接进入 Dashboard (session 已在 profile 内)
       → New Analysis → 填 URL → Analyze → 等待结果
       → 截图 + 文字提取 → evidence-pack.json + run-summary.md

Session 过期后（几个月一次）
  → runner 报 SETUP REQUIRED
  → 重新跑 capture-auth-state.js（5分钟人工操作）
  → 继续自动运行
```

---

## 待完成

| 项目 | 状态 | 说明 |
|------|------|------|
| 首次 `capture-auth-state.js` 运行验证 | ⏳ 进行中 | 用户正在执行中 |
| `run-single-analysis.js` 跑通验证 | ⏳ 待验证 | 需首次 setup 完成后测试 |
| launchd 定时任务激活 | ⏳ 待操作 | 见下方命令 |
| Article/Tweets 抓取选择器精细化 | 🔲 待做 | 需进入实际结果页确认 class |

### 激活定时任务

```bash
cp docs/com.openclaw.productsimulator.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.openclaw.productsimulator.plist
launchctl list | grep openclaw  # 确认已加载
```

### 手动触发测试

```bash
launchctl start com.openclaw.productsimulator
```

---

## 关键认知沉淀

1. **`auth:check` 只是本地预检**，不能判断服务端 session 是否有效。输出"通过"不等于 runner 能跑。

2. **storageState 注入方案对 Clerk + Google OAuth 无效**。Playwright 启动的 Chrome 没有真实 profile，会被 Cloudflare/Google 指纹检测拒绝。

3. **`launchPersistentContext` + 专用 profile 是正确架构**。把"已有可用登录态"这件事，从"每次注入 cookie"升级为"profile 内持久存储"。

4. **每日自动化 ≠ 每日重新登录**。一次 setup 后，session 有效期几个月，runner 每天自动复用。

---

*文档生成时间: 2026-04-10*
