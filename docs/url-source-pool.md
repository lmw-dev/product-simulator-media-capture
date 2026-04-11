# URL Source Pool (TOM-740)

## 目标

为 daily runner 提供一个本地 URL 输入池，实现：
- 去重
- 来源记录
- 状态管理
- runner 可消费

存储采用 SQLite，不引入远程服务。

## 数据库位置

默认路径：

`data/url-source-pool.sqlite`

可通过环境变量覆盖：

`URL_POOL_DB_PATH=/custom/path/pool.sqlite`

## 表结构

主表：`source_urls`

- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `url` TEXT NOT NULL UNIQUE
- `canonical_url` TEXT NOT NULL UNIQUE
- `source_type` TEXT NOT NULL
- `source_name` TEXT
- `content_type` TEXT
- `status` TEXT NOT NULL DEFAULT `pending`
- `first_added_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `last_processed_at` TEXT
- `last_run_id` TEXT
- `last_error` TEXT
- `notes` TEXT

状态枚举：
- `pending`
- `processed`
- `failed`
- `skipped`

## CLI

所有命令入口：

`npm run url-pool -- <subcommand>`

### 添加 URL

`add --url <url> --source-type <type> [--source-name <name>] [--content-type <type>] [--notes <text>]`

### 获取下一条待执行 URL

`next`

### 按 URL 查询

`get --url <url>`

### 更新状态

`mark --id <id>|--url <url> --status processed|failed|skipped [--run-id <runId>] [--error <msg>] [--notes <text>]`

### 按状态列表

`list --status pending|processed|failed|skipped [--limit 20]`

## Runner 接入

`run-single-analysis.js` 已支持：

- `--from-pool`: 拉取下一条 pending URL
- 运行完成后自动回写：
  - 成功 -> `processed`
  - 非成功 -> `failed`

如果仍使用 `--url` 直传模式，runner 不会改动 URL pool 状态。
