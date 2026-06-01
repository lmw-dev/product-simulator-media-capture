#!/bin/bash
# youtube-monitor-daily.sh
# 每天 08:00 由 launchd 触发
# 1. 运行 YouTube Monitor 采集视频
# 2. 将新采集的 URL 写入 youtube-url-inbox.md（供 12:00 Phase 3 消费）

set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/liumingwei/Library/Python/3.9/bin:$PATH"

PROJECT_DIR="/Volumes/ExternalLiumw/lavori/01_code/product-simulator-media-capture"
INBOX_FILE="${PROJECT_DIR}/youtube-url-inbox.md"
CSV_FILE="${PROJECT_DIR}/data/youtube_monitor/videos.csv"
SCRIPT="${PROJECT_DIR}/src/youtube_monitor.py"
CONFIG="${PROJECT_DIR}/config/youtube_channels.yaml"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] YouTube Monitor Daily Run started"

# Step 1: 运行 YouTube Monitor
cd "${PROJECT_DIR}"
python3 "${SCRIPT}" \
  --config "${CONFIG}" \
  --output "${CSV_FILE}" \
  --recent-days 14

# Step 2: 将本次新增的 URL 灌入 inbox
python3 -c "
import csv
from pathlib import Path

csv_path = Path('${CSV_FILE}')
inbox_path = Path('${INBOX_FILE}')

if not csv_path.exists():
    print('No CSV found, skipping inbox import.')
    exit(0)

with open(csv_path, 'r') as f:
    reader = csv.DictReader(f)
    urls = [row['url'] for row in reader]

if urls:
    # 读取 inbox 已有 URL，避免重复写入
    existing = set()
    if inbox_path.exists():
        for line in inbox_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#'):
                existing.add(line)
    
    new_urls = [u for u in urls if u not in existing]
    if new_urls:
        with open(inbox_path, 'a') as f:
            for url in new_urls:
                f.write(f'{url}\n')
        print(f'Added {len(new_urls)} new URLs to inbox')
    else:
        print('No new URLs to add to inbox')
else:
    print('CSV is empty, no URLs to import')
"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] YouTube Monitor Daily Run finished"
