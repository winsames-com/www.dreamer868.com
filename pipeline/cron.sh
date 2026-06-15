#!/usr/bin/env bash
# 本機 cron 包裝腳本：載入 .env、跑 pipeline、發佈成功則 commit+push。
# 安裝（台灣機器，每日凌晨 1 點，落在司法院 API 服務窗 0–6 點）：
#   crontab -e
#   0 1 * * * /Users/lightman/myGithub/www.dreamer868.com/pipeline/cron.sh >> /tmp/judgment-pipeline.log 2>&1
#
# 前置：`claude` 已登入（訂閱帳戶）；pipeline/.env 內含 JUD_USER / JUD_PASS。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# 載入環境變數（JUD_USER / JUD_PASS，選配 DRY_RUN）
set -a
[ -f pipeline/.env ] && . pipeline/.env
set +a

node pipeline/run.mjs

# 乾跑不發佈
if [ "${DRY_RUN:-}" = "1" ]; then
  echo "[cron] DRY_RUN — 不 commit"
  exit 0
fi

git add src/content/articles pipeline/state/seen-jids.json
if git diff --cached --quiet; then
  echo "[cron] 無新文章可提交"
else
  git commit -m "content: auto-publish judgment case stories ($(date -u +%F))"
  git push
  echo "[cron] 已發佈並推送"
fi
