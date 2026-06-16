#!/usr/bin/env bash
# pipeline/checkup/cron.sh
# 每日 06:00（台灣）驗收前夜判決 pipeline 的產出，產出本機私有報告。
# 不 commit、不 push、不碰網站——純本機。
# 安裝（crontab，台灣時區；接在判決 pipeline 那行下面，共用 CRON_TZ=Asia/Taipei 與 PATH）：
#   0 6 * * * /root/www.dreamer868.com/pipeline/checkup/cron.sh >> /tmp/judgment-checkup.log 2>&1
#
# 前置：`claude` 已登入（訂閱帳戶，與判決 pipeline 同一身分）。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

# 與判決 pipeline 共用環境變數（選配；目前 checkup 不強制需要 .env 內容）
set -a
[ -f pipeline/.env ] && . pipeline/.env
set +a

echo "[checkup-cron] === $(date '+%F %T %Z') ==="
node pipeline/checkup/run.mjs
