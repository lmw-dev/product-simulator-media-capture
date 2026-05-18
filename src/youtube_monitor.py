#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
🦅 Ares OSINT - YouTube Monitor
-------------------------------
建立一个轻量、稳定、可重复运行的 YouTube 博主视频 URL 抓取管线。
支持官方 YouTube Data API (需 API Key) 与 yt-dlp (免登录模式)。

Issue: TOM-767
"""

import os
import sys
import yaml
import json
import csv
import argparse
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any

# 尝试导入可选依赖
try:
    from googleapiclient.discovery import build
    HAS_GOOGLE_API = True
except ImportError:
    HAS_GOOGLE_API = False

try:
    import yt_dlp
    HAS_YT_DLP = True
except ImportError:
    HAS_YT_DLP = False

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class YouTubeMonitor:
    def __init__(self, args):
        self.args = args
        self.config = self._load_config(args.config)
        self.api_key = os.getenv("YOUTUBE_API_KEY")
        
        # 确定工作目录与输出路径
        self.workspace = Path(args.output).parent
        self.workspace.mkdir(parents=True, exist_ok=True)
        
        self.csv_path = Path(args.output)
        self.jsonl_path = self.csv_path.with_suffix('.jsonl')
        self.seen_path = self.workspace / "seen_video_ids.txt"
        
        # 加载已读 ID
        self.seen_ids = self._load_seen_ids()
        
        # 初始化日志文件
        self._setup_file_logging()

    def _load_config(self, config_path: str) -> Dict:
        if not os.path.exists(config_path):
            logger.error(f"配置文件未找到: {config_path}")
            sys.exit(1)
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _load_seen_ids(self) -> set:
        seen = set()
        # 1. 从 txt 加载
        if self.seen_path.exists():
            with open(self.seen_path, 'r') as f:
                seen.update(line.strip() for line in f if line.strip())
        
        # 2. 从已有 CSV 预检 (双重保险)
        if self.csv_path.exists():
            try:
                with open(self.csv_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if 'video_id' in row:
                            seen.add(row['video_id'])
            except Exception as e:
                logger.warning(f"预检已有 CSV 失败: {e}")
        
        return seen

    def _save_seen_id(self, video_id: str):
        with open(self.seen_path, 'a') as f:
            f.write(f"{video_id}\n")
        self.seen_ids.add(video_id)

    def _setup_file_logging(self):
        log_dir = self.workspace / "logs"
        log_dir.mkdir(exist_ok=True)
        
        run_log = log_dir / "run.log"
        error_log = log_dir / "error.log"
        
        file_handler = logging.FileHandler(run_log, encoding='utf-8')
        file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        logger.addHandler(file_handler)
        
        err_handler = logging.FileHandler(error_log, encoding='utf-8')
        err_handler.setLevel(logging.ERROR)
        err_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        logger.addHandler(err_handler)

    def fetch_videos(self):
        channels = self.config.get('channels', [])
        all_new_videos = []

        for channel in channels:
            name = channel.get('name')
            url = channel.get('url')
            logger.info(f"正在扫描频道: {name} ({url})")
            
            videos = []
            if self.api_key and HAS_GOOGLE_API:
                videos = self._fetch_via_api(channel)
            elif HAS_YT_DLP:
                videos = self._fetch_via_yt_dlp(channel)
            else:
                logger.error("缺少必要依赖: 请安装 google-api-python-client 或 yt-dlp")
                break
            
            filtered = self._filter_videos(videos)
            logger.info(f"频道 {name} 发现 {len(videos)} 条视频, 过滤后剩余 {len(filtered)} 条新视频")
            all_new_videos.extend(filtered)

        if all_new_videos:
            self._output_results(all_new_videos)
            logger.info(f"任务完成, 本次新增 {len(all_new_videos)} 条视频记录")
        else:
            logger.info("任务完成, 未发现符合条件的视频")

    def _fetch_via_api(self, channel: Dict) -> List[Dict]:
        """使用 YouTube Data API 获取视频"""
        try:
            youtube = build("youtube", "v3", developerKey=self.api_key)
            
            # 1. 获取 Channel ID (如果是 Handle 格式)
            url = channel.get('url', '')
            handle = url.split('@')[-1].split('/')[0] if '@' in url else None
            
            if handle:
                search_res = youtube.search().list(
                    q=handle,
                    type="channel",
                    part="id",
                    maxResults=1
                ).execute()
                if not search_res.get('items'):
                    logger.error(f"无法通过 API 找到频道: {handle}")
                    return []
                channel_id = search_res['items'][0]['id']['channelId']
            else:
                # 假设 URL 包含 channel ID
                channel_id = url.split('/')[-1]

            # 2. 获取最新视频
            res = youtube.search().list(
                channelId=channel_id,
                part="snippet,id",
                order="date",
                maxResults=self.args.max_results,
                type="video"
            ).execute()

            video_ids = [item['id']['videoId'] for item in res.get('items', [])]
            if not video_ids:
                return []

            # 3. 获取视频详情 (时长)
            details = youtube.videos().list(
                id=",".join(video_ids),
                part="contentDetails,snippet"
            ).execute()

            results = []
            for item in details.get('items', []):
                v_id = item['id']
                snippet = item['snippet']
                content = item['contentDetails']
                
                # 解析时长 (ISO 8601 duration -> seconds)
                duration_str = content['duration']
                duration_seconds = self._parse_iso_duration(duration_str)
                
                results.append({
                    'video_id': v_id,
                    'channel': channel.get('name'),
                    'title': snippet['title'],
                    'url': f"https://www.youtube.com/watch?v={v_id}",
                    'duration_seconds': duration_seconds,
                    'duration_minutes': round(duration_seconds / 60, 1),
                    'published_at': snippet['publishedAt'],
                    'collected_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                })
            return results

        except Exception as e:
            logger.error(f"API 获取失败: {e}")
            # 如果 API 失败且有 yt-dlp，尝试回退
            if HAS_YT_DLP:
                logger.info("尝试回退至 yt-dlp...")
                return self._fetch_via_yt_dlp(channel)
            return []

    def _fetch_via_yt_dlp(self, channel: Dict) -> List[Dict]:
        """使用 yt-dlp 获取视频"""
        ydl_opts = {
            'extract_flat': True,
            'quiet': True,
            'playlistend': self.args.max_results,
            'skip_download': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(channel.get('url'), download=False)
                if 'entries' not in info:
                    return []
                
                results = []
                for entry in info['entries']:
                    if not entry: continue
                    
                    v_id = entry.get('id')
                    duration = entry.get('duration') or 0
                    
                    # yt-dlp 的日期通常是 YYYYMMDD
                    raw_date = entry.get('upload_date')
                    if raw_date:
                        published_at = datetime.strptime(raw_date, '%Y%m%d').replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
                    else:
                        published_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

                    results.append({
                        'video_id': v_id,
                        'channel': channel.get('name'),
                        'title': entry.get('title'),
                        'url': f"https://www.youtube.com/watch?v={v_id}",
                        'duration_seconds': int(duration),
                        'duration_minutes': round(duration / 60, 1),
                        'published_at': published_at,
                        'collected_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                    })
                return results
        except Exception as e:
            logger.error(f"yt-dlp 获取失败: {e}")
            return []

    def _filter_videos(self, videos: List[Dict]) -> List[Dict]:
        filtered = []
        recent_threshold = datetime.now(timezone.utc) - timedelta(days=self.args.recent_days)
        
        min_sec = self.args.min_minutes * 60
        max_sec = self.args.max_minutes * 60

        for v in videos:
            # 1. ID 校验
            v_id = v.get('video_id')
            if not v_id or v_id in self.seen_ids:
                continue
            
            # 2. 时长校验
            duration = v.get('duration_seconds', 0)
            if not (min_sec <= duration <= max_sec):
                continue
            
            # 3. 近期校验
            pub_date_str = v.get('published_at')
            try:
                # 处理多种可能的日期格式
                pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                if pub_date < recent_threshold:
                    continue
            except Exception:
                logger.warning(f"日期解析失败: {pub_date_str}")
                continue
            
            filtered.append(v)
        return filtered

    def _output_results(self, videos: List[Dict]):
        headers = ['video_id', 'channel', 'title', 'url', 'duration_minutes', 'duration_seconds', 'published_at', 'collected_at']
        
        # 1. 写入 CSV (追加模式)
        file_exists = self.csv_path.exists()
        with open(self.csv_path, 'a', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            if not file_exists:
                writer.writeheader()
            for v in videos:
                writer.writerow(v)
                self._save_seen_id(v['video_id'])

        # 2. 写入 JSONL (追加模式)
        with open(self.jsonl_path, 'a', encoding='utf-8') as f:
            for v in videos:
                f.write(json.dumps(v, ensure_ascii=False) + '\n')

    def _parse_iso_duration(self, duration: str) -> int:
        """解析 ISO 8601 时长格式, 如 PT18M4S"""
        import re
        hours = re.search(r'(\d+)H', duration)
        minutes = re.search(r'(\d+)M', duration)
        seconds = re.search(r'(\d+)S', duration)
        
        h = int(hours.group(1)) if hours else 0
        m = int(minutes.group(1)) if minutes else 0
        s = int(seconds.group(1)) if seconds else 0
        
        return h * 3600 + m * 60 + s

def main():
    parser = argparse.ArgumentParser(description="YouTube Monitor for Ares OSINT")
    parser.add_argument("--config", default="config/youtube_channels.yaml", help="配置文件路径")
    parser.add_argument("--output", default="data/youtube_monitor/videos.csv", help="输出 CSV 路径")
    parser.add_argument("--recent-days", type=int, default=14, help="最近几天内的视频")
    parser.add_argument("--min-minutes", type=int, default=10, help="最小视频时长(分钟)")
    parser.add_argument("--max-minutes", type=int, default=25, help="最大视频时长(分钟)")
    parser.add_argument("--max-results", type=int, default=20, help="每个频道抓取条数")
    
    args = parser.parse_args()
    
    # 自动尝试加载 .env (如果存在)
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
    
    monitor = YouTubeMonitor(args)
    monitor.fetch_videos()

if __name__ == "__main__":
    main()
