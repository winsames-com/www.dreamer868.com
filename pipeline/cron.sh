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

# ── 與 seo-ops 反思/大腦共用的 per-站鎖（2026-07-15 新增）─────────────────────────
# 第三個寫這個工作樹的人：/root/seo-ops 的反思（台 15:30）與大腦（台 16:05）會改本 repo
# 的經營層/內容檔，且反思失敗時會回退它碰過的檔。本腳本台 01:11 跑，離反思有 14 小時，
# 正常撞不到 —— 但「靠時間錯開」不是保險：pipeline 變慢、或哪天改 cron 時間就會撞上。
# 撞上的後果有實例：姊妹站 yao.care 的產線（台 04:30、跑 45~50 分）把反思（台 04:55）整個
# 包住 → 反思連 5 天全被回退，且反思舊版的整棵樹 `git clean -fdq` 刪掉產線 3 篇文章。
# 見 /root/seo-ops/MAINTENANCE.md §二（含 9 站第三方寫入者盤點表）。
# 等 1800s：本 job 一天一次，等一下也不該直接放棄整晚的判決稿。
# ⚠ 鎖檔名與 fd 必須與 seo-reflect.sh / seo-brain.sh 一致（/tmp/seo-claude-<站>.lock、fd 200）。
exec 200>/tmp/seo-claude-dreamer868.com.lock
if ! flock -w 1800 200; then
  echo "[cron] 等 seo-ops（反思/大腦）讓出工作樹逾時（>30 分），本次放棄"
  exit 1
fi

# 載入環境變數（JUD_USER / JUD_PASS，選配 DRY_RUN）
set -a
[ -f pipeline/.env ] && . pipeline/.env
set +a

# run.mjs 失敗也不中斷：仍要發 Slack 告警（heartbeat 會偵測缺 last-run.json）。
node pipeline/run.mjs || echo "[cron] run.mjs 非零退出（續行：commit 判斷 + Slack 告警）"

# 乾跑不發佈、不發心跳（避免測試噪音）
if [ "${DRY_RUN:-}" = "1" ]; then
  echo "[cron] DRY_RUN — 不 commit、不發 Slack"
  exit 0
fi

# ── 內容守門（去 AI 味）：封堵「pipeline 直推繞過守門」漏洞（2026-07-21）──
# run.mjs 產出的新文章是 untracked 檔（新 slug）；git add 前逐檔跑 check-content（explicit-file
# 模式，命中 ERROR 即 exit 1）。過關的留下 commit；沒過的移進 pipeline/quarantine/（該站既有隔離區、
# 已 gitignore），並記 log＋Slack，逐檔判定——不讓一篇 AI 味擋掉整批。
# 只 gate untracked 新檔：pipeline 只新增文章、不改既有文章（改既有內容的是 seo-ops 反思/大腦，走各自
# build+check gate），故不動 modified/tracked 檔，避免誤刪既有好文。
AI_QUARANTINED=()
NEW_ARTICLES="$(git ls-files --others --exclude-standard -- 'src/content/articles' | grep -E '\.mdx?$' || true)"
if [ -n "$NEW_ARTICLES" ]; then
  mkdir -p pipeline/quarantine
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if node scripts/check-content.mjs "$f"; then
      echo "[cron][gate] 去 AI 味過關：$f"
    else
      dest="pipeline/quarantine/$(basename "$f" .md)-aiflavor-$(date -u +%Y%m%d).md"
      mv "$f" "$dest"
      AI_QUARANTINED+=("$(basename "$f")")
      echo "[cron][gate] ✗ 命中去 AI 味 ERROR，隔離不發佈：$f → $dest"
    fi
  done <<< "$NEW_ARTICLES"
fi
if [ ${#AI_QUARANTINED[@]} -gt 0 ]; then
  echo "[cron][gate] 本次因去 AI 味隔離 ${#AI_QUARANTINED[@]} 篇：${AI_QUARANTINED[*]}"
  printf '🛑 *文章撰寫｜去 AI 味守門* — 本次隔離 *%d* 篇（未發佈）：\n%s\n（已移入 pipeline/quarantine/；改法見記憶 content-no-ai-flavor）' \
    "${#AI_QUARANTINED[@]}" "$(printf '• %s\n' "${AI_QUARANTINED[@]}")" \
    | pipeline/slack/slack-notify.sh "${DREAMER868_SLACK_CHANNEL:-C0BEZSBJH6U}" || echo "[cron][gate] Slack 告警發送失敗（不中斷）"
fi

git add src/content/articles pipeline/state/seen-jids.json
if git diff --cached --quiet; then
  echo "[cron] 無新文章可提交"
else
  git commit -m "content: auto-publish judgment case stories ($(date -u +%F))"
  git push
  echo "[cron] 已發佈並推送"
fi

# Slack 心跳：✍️ 文章撰寫（今晚生產戰報；非 LLM、缺檔/失敗都不中斷）。
# 📊 數據心跳改由早上獨立 cron（pipeline/slack/data-cron.sh）發，與此處脫鉤、零重疊。
pipeline/slack/heartbeat-publish.sh || true
