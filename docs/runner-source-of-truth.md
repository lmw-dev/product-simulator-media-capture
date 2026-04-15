# Runner Source of Truth

## 唯一正式执行入口

自 2026-04-11 起，`Product Simulator & Media Capture` 的唯一正式执行入口为：

`/Volumes/ExternalLiumw/lavori/01_code/product-simulator-media-capture`

本仓位承担：
- auth handoff（persistent Chrome profile）
- 单次分析 runner
- Result Evidence Pack 输出
- run summary 输出
- 调度前准备脚本与说明

---

## 唯一正式 auth 方案

当前唯一正式 auth 方案为：
- `launchPersistentContext`
- 专用 Chrome profile：`ScriptSnapBot`
- 一次人工 setup，后续 runner 自动复用

不再使用：
- 旧 `storageState/auth.json` 注入作为主线方案
- 旧项目目录中的 `auth.json` 运行口径

---

## 唯一正式运行命令

### 首次 / session 失效时
```bash
node src/capture-auth-state.js
```

### 日常执行
```bash
node src/run-single-analysis.js --url "<YouTube URL>"
```

### 本地预检
```bash
node src/check-auth.js
```

---

## 唯一正式输出口径

输出目录：
`outputs/YYYY-MM-DD/run-<id>/`

核心产物：
- `evidence-pack.json`
- `result-page.png`
- `article.png`
- `tweets.png`
- `run-summary.md`

---

## 非主线项

以下内容不再作为当前正式执行入口：
- 旧 `simulator.js`
- 旧项目目录中的 `package.json / node_modules / auth.json`
- 旧 Intel Radar 自动落盘逻辑
- 旧 workspace media 输出口径

一句话：
**后续执行一律以本代码仓与本 README / docs 为准。**
