#!/bin/bash
# run-daily.sh
# Phase 3 Daily Trial Run (Script Snap)

set -e

NODE="$(which node || echo '/opt/homebrew/bin/node')"
PROJECT_DIR="/Volumes/ExternalLiumw/lavori/01_code/product-simulator-media-capture"
LOG_DIR="${PROJECT_DIR}/outputs/logs"
INBOX_FILE="${PROJECT_DIR}/youtube-url-inbox.md"

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/run-from-pool-$(date +%Y-%m-%d).log"

echo "=== Phase 3 Trial Run started: $(date) ===" >> "${LOG_FILE}"

cd "${PROJECT_DIR}"

# 1. 批量导入 inbox 到 Pool (自动去重)
echo "-> Importing URLs from inbox..." >> "${LOG_FILE}"
if [ -f "${INBOX_FILE}" ]; then
  python3 -c "
import sys, subprocess
urls = [line.strip() for line in open('${INBOX_FILE}', 'r', encoding='utf-8') if line.strip() and not line.startswith('#')]
for url in urls:
    subprocess.run(['${NODE}', 'src/url-pool-cli.js', 'add', '--url', url, '--source-type', 'youtube-inbox', '--source-name', 'youtube-url-inbox.md'], check=False)
" >> "${LOG_FILE}" 2>&1
  
  # 清空已被系统吃掉的 inbox（保留 Header）
  echo "# Script Snap YouTube URL Inbox" > "${INBOX_FILE}"
  echo "" >> "${INBOX_FILE}"
fi

# 2. 从 Pool 跑单
echo "-> Running analysis from pool..." >> "${LOG_FILE}"
set +e
"${NODE}" src/run-single-analysis.js --from-pool --headless >> "${LOG_FILE}" 2>&1
EXIT_CODE=$?
echo "-> Running post-run reporting hook..." >> "${LOG_FILE}"
"${NODE}" src/post-run-report.js >> "${LOG_FILE}" 2>&1
REPORT_EXIT_CODE=$?
set -e

echo "=== Run finished: $(date) | run_exit=${EXIT_CODE} | report_exit=${REPORT_EXIT_CODE} ===" >> "${LOG_FILE}"

if [ "${EXIT_CODE}" -ne 0 ]; then
  exit "${EXIT_CODE}"
fi

exit "${REPORT_EXIT_CODE}"
