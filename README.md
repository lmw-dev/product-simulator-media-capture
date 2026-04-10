# Product Simulator & Media Capture

## What this project is

`Product Simulator & Media Capture` is a **Script Snap product dogfooding and result evidence capture runner**.

Its purpose is to execute the real Script Snap analysis flow, reach the result page, capture the right-side `Article` and `Tweets`, and generate a structured **Result Evidence Pack** for:

- product calibration
- case analysis input
- result-page evidence collection
- repeatable dogfooding

This repository exists for the **execution layer** of the project.

- **Definition layer** lives in the project documents / Obsidian workspace
- **Execution layer** lives here in code

---

## What this project is not

This project is **not**:

- a generic browser automation platform
- a screen-recording-first tool
- a long-running backend service
- an internal API server
- a multi-user queue system
- a broad content export framework
- a “capture everything from every tab” pipeline

Phase 1 must stay disciplined.

---

## Locked project definition

The project definition has already been locked in the design docs.

### Core definition
This is a pipeline for:
- Script Snap product dogfooding
- result evidence capture
- case analysis input generation
- product calibration input generation

### Primary deliverable
The primary deliverable is:
- `Result Evidence Pack`

### Phase 1 capture focus
Phase 1 only focuses on:
- reaching the result page
- capturing right-side `Article`
- capturing right-side `Tweets`
- generating structured output

### Playwright boundary
Playwright is only responsible for:
- execution
- waiting
- locating
- capturing
- structured output generation

Playwright is **not** responsible for:
- final analysis judgment
- product strategy conclusions
- red-team review conclusions
- replacing human review

---

## Phase 1 scope

Phase 1 only does the minimum correct path:

1. open Script Snap dashboard
2. trigger analysis
3. submit target URL
4. wait for the result page
5. capture `Article / Tweets`
6. generate a `Result Evidence Pack`
7. generate a minimal run summary

### Explicitly out of scope in Phase 1
- cron scheduling
- long-running service mode
- job queueing
- multi-run orchestration
- database storage
- broad plugin architecture
- full-flow media pipeline
- deep automatic content analysis

---

## Recommended repository structure

```text
product-simulator-media-capture/
  README.md
  docs/
    CODEX_IMPLEMENTATION_PROMPT.md
  src/
    run-single-analysis.js
    steps/
    core/
    config/
  outputs/
```

---

## Output expectation

Each run should produce a run-specific output folder, for example:

```text
outputs/
  2026-04-09/
    run-2026-04-09-001/
      evidence-pack.json
      result-page.png
      article.png
      tweets.png
      run-summary.md
```

### Minimum `Result Evidence Pack`
The output JSON should include at least:
- `runId`
- `timestamp`
- `sourceUrl`
- `status`
- result page screenshot path
- article screenshot path
- tweets screenshot path
- article raw text
- tweets raw text
- validation state
- basic notes

---

## Related docs

### Core project docs
- `方案说明 - Product Simulator & Media Capture v2（Core Design）.md`
- `SOP - Product Simulator & Media Capture 执行流程.md`
- `Phase 1 拆解 - Product Simulator & Media Capture v2.md`

### Implementation prompt
- `docs/CODEX_IMPLEMENTATION_PROMPT.md`

---

## Current status

Current status:
- project definition locked
- Phase 1 tasks created in Linear
- code repository initialized
- implementation prompt prepared for Codex

---

## Build philosophy

Build the smallest correct runner.

Do not overbuild.
Do not platformize.
Do not optimize for imaginary future complexity.

This repository should remain a **focused execution project**, not a general framework.

---

## Usage

### Prerequisites
- Node.js (v18+)
- Playwright
- Google Chrome installed at `/Applications/Google Chrome.app`

```bash
npm install
```

---

### Phase 1 SOP: Two-Step Flow

This project runs in two steps. Step 1 is done by a human. Step 2 is automated.

#### Step 1 — Capture auth state (human-assisted, one-time per session)

```bash
node src/capture-auth-state.js
# or: npm run auth:capture
```

This opens a real Chrome window. You manually log into Script Snap, confirm you see the dashboard, then press ENTER in the terminal. The auth state is saved to `playwright/.auth/state.json`.

> **This is not automated login.** This is human-assisted auth capture.

#### Step 2 — Run the capture pipeline

```bash
node src/run-single-analysis.js --url "https://youtube.com/watch?v=<VIDEO_ID>"
```

Optional parameters:
- `--no-headless`: Show the browser window (useful for debugging). Default is headless.
- `--url <url>`: The target YouTube URL to analyze (required).

---

### Quick auth validity check

Before running, check if your auth state is still valid:

```bash
node src/check-auth.js
# or: npm run auth:check
```

Exit code 0 = valid. Exit code 1 = expired/missing → re-run Step 1.

---

### When auth expires

Auth sessions typically last weeks to months. When the runner fails with:

```
[AUTH REQUIRED] Redirected to login page
  Auth state missing or expired. Run: node src/capture-auth-state.js
```

Just re-run **Step 1** to get a fresh session. Then run Step 2 again.

---

### Authentication

The runner uses `playwright/.auth/state.json` as the auth state file.
This file is created by `src/capture-auth-state.js` and consumed by `src/run-single-analysis.js`.

To change the auth file location, set the environment variable:

```bash
STORAGE_STATE_PATH=/path/to/state.json node src/run-single-analysis.js --url "..."
```

### Configuration

All Playwright selectors and basic definitions are explicitly isolated to ease future UI changes:
- `src/config/app-config.js`
- `src/config/selectors.js`
