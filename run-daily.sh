#!/bin/bash
# run-daily.sh
# 每日自动化运行脚本，由 launchd 调用。
# 用法：直接运行，不需要参数（URL 需在此处配置）。

set -e

# ─── 配置 ───────────────────────────────────────────────
TARGET_URL="${SCRIPT_SNAP_TARGET_URL:-https://www.youtube.com/watch?v=6V-b073qhPA}"
NODE="/opt/homebrew/bin/node"
PROJECT_DIR="/Volumes/ExternalLiumw/lavori/01_code/product-simulator-media-capture"
LOG_DIR="${PROJECT_DIR}/outputs/logs"
# ─────────────────────────────────────────────────────────

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/run-$(date +%Y-%m-%d).log"

echo "=== Run started: $(date) ===" >> "${LOG_FILE}"
echo "Target URL: ${TARGET_URL}" >> "${LOG_FILE}"

cd "${PROJECT_DIR}"

"${NODE}" src/run-single-analysis.js \
  --url "${TARGET_URL}" \
  --headless \
  2>&1 | tee -a "${LOG_FILE}"

EXIT_CODE=${PIPESTATUS[0]}

echo "=== Run finished: $(date) | exit=${EXIT_CODE} ===" >> "${LOG_FILE}"
exit ${EXIT_CODE}
