#!/bin/bash
# pipeline/tw8/fetch-taiwan.sh —— tw8 每日執行：抓司法院 API → 投遞到境外主機的 write-only 收件匣。
# 比照 bansik.tw ops/fetch-taiwan.sh：只抓、不碰 git；先送資料、最後才送 DONE（內含 MANIFEST 的 sha256）。
#
# tw8 上只放兩個檔：本檔與 fetch-judicial.mjs（同一目錄）。repo 是私有的，由站主把內容交給 tw8 安裝，
# 安裝後核對 sha256（站主會一併提供）。相依：node ≥18、rsync、ssh、sha256sum。
#
# 環境變數（寫在 tw8 的 /etc/dreamer868-fetch.env，chmod 600；repo 內不寫憑證與主機位址）：
#   JUD_USER、JUD_PASS            司法院 API 帳密（必填）
#   D868_INTAKE_TARGET            rsync 目標，例如 root@<境外主機>:（對方已用 rrsync 把根目錄限定在收件匣）（必填）
#   D868_INTAKE_KEY               ssh 私鑰（預設 ~/.ssh/dreamer868_intake）
#   D868_DATA                     暫存與 log（預設 /var/lib/dreamer868-fetch）
#   JUD_MAX_DOCS                  每天最多抓幾份判決（預設 400）
# 排程：每天台灣 00:30（API 服務時間 00:00–06:00）。
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f /etc/dreamer868-fetch.env ] && { set -a; . /etc/dreamer868-fetch.env; set +a; }
DATA="${D868_DATA:-/var/lib/dreamer868-fetch}"
KEY="${D868_INTAKE_KEY:-$HOME/.ssh/dreamer868_intake}"
TARGET="${D868_INTAKE_TARGET:-}"
mkdir -p "$DATA"
exec >> "$DATA/fetch.log" 2>&1
log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*"; }
[ -n "$TARGET" ] || { log "沒設 D868_INTAKE_TARGET"; exit 1; }
exec 200>"$DATA/.lock"; flock -n 200 || { log "上一輪還在跑"; exit 1; }

OUT="$DATA/out"; rm -rf "$OUT"; mkdir -p "$OUT"
OUT="$OUT" node "$HERE/fetch-judicial.mjs" || { log "抓取失敗，這輪不投遞"; exit 1; }
cd "$OUT" || exit 1
sha256sum jlist.json docs.jsonl fetch-meta.json > MANIFEST.sha256
date -Iseconds > DONE
SSH="ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
for part in jlist.json docs.jsonl fetch-meta.json MANIFEST.sha256 DONE; do
  rsync -a --partial -e "$SSH" "$part" "$TARGET" || { log "投遞 $part 失敗"; exit 1; }
done
log "投遞完成：$(grep -c . docs.jsonl) 份判決"
