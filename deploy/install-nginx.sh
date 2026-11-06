#!/usr/bin/env bash
# Thêm /teacher-bot vào nginx của mta.thinhdhm.id.vn. Chạy: sudo bash deploy/install-nginx.sh
# An toàn: sao lưu trước, chạy lại nhiều lần không bị lặp, nginx -t lỗi thì tự khôi phục.
set -euo pipefail

DOMAIN="${DOMAIN:-mta.thinhdhm.id.vn}"
CONF="${NGINX_CONF:-/etc/nginx/sites-available/$DOMAIN}"
SNIPPET_DIR="${SNIPPET_DIR:-/etc/nginx/snippets}"
TEST_CMD="${NGINX_TEST_CMD:-nginx -t}"
RELOAD_CMD="${NGINX_RELOAD_CMD:-systemctl reload nginx}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ "${NGINX_SKIP_ROOT_CHECK:-}" == 1 || $EUID -eq 0 ]] || { echo "Cần chạy bằng sudo: sudo bash $0" >&2; exit 1; }
[[ -f "$CONF" ]] || { echo "Không thấy $CONF" >&2; exit 1; }

BACKUP="$CONF.bak.teacher-bot.$(date +%Y%m%d%H%M%S)"
cp -p "$CONF" "$BACKUP"
echo "Đã sao lưu: $BACKUP"

# 1) Snippet riêng (ghi đè mỗi lần chạy để luôn mới nhất)
mkdir -p "$SNIPPET_DIR"
sed '/^#/d' "$HERE/nginx-teacher-bot.conf" > "$SNIPPET_DIR/teacher-bot.conf"
echo "Đã ghi: $SNIPPET_DIR/teacher-bot.conf"

# 2) Chèn một dòng include vào server block HTTPS của domain (nếu chưa có)
if grep -q 'snippets/teacher-bot.conf' "$CONF"; then
  echo "Đã có include trong $CONF, bỏ qua bước chèn."
else
  python3 - "$CONF" "$DOMAIN" <<'PY'
import re, sys
path, domain = sys.argv[1], sys.argv[2]
src = open(path).read()

# tìm các khối server { ... } ở mức ngoài cùng bằng đếm ngoặc
blocks, i = [], 0
while True:
    m = re.compile(r'\bserver\s*\{').search(src, i)
    if not m: break
    depth, j = 1, m.end()
    while j < len(src) and depth:
        depth += {'{': 1, '}': -1}.get(src[j], 0); j += 1
    blocks.append((m.start(), j)); i = j

def body(b): return src[b[0]:b[1]]
mine = [b for b in blocks if re.search(r'server_name[^;]*\b' + re.escape(domain) + r'\b', body(b))]
https = [b for b in mine if re.search(r'listen[^;]*(443|ssl)', body(b))]
target = (https or mine or [None])[0]
if not target:
    sys.exit(f'Không tìm thấy server block cho {domain} trong {path}')
if not https:
    print('CẢNH BÁO: không thấy listen 443/ssl, chèn vào block HTTP của domain.')

blk = body(target)
sn = re.search(r'^[ \t]*server_name[^;]*;[ \t]*\n', blk, re.M)
line = '    include snippets/teacher-bot.conf;  # teacher-bot\n'
pos = target[0] + sn.end()
open(path, 'w').write(src[:pos] + line + src[pos:])
print('Đã chèn include vào server block của', domain)
PY
fi

# 3) Kiểm tra cấu hình; lỗi thì trả lại bản cũ
if ! $TEST_CMD; then
  echo "nginx -t LỖI, khôi phục bản sao lưu." >&2
  cp -p "$BACKUP" "$CONF"
  exit 1
fi
$RELOAD_CMD
echo "Xong. Thử: curl -sI https://$DOMAIN/teacher-bot/ | head -1"
